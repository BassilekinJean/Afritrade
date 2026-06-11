"""Phase TRANSFORM de l'ETL.

Implémente toutes les transformations exposées par le frontend :

    filter    -> filtrage de lignes (syntaxe pandas query)
    select    -> sélection de colonnes
    rename    -> renommage de colonnes
    sort      -> tri
    aggregate -> regroupement + agrégations (sum, mean, count, min, max, std...)
    dedupe    -> suppression des doublons
    sql       -> requête SQL exécutée sur l'entrée (table « input »)
    custom    -> code pandas personnalisé (sandbox restreinte)
    join      -> jointure de deux entrées (inner / left / right / outer)

Chaque transformation est une fonction pure `(df, config) -> df` (ou
`(left, right, config) -> df` pour la jointure), ce qui les rend testables et
exécutables en parallèle sans effet de bord partagé.
"""

from __future__ import annotations

from typing import Any, Dict, List

import pandas as pd
from sqlalchemy import create_engine, text

from .errors import PipelineError


# --------------------------------------------------------------------------- #
#  Transformations à une entrée
# --------------------------------------------------------------------------- #
def t_filter(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    expr = (config.get("expression") or "").strip()
    if not expr:
        return df
    try:
        return df.query(expr)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Filtre invalide « {expr} » : {exc}") from exc


def t_select(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    cols = config.get("columns") or []
    if not cols:
        return df
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise PipelineError(f"Colonnes introuvables : {', '.join(missing)}")
    return df[cols]


def t_rename(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    mapping = config.get("mapping") or {}
    if not mapping:
        return df
    return df.rename(columns=mapping)


def t_sort(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    by = config.get("by")
    if not by:
        return df
    ascending = config.get("ascending", True)
    if isinstance(by, str):
        by = [by]
    missing = [c for c in by if c not in df.columns]
    if missing:
        raise PipelineError(f"Colonnes de tri introuvables : {', '.join(missing)}")
    return df.sort_values(by=by, ascending=ascending)


def t_aggregate(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    group_by = config.get("groupBy") or []
    aggregations = config.get("aggregations") or {}
    if not aggregations:
        raise PipelineError("Définissez au moins une agrégation (ex : montant -> sum).")
    missing = [c for c in list(group_by) + list(aggregations) if c not in df.columns]
    if missing:
        raise PipelineError(f"Colonnes d'agrégation introuvables : {', '.join(missing)}")
    try:
        if group_by:
            grouped = df.groupby(group_by, dropna=False).agg(aggregations)
            return grouped.reset_index()
        result = {col: df[col].agg(func) for col, func in aggregations.items()}
        return pd.DataFrame([result])
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Agrégation impossible : {exc}") from exc


def t_dedupe(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    subset = config.get("columns") or None
    if subset:
        missing = [c for c in subset if c not in df.columns]
        if missing:
            raise PipelineError(f"Clés de déduplication introuvables : {', '.join(missing)}")
    return df.drop_duplicates(subset=subset)


def t_sql(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    """Exécute une requête SQL sur l'entrée (exposée comme la table « input »)."""
    query = (config.get("query") or "").strip()
    if not query:
        return df
    try:
        engine = create_engine("sqlite://")  # base en mémoire, isolée
        df.to_sql("input", engine, index=False, if_exists="replace")
        with engine.connect() as connection:
            return pd.read_sql(text(query), connection)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"SQL invalide : {exc}") from exc


def t_custom(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    code = config.get("code") or ""
    if not code.strip():
        return df
    return run_pandas_code(code, df)


# --------------------------------------------------------------------------- #
#  Transformation à deux entrées : jointure
# --------------------------------------------------------------------------- #
def t_join(left: pd.DataFrame, right: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    how = config.get("how") or "inner"
    on = config.get("on")
    left_on = config.get("leftOn")
    right_on = config.get("rightOn")
    try:
        if on:
            return left.merge(right, how=how, on=on)
        if left_on and right_on:
            return left.merge(right, how=how, left_on=left_on, right_on=right_on)
        return left.merge(right, how=how, left_index=True, right_index=True)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Jointure impossible : {exc}") from exc


def t_lookup(left: pd.DataFrame, right: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    """Enrichissement par table de référence (lookup Talend)."""
    cfg = {**config, "how": config.get("how") or "left"}
    return t_join(left, right, cfg)


def t_union(frames: List[pd.DataFrame], config: Dict[str, Any]) -> pd.DataFrame:
    """Empile plusieurs flux (append / union)."""
    if len(frames) < 2:
        raise PipelineError("L'union nécessite au moins deux entrées connectées.")
    ignore_index = bool(config.get("ignoreIndex", True))
    try:
        return pd.concat(frames, ignore_index=ignore_index, sort=False)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Union impossible : {exc}") from exc


def t_cast(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    """Conversion de types de colonnes."""
    casts = config.get("casts") or config.get("mapping") or {}
    if not casts:
        return df
    out = df.copy()
    for col, target in casts.items():
        if col not in out.columns:
            raise PipelineError(f"Colonne introuvable pour cast : {col}")
        t = str(target).lower()
        try:
            if t in ("int", "integer"):
                out[col] = pd.to_numeric(out[col], errors="coerce").astype("Int64")
            elif t in ("float", "number", "decimal"):
                out[col] = pd.to_numeric(out[col], errors="coerce")
            elif t in ("str", "text", "string"):
                out[col] = out[col].astype(str)
            elif t in ("bool", "boolean"):
                out[col] = out[col].astype(str).str.lower().isin(("1", "true", "oui", "yes"))
            elif t in ("date", "datetime"):
                out[col] = pd.to_datetime(out[col], dayfirst=True, errors="coerce")
            else:
                raise PipelineError(f"Type cible inconnu : {target}")
        except PipelineError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise PipelineError(f"Cast {col} → {target} impossible : {exc}") from exc
    return out


def t_split(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    """Découpe une colonne texte en plusieurs colonnes."""
    column = (config.get("column") or "").strip()
    delimiter = config.get("delimiter") or ","
    if not column or column not in df.columns:
        raise PipelineError("Indiquez une colonne à découper.")
    max_cols = int(config.get("maxColumns") or 10)
    prefix = config.get("prefix") or f"{column}_"
    try:
        expanded = df[column].astype(str).str.split(delimiter, expand=True, n=max_cols - 1)
        expanded.columns = [f"{prefix}{i + 1}" for i in range(len(expanded.columns))]
        return pd.concat([df.drop(columns=[column]), expanded], axis=1)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Découpe impossible : {exc}") from exc


def t_pivot(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    """Table croisée dynamique."""
    index = config.get("index") or config.get("rows")
    columns = config.get("columns") or config.get("pivotColumn")
    values = config.get("values") or config.get("valueColumn")
    agg = config.get("aggfunc") or "sum"
    if not index or not columns or not values:
        raise PipelineError("Pivot : indiquez index, columns et values.")
    if isinstance(index, str):
        index = [index]
    for name in list(index) + [columns, values]:
        if name not in df.columns:
            raise PipelineError(f"Colonne pivot introuvable : {name}")
    try:
        pivoted = df.pivot_table(index=index, columns=columns, values=values, aggfunc=agg, fill_value=0)
        return pivoted.reset_index()
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Pivot impossible : {exc}") from exc


def t_validate(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    from .validate import validate_dataframe

    validated, _report = validate_dataframe(df, config)
    return validated


def t_http_request(_df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    """Ignore l'entrée amont ; exécute une requête HTTP sortante."""
    from .http_action import http_request_to_dataframe

    return http_request_to_dataframe(config)


def t_branch(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    """Nœud de branchement : le moteur gère les sorties true/false via sourceHandle."""
    expr = (config.get("expression") or "").strip()
    if not expr:
        return df
    try:
        return df.query(expr)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Condition de branche invalide « {expr} » : {exc}") from exc


# --------------------------------------------------------------------------- #
#  Sandbox pandas pour le code personnalisé / généré par l'IA
# --------------------------------------------------------------------------- #
def run_pandas_code(code: str, df: pd.DataFrame) -> pd.DataFrame:
    """Exécute du code pandas dans un environnement restreint.

    Convention : le DataFrame d'entrée est `df` ; le code doit réassigner `df`
    (ou définir `result`). Les imports et I/O sont volontairement indisponibles.
    """
    safe_globals: Dict[str, Any] = {
        "pd": pd,
        "__builtins__": {
            "len": len, "range": range, "min": min, "max": max, "sum": sum,
            "abs": abs, "round": round, "str": str, "int": int, "float": float,
            "bool": bool, "list": list, "dict": dict, "set": set, "tuple": tuple,
            "sorted": sorted, "enumerate": enumerate, "zip": zip, "map": map,
            "filter": filter, "any": any, "all": all, "print": print,
        },
    }
    local_env: Dict[str, Any] = {"df": df.copy()}
    try:
        exec(code, safe_globals, local_env)  # noqa: S102
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Erreur d'exécution du code : {exc}") from exc

    result = local_env.get("result", local_env.get("df"))
    if not isinstance(result, pd.DataFrame):
        raise PipelineError("Le code doit produire un DataFrame dans `df` (ou `result`).")
    return result


# Aiguillage type de node -> fonction de transformation (une entrée).
SINGLE_INPUT_TRANSFORMS = {
    "filter": t_filter,
    "select": t_select,
    "rename": t_rename,
    "sort": t_sort,
    "aggregate": t_aggregate,
    "dedupe": t_dedupe,
    "sql": t_sql,
    "custom": t_custom,
    "cast": t_cast,
    "split": t_split,
    "pivot": t_pivot,
    "validate": t_validate,
    "http_request": t_http_request,
    "branch": t_branch,
    "output": lambda df, _config: df,
}

# Transformations nécessitant deux entrées.
MULTI_INPUT_TRANSFORMS = {
    "join": t_join,
    "lookup": t_lookup,
}

# Transformations acceptant N entrées (union).
N_INPUT_TRANSFORMS = {
    "union": t_union,
}


def list_supported_transforms() -> List[str]:
    return list(SINGLE_INPUT_TRANSFORMS) + list(MULTI_INPUT_TRANSFORMS) + list(N_INPUT_TRANSFORMS)
