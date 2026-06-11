"""Prédiction et prévision pour données agricoles (numériques + catégorielles)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from .causal import (
    _auto_target_column,
    _encode_column_for_analysis,
    _find_time_column,
    _parse_feature_list,
)
from .errors import PipelineError


def _is_causal_summary_df(df: pd.DataFrame) -> bool:
    cols = {str(c).lower() for c in df.columns}
    return "correlation" in cols or "causalscore" in cols or "causal_score" in cols


def _guard_input_rows(df: pd.DataFrame, min_rows: int = 3) -> None:
    if _is_causal_summary_df(df):
        raise PipelineError(
            "Ce nœud reçoit le résumé de l'analyse causale (peu de lignes). "
            "Connectez « Prédiction » directement après la source ou la classification agricole, "
            "pas après « Analyse causale »."
        )
    if len(df) < min_rows:
        raise PipelineError(
            f"Pas assez de lignes ({len(df)}). Il en faut au moins {min_rows}. "
            "Vérifiez que la prédiction est branchée sur le CSV (643+ lignes)."
        )


def _encode_series_with_map(series: pd.Series) -> Tuple[pd.Series, Optional[Dict[int, str]]]:
    """Encode une colonne ; retourne (série numérique, map code→libellé si catégoriel)."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce"), None

    as_num = pd.to_numeric(series.astype(str).str.replace(",", ".", regex=False), errors="coerce")
    if as_num.notna().sum() >= max(3, len(series) * 0.15):
        return as_num, None

    codes, uniques = pd.factorize(series.astype(str).str.strip())
    inv = {int(i): str(uniques[i]) for i in range(len(uniques))}
    return pd.Series(codes, index=series.index, dtype=float), inv


def _resolve_features(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: Optional[List[str]],
) -> List[str]:
    feats = _parse_feature_list(feature_columns)
    if feats:
        return [f for f in feats if f != target_column and f in df.columns]
    return [
        str(c)
        for c in df.columns
        if str(c) != target_column and not str(c).startswith("_")
    ]


def _linear_fit(X: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, float]:
    ones = np.ones((X.shape[0], 1))
    Xb = np.hstack([ones, X])
    coef, _, _, _ = np.linalg.lstsq(Xb, y, rcond=None)
    pred = Xb @ coef
    mae = float(np.mean(np.abs(y - pred)))
    return coef, mae


def _decode_predictions(values: np.ndarray, label_map: Optional[Dict[int, str]]) -> List[Optional[str]]:
    if not label_map:
        return []
    out: List[Optional[str]] = []
    for v in values:
        if np.isnan(v):
            out.append(None)
            continue
        idx = int(round(v))
        idx = max(0, min(idx, max(label_map.keys())))
        out.append(label_map.get(idx))
    return out


def predict_regression(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: Optional[List[str]] = None,
    test_ratio: float = 0.2,
) -> Dict[str, Any]:
    if target_column not in df.columns:
        raise PipelineError(f"Colonne cible introuvable : {target_column}")

    _guard_input_rows(df, min_rows=3)

    feats = _resolve_features(df, target_column, feature_columns)
    if not feats:
        raise PipelineError(
            "Choisissez au moins une variable explicative différente de la cible "
            "(texte et catégories acceptés : encodage automatique)."
        )

    work = df[feats + [target_column]].copy()
    target_encoded, target_map = _encode_series_with_map(work[target_column])
    work[target_column] = target_encoded

    for col in feats:
        work[col] = _encode_column_for_analysis(work[col])

    work = work.dropna(subset=[target_column])
    if len(work) < 3:
        raise PipelineError(
            f"Pas assez de lignes valides pour « {target_column} » après encodage (min. 3)."
        )

    X = work[feats].values.astype(float)
    y = work[target_column].values.astype(float)

    split = max(1, int(len(work) * (1 - test_ratio)))
    coef, train_mae = _linear_fit(X[:split], y[:split])

    metrics: Dict[str, Any] = {"trainMae": round(train_mae, 4), "trainSamples": int(split)}
    if len(work) > split:
        ones = np.ones((len(y[split:]), 1))
        test_pred = np.hstack([ones, X[split:]]) @ coef
        metrics["testMae"] = round(float(np.mean(np.abs(y[split:] - test_pred))), 4)
        metrics["testSamples"] = int(len(y[split:]))

    coefs = {f: round(float(coef[i + 1]), 4) for i, f in enumerate(feats)}
    coefs["_intercept"] = round(float(coef[0]), 4)

    ones_all = np.ones((len(y), 1))
    all_pred = np.hstack([ones_all, X]) @ coef
    pred_df = work.copy()
    pred_df[f"{target_column}_predicted"] = all_pred
    pred_df[f"{target_column}_residual"] = pred_df[target_column] - pred_df[f"{target_column}_predicted"]

    if target_map:
        labels = _decode_predictions(all_pred, target_map)
        pred_df[f"{target_column}_predicted_label"] = labels
        metrics["targetEncoding"] = "categorical"

    return {
        "mode": "regression",
        "targetColumn": target_column,
        "features": feats,
        "coefficients": coefs,
        "metrics": metrics,
        "predictions": pred_df,
        "method": "ols_encoded",
        "encodingNote": "Colonnes texte/catégories converties en codes numériques.",
    }


