"""Moteur d'exécution ETL pour DataPipe.

Le pipeline est décrit par un graphe nodal (nodes + edges). Chaque node produit
un DataFrame pandas qui est transmis aux nodes suivants via les arêtes.

L'exécution se fait par tri topologique : un node n'est exécuté qu'une fois que
tous ses parents ont produit leur résultat.
"""

from __future__ import annotations

import io
import json
from collections import defaultdict, deque
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy import create_engine, text


class PipelineError(Exception):
    """Erreur métier renvoyée proprement au client."""


# --------------------------------------------------------------------------- #
#  Chargement des sources
# --------------------------------------------------------------------------- #
def _load_csv(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    raw = _resolve_content(config, datasets)
    if raw is None:
        raise PipelineError("Source CSV vide : importez un fichier ou collez du contenu.")
    delimiter = config.get("delimiter") or ","
    try:
        return pd.read_csv(io.StringIO(raw), sep=delimiter)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Lecture CSV impossible : {exc}") from exc


def _load_json(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    raw = _resolve_content(config, datasets)
    if raw is None:
        raise PipelineError("Source JSON vide : importez un fichier ou collez du contenu.")
    try:
        parsed = json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"JSON invalide : {exc}") from exc
    if isinstance(parsed, dict):
        # Cherche la première liste imbriquée, sinon normalise le dict seul.
        for value in parsed.values():
            if isinstance(value, list):
                return pd.json_normalize(value)
        return pd.json_normalize(parsed)
    return pd.json_normalize(parsed)


def _load_sql(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    conn = (config.get("connectionString") or "").strip()
    query = (config.get("query") or "").strip()
    if not conn:
        raise PipelineError("Chaîne de connexion SQL manquante.")
    if not query:
        raise PipelineError("Requête SQL manquante.")
    try:
        engine = create_engine(conn)
        with engine.connect() as connection:
            return pd.read_sql(text(query), connection)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Connexion / requête SQL échouée : {exc}") from exc


def _resolve_content(config: Dict[str, Any], datasets: Dict[str, str]) -> Optional[str]:
    """Récupère le contenu brut, soit inline, soit via un dataset uploadé."""
    dataset_id = config.get("datasetId")
    if dataset_id and dataset_id in datasets:
        return datasets[dataset_id]
    content = config.get("content")
    if content:
        return content
    return None


# --------------------------------------------------------------------------- #
#  Transformations
# --------------------------------------------------------------------------- #
def _t_filter(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    expr = (config.get("expression") or "").strip()
    if not expr:
        return df
    try:
        return df.query(expr)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Filtre invalide « {expr} » : {exc}") from exc


def _t_select(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    cols = config.get("columns") or []
    if not cols:
        return df
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise PipelineError(f"Colonnes introuvables : {', '.join(missing)}")
    return df[cols]


def _t_rename(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    mapping = config.get("mapping") or {}
    if not mapping:
        return df
    return df.rename(columns=mapping)


def _t_sort(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
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


def _t_aggregate(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    group_by = config.get("groupBy") or []
    aggregations = config.get("aggregations") or {}
    if not aggregations:
        raise PipelineError("Définissez au moins une agrégation (ex: amount -> sum).")
    try:
        if group_by:
            grouped = df.groupby(group_by, dropna=False).agg(aggregations)
            return grouped.reset_index()
        # Agrégation globale sans clé de regroupement.
        result = {col: df[col].agg(func) for col, func in aggregations.items()}
        return pd.DataFrame([result])
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Agrégation impossible : {exc}") from exc


def _t_dedupe(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    subset = config.get("columns") or None
    return df.drop_duplicates(subset=subset)


def _t_custom(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    code = config.get("code") or ""
    if not code.strip():
        return df
    return run_pandas_code(code, df)


def _t_sql(df: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    """Exécute une requête SQL sur le DataFrame d'entrée (table « input »)."""
    query = (config.get("query") or "").strip()
    if not query:
        return df
    try:
        engine = create_engine("sqlite://")  # base en mémoire
        df.to_sql("input", engine, index=False, if_exists="replace")
        with engine.connect() as connection:
            return pd.read_sql(text(query), connection)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"SQL invalide : {exc}") from exc


def _t_join(left: pd.DataFrame, right: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    how = config.get("how") or "inner"
    on = config.get("on")
    try:
        if on:
            return left.merge(right, how=how, on=on)
        return left.merge(right, how=how, left_index=True, right_index=True)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Jointure impossible : {exc}") from exc


def run_pandas_code(code: str, df: pd.DataFrame) -> pd.DataFrame:
    """Exécute du code pandas généré/écrit par l'utilisateur.

    Convention : le code reçoit un DataFrame `df` et doit réassigner `df`
    (ou définir `result`). Environnement restreint pour limiter les dégâts.
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
        raise PipelineError(
            "Le code doit produire un DataFrame dans la variable `df` (ou `result`)."
        )
    return result


SOURCE_LOADERS = {
    "source_csv": _load_csv,
    "source_json": _load_json,
    "source_sql": _load_sql,
}

SINGLE_INPUT_TRANSFORMS = {
    "filter": _t_filter,
    "select": _t_select,
    "rename": _t_rename,
    "sort": _t_sort,
    "aggregate": _t_aggregate,
    "dedupe": _t_dedupe,
    "custom": _t_custom,
    "sql": _t_sql,
    "output": lambda df, _config: df,
}


# --------------------------------------------------------------------------- #
#  Orchestration du graphe
# --------------------------------------------------------------------------- #
def execute_graph(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    datasets: Dict[str, str],
    max_preview_rows: int = 100,
) -> Dict[str, Any]:
    """Exécute le graphe et renvoie un aperçu par node + le résultat final."""
    nodes_by_id = {n["id"]: n for n in nodes}

    # Construit la liste des parents (inputs) de chaque node.
    parents: Dict[str, List[str]] = defaultdict(list)
    children: Dict[str, List[str]] = defaultdict(list)
    indegree: Dict[str, int] = {n["id"]: 0 for n in nodes}
    for edge in edges:
        src, tgt = edge["source"], edge["target"]
        if src not in nodes_by_id or tgt not in nodes_by_id:
            continue
        parents[tgt].append(src)
        children[src].append(tgt)
        indegree[tgt] += 1

    # Tri topologique (Kahn).
    queue = deque([nid for nid, deg in indegree.items() if deg == 0])
    order: List[str] = []
    while queue:
        nid = queue.popleft()
        order.append(nid)
        for child in children[nid]:
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)

    if len(order) != len(nodes):
        raise PipelineError("Le pipeline contient un cycle : impossible de l'exécuter.")

    results: Dict[str, pd.DataFrame] = {}
    previews: Dict[str, Any] = {}

    for nid in order:
        node = nodes_by_id[nid]
        ntype = node.get("type", "")
        config = node.get("data", {}).get("config", {}) or {}
        parent_frames = [results[p] for p in parents[nid] if p in results]

        try:
            if ntype in SOURCE_LOADERS:
                df = SOURCE_LOADERS[ntype](config, datasets)
            elif ntype == "join":
                if len(parent_frames) < 2:
                    raise PipelineError("Une jointure nécessite deux entrées connectées.")
                df = _t_join(parent_frames[0], parent_frames[1], config)
            elif ntype in SINGLE_INPUT_TRANSFORMS:
                if not parent_frames:
                    raise PipelineError("Ce node n'a aucune entrée connectée.")
                df = SINGLE_INPUT_TRANSFORMS[ntype](parent_frames[0], config)
            else:
                raise PipelineError(f"Type de node inconnu : {ntype}")
        except PipelineError as exc:
            previews[nid] = {"error": str(exc)}
            continue

        results[nid] = df
        previews[nid] = _frame_to_preview(df, max_preview_rows)

    # Détermine le résultat « final » (node output, sinon dernier node calculé).
    final_id = next(
        (nid for nid in reversed(order) if nodes_by_id[nid].get("type") == "output" and nid in results),
        None,
    )
    if final_id is None:
        final_id = next((nid for nid in reversed(order) if nid in results), None)

    return {
        "previews": previews,
        "finalNodeId": final_id,
        "final": previews.get(final_id) if final_id else None,
    }


def _frame_to_preview(df: pd.DataFrame, max_rows: int) -> Dict[str, Any]:
    """Sérialise un DataFrame en aperçu JSON-friendly."""
    head = df.head(max_rows)
    # Remplace NaN/inf par None pour rester JSON-compatible.
    safe = head.astype(object).where(pd.notnull(head), None)
    return {
        "columns": [str(c) for c in df.columns],
        "rows": safe.to_dict(orient="records"),
        "rowCount": int(len(df)),
        "truncated": bool(len(df) > max_rows),
        "dtypes": {str(c): str(t) for c, t in df.dtypes.items()},
    }
