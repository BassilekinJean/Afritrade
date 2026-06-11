"""Analyse causale simplifiée pour données agricoles multi-sources."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from .errors import PipelineError


def _pick_numeric_columns(df: pd.DataFrame, exclude: Optional[List[str]] = None) -> List[str]:
    ex = set(exclude or [])
    cols: List[str] = []
    for c in df.columns:
        if c in ex:
            continue
        if pd.api.types.is_numeric_dtype(df[c]):
            cols.append(str(c))
        else:
            converted = pd.to_numeric(df[c], errors="coerce")
            if converted.notna().sum() >= max(3, len(df) * 0.3):
                cols.append(str(c))
    return cols


def _encode_column_for_analysis(series: pd.Series) -> pd.Series:
    """Convertit une colonne en nombres : valeurs numériques ou encodage catégoriel."""
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce")
    as_num = pd.to_numeric(series.astype(str).str.replace(",", ".", regex=False), errors="coerce")
    if as_num.notna().sum() >= max(3, len(series) * 0.2):
        return as_num
    # Texte / catégories → codes numériques (ex. « Négatif » → 0, « Positif » → 1)
    codes, _ = pd.factorize(series.astype(str).str.strip())
    return pd.Series(codes, index=series.index, dtype=float)


def _find_time_column(df: pd.DataFrame, hint: Optional[str] = None) -> Optional[str]:
    if hint and hint in df.columns:
        parsed = pd.to_datetime(df[hint], dayfirst=True, errors="coerce")
        if parsed.notna().sum() >= max(3, len(df) * 0.2):
            return hint
    for c in df.columns:
        cl = str(c).lower()
        if any(k in cl for k in ("date", "jour", "mois", "annee", "année", "time", "timestamp", "saison")):
            parsed = pd.to_datetime(df[c], dayfirst=True, errors="coerce")
            if parsed.notna().sum() >= max(3, len(df) * 0.2):
                return str(c)
    return None


def _valid_time_column(df: pd.DataFrame, hint: Optional[str]) -> Optional[str]:
    if not hint or hint not in df.columns:
        return _find_time_column(df, None)
    parsed = pd.to_datetime(df[hint], dayfirst=True, errors="coerce")
    if parsed.notna().sum() >= max(3, len(df) * 0.2):
        return hint
    return _find_time_column(df, None)


def _auto_target_column(df: pd.DataFrame, hint: Optional[str] = None) -> str:
    """Choisit une colonne cible numérique si non configurée."""
    if hint and str(hint).strip() and hint in df.columns:
        return str(hint)
    numeric = _pick_numeric_columns(df)
    if numeric:
        # Préférer noms métier agricoles
        for key in ("rendement", "prix", "valeur", "score", "montant", "quantite", "production", "volume"):
            for col in numeric:
                if key in str(col).lower():
                    return col
        return numeric[0]
    # Dernière colonne non-id
    for col in reversed(list(df.columns)):
        cl = str(col).lower()
        if cl not in ("id", "_agri_domain", "_agri_confidence") and not cl.startswith("_"):
            return str(col)
    raise PipelineError(
        "Indiquez targetColumn (variable cible). Aucune colonne numérique détectée — "
        "choisissez une colonne dans la configuration du nœud."
    )


def _parse_feature_list(raw: Any) -> Optional[List[str]]:
    if raw is None:
        return None
    if isinstance(raw, list):
        return [str(x).strip() for x in raw if str(x).strip()]
    if isinstance(raw, str):
        return [f.strip() for f in raw.split(",") if f.strip()]
    return None


def analyze_causal(
    df: pd.DataFrame,
    target_column: str,
    feature_columns: Optional[List[str]] = None,
    time_column: Optional[str] = None,
    max_lag: int = 3,
) -> Dict[str, Any]:
    """Corrélations, liens causaux plausibles et analyse de retard temporel."""
    if df is None or df.empty:
        raise PipelineError("Jeu de données vide pour l'analyse causale.")
    target_column = _auto_target_column(df, target_column)

    if target_column not in df.columns:
        raise PipelineError(f"Colonne cible introuvable : {target_column}")

    work = df.copy()
    feature_columns = _parse_feature_list(feature_columns)
    features = feature_columns or [
        str(c) for c in work.columns
        if str(c) != target_column and not str(c).startswith("_")
    ]
    features = [f for f in features if f != target_column and f in work.columns]
    if not features:
        raise PipelineError(
            "Aucune variable explicative. Choisissez 1 à 3 colonnes différentes de la cible "
            "(ex. evolution_marche_agricole, entites_intervenantes)."
        )

    for col in features + [target_column]:
        work[col] = _encode_column_for_analysis(work[col])

    work = work.dropna(subset=[target_column])
    if len(work) < 3:
        raise PipelineError(
            f"Pas assez de lignes valides pour « {target_column} » (min. 3). "
            f"Cette colonne est peut-être vide ou mal choisie — essayez une autre variable cible."
        )

    target = work[target_column]
    links: List[Dict[str, Any]] = []

    for feat in features:
        if feat == target_column or feat not in work.columns:
            continue
        series = work[feat].dropna()
        aligned = work[[feat, target_column]].dropna()
        if len(aligned) < 3:
            continue
        corr = float(aligned[feat].corr(aligned[target_column]))
        if np.isnan(corr):
            continue

        strength = abs(corr)
        direction = "positive" if corr > 0 else "negative"
        causal_score = strength
        lag_hint = None
        granger_note = None

        time_col = _valid_time_column(work, time_column)
        if time_col:
            ordered = work.sort_values(time_col)
            lag_corr = _lag_correlation(ordered[feat], ordered[target_column], max_lag=max_lag)
            if lag_corr:
                best_lag, best_corr = lag_corr
                lag_hint = f"Retard {best_lag} période(s), corr={round(best_corr, 3)}"
                if best_lag > 0 and abs(best_corr) > strength:
                    causal_score = abs(best_corr)
                    granger_note = (
                        f"{feat} précède {target_column} (hypothèse causale temporelle, lag={best_lag})"
                    )

        links.append({
            "feature": feat,
            "target": target_column,
            "correlation": round(corr, 4),
            "absCorrelation": round(strength, 4),
            "direction": direction,
            "causalScore": round(causal_score, 4),
            "lagHint": lag_hint,
            "grangerNote": granger_note,
            "interpretation": _interpret_link(feat, target_column, corr, granger_note),
        })

    links.sort(key=lambda x: x["causalScore"], reverse=True)

    matrix_cols = [target_column] + [l["feature"] for l in links[:8]]
    matrix_cols = list(dict.fromkeys(matrix_cols))
    corr_matrix = work[matrix_cols].corr().round(4).replace({np.nan: None}).to_dict()

    return {
        "targetColumn": target_column,
        "featureCount": len(links),
        "timeColumn": _valid_time_column(work, time_column),
        "encodingNote": "Les colonnes texte sont converties en codes numériques pour calculer les corrélations.",
        "causalLinks": links,
        "topDrivers": links[:5],
        "correlationMatrix": corr_matrix,
        "method": "correlation + lag analysis",
        "theme": "Analyse causale agricole",
    }


def _lag_correlation(cause: pd.Series, effect: pd.Series, max_lag: int = 3) -> Optional[tuple[int, float]]:
    best: Optional[tuple[int, float]] = None
    for lag in range(0, max_lag + 1):
        if lag == 0:
            c, e = cause, effect
        else:
            c = cause.shift(lag)
            e = effect
        pair = pd.concat([c, e], axis=1).dropna()
        if len(pair) < 3:
            continue
        corr = float(pair.iloc[:, 0].corr(pair.iloc[:, 1]))
        if np.isnan(corr):
            continue
        if best is None or abs(corr) > abs(best[1]):
            best = (lag, corr)
    return best


def _interpret_link(feat: str, target: str, corr: float, granger: Optional[str]) -> str:
    if granger:
        return granger
    if abs(corr) >= 0.7:
        return f"Fort lien entre « {feat} » et « {target} » — candidat causal prioritaire."
    if abs(corr) >= 0.4:
        return f"Lien modéré : « {feat} » pourrait influencer « {target} »."
    return f"Lien faible — à confirmer avec d'autres sources ou variables."


def causal_analysis_to_dataframe(report: Dict[str, Any]) -> pd.DataFrame:
    """Convertit le rapport causal en DataFrame (sortie nœud ETL)."""
    rows = report.get("causalLinks") or []
    if not rows:
        return pd.DataFrame([{"message": "Aucun lien causal détecté"}])
    return pd.DataFrame(rows)


def multi_source_causal(
    sources: List[Dict[str, Any]],
    datasets: Dict[str, str],
    target_column: str,
    join_column: Optional[str] = None,
) -> Dict[str, Any]:
    """Fusionne plusieurs sources puis analyse causale."""
    from .extract import EXTRACTORS

    frames: List[pd.DataFrame] = []
    labels: List[str] = []
    for src in sources:
        ntype = src.get("type") or ""
        cfg = src.get("config") or {}
        label = src.get("label") or src.get("id") or "source"
        if ntype not in EXTRACTORS:
            continue
        df = EXTRACTORS[ntype](cfg, datasets).copy()
        df["_source"] = label
        frames.append(df)
        labels.append(label)

    if not frames:
        raise PipelineError("Aucune source valide pour l'analyse multi-sources.")

    if len(frames) == 1:
        merged = frames[0]
    elif join_column:
        merged = frames[0]
        for other in frames[1:]:
            if join_column in merged.columns and join_column in other.columns:
                merged = merged.merge(other, on=join_column, how="outer", suffixes=("", "_b"))
            else:
                merged = pd.concat([merged, other], ignore_index=True, sort=False)
    else:
        merged = pd.concat(frames, ignore_index=True, sort=False)

    report = analyze_causal(merged, target_column=target_column)
    report["mergedSources"] = labels
    report["mergedRowCount"] = int(len(merged))
    return report