def forecast_timeseries(
    df: pd.DataFrame,
    value_column: str,
    time_column: Optional[str] = None,
    horizon: int = 5,
) -> Dict[str, Any]:
    if value_column not in df.columns:
        raise PipelineError(f"Colonne cible introuvable : {value_column}")

    _guard_input_rows(df, min_rows=4)

    time_col = (time_column or "").strip() or _find_time_column(df, None)
    use_index_time = False

    if time_col and time_col in df.columns:
        work = df[[time_col, value_column]].copy()
        work[time_col] = pd.to_datetime(work[time_col], dayfirst=True, errors="coerce")
        if work[time_col].notna().sum() < max(4, len(work) * 0.2):
            time_col = None

    if not time_col:
        use_index_time = True
        work = df[[value_column]].copy()
        work["_index_time"] = np.arange(len(work))
        time_col = "_index_time"

    encoded, value_map = _encode_series_with_map(work[value_column])
    work[value_column] = encoded
    work = work.dropna(subset=[value_column])

    if use_index_time:
        work = work.sort_values("_index_time")
        t_series = work["_index_time"].astype(float)
        t0 = float(t_series.min())
        work["_t"] = t_series - t0
    else:
        work = work.dropna(subset=[time_col]).sort_values(time_col)
        t0 = work[time_col].min()
        work["_t"] = (work[time_col] - t0).dt.days.astype(float)

    if len(work) < 4:
        raise PipelineError(
            "Série trop courte pour prévision (min. 4 points). "
            "Branchez ce nœud sur la source CSV, pas sur l'analyse causale."
        )

    X = work[["_t"]].values.astype(float)
    y = work[value_column].values.astype(float)
    coef, _ = _linear_fit(X, y)
    slope = float(coef[1])
    intercept = float(coef[0])

    last_t = float(work["_t"].max())
    freq = float(work["_t"].diff().median()) or 1.0
    future_rows: List[Dict[str, Any]] = []

    for i in range(1, horizon + 1):
        t_future = last_t + freq * i
        pred_val = intercept + slope * t_future
        row: Dict[str, Any] = {
            value_column: round(pred_val, 4),
            "_forecast": True,
        }
        if value_map:
            lbl = _decode_predictions(np.array([pred_val]), value_map)
            row[f"{value_column}_predicted_label"] = lbl[0] if lbl else None
        if use_index_time:
            row["_index_time"] = int(work["_index_time"].max()) + i
            row["periode"] = f"T+{i}"
        else:
            date_future = t0 + pd.Timedelta(days=int(t_future))
            row[str(time_col)] = date_future.strftime("%d-%m-%Y")
        future_rows.append(row)

    hist = work.drop(columns=["_t"], errors="ignore").copy()
    hist["_forecast"] = False
    forecast_df = pd.DataFrame(future_rows)
    combined = pd.concat([hist, forecast_df], ignore_index=True, sort=False)

    trend = "hausse" if slope > 0 else "baisse" if slope < 0 else "stable"

    return {
        "mode": "forecast",
        "timeColumn": time_col if not use_index_time else None,
        "valueColumn": value_column,
        "horizon": horizon,
        "trend": trend,
        "slopePerDay": round(slope, 6) if not use_index_time else round(slope, 6),
        "predictions": combined,
        "method": "index_trend" if use_index_time else "linear_trend_encoded",
        "encodingNote": "Valeurs catégorielles encodées pour la tendance." if value_map else None,
    }


def run_prediction(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    mode = (config.get("mode") or "regression").lower()
    target = (config.get("targetColumn") or "").strip() or _auto_target_column(df, None)
    feats = _parse_feature_list(config.get("featureColumns") or config.get("features"))
    if feats:
        feats = [f for f in feats if f != target]

    if mode == "forecast":
        time_col = (config.get("timeColumn") or "").strip() or None
        horizon = int(config.get("horizon") or 5)
        result = forecast_timeseries(df, target, time_column=time_col, horizon=horizon)
    else:
        result = predict_regression(df, target, feature_columns=feats)

    out = result["predictions"].copy()
    out["_predict_mode"] = result["mode"]
    out["_predict_method"] = result["method"]
    if result.get("encodingNote"):
        out["_predict_encoding"] = result["encodingNote"]
    if "metrics" in result:
        mae = result["metrics"].get("testMae") or result["metrics"].get("trainMae")
        out["_predict_mae"] = mae
    if "trend" in result:
        out["_forecast_trend"] = result["trend"]
    return out
