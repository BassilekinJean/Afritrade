"""Orchestrateur ETL de DataPipe.

Reçoit un graphe nodal (nodes + edges) et l'exécute selon le cycle ETL :

    EXTRACT      sources -> couche RAW (données brutes en base tampon)
    STANDARDIZE  RAW     -> couche CLEAN (formats harmonisés : dates JJ-MM-AAAA…)
    TRANSFORM    CLEAN   -> couche CLEAN (filtres, jointures, agrégations…)
    LOAD         CLEAN   -> couche WAREHOUSE (résultat final matérialisé)

Exécution PARALLÈLE : le graphe est découpé en « niveaux » topologiques. Tous
les nodes d'un même niveau (donc indépendants entre eux) sont exécutés
simultanément via un pool de threads. Le niveau N+1 n'est lancé qu'une fois le
niveau N terminé, garantissant que chaque node dispose de ses entrées.

Le moteur reste compatible avec le contrat d'API existant : il renvoie
`{previews, finalNodeId, final}` enrichi d'un bloc `etl` (résumé, ignoré par
l'ancien front mais exploitable pour la traçabilité / la démo).
"""

from __future__ import annotations

import math
import time
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from . import config
from .errors import PipelineError
from .extract import EXTRACTORS
from .staging import Layer, store
from .standardize import standardize
from .transform import MULTI_INPUT_TRANSFORMS, N_INPUT_TRANSFORMS, SINGLE_INPUT_TRANSFORMS


@dataclass
class BranchFrames:
    """Sorties d'un nœud de branchement conditionnel (style n8n IF)."""
    true_df: pd.DataFrame
    false_df: pd.DataFrame


NodeFrame = pd.DataFrame | BranchFrames


@dataclass
class NodeResult:
    node_id: str
    phase: str
    frame: Optional[pd.DataFrame] = None
    branch: Optional[BranchFrames] = None
    preview: Dict[str, Any] = field(default_factory=dict)
    staged: Dict[str, str] = field(default_factory=dict)
    error: Optional[str] = None
    duration_ms: float = 0.0


# --------------------------------------------------------------------------- #
#  Classification des nodes par phase ETL
# --------------------------------------------------------------------------- #
def _phase_of(ntype: str) -> str:
    if ntype in EXTRACTORS or ntype.startswith("trigger_"):
        return "extract"
    if ntype == "output":
        return "load"
    if ntype in MULTI_INPUT_TRANSFORMS or ntype in SINGLE_INPUT_TRANSFORMS or ntype in N_INPUT_TRANSFORMS:
        return "transform"
    return "unknown"


# --------------------------------------------------------------------------- #
#  Construction du graphe et des niveaux topologiques
# --------------------------------------------------------------------------- #
def _build_levels(
    nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]
) -> tuple[Dict[str, List[str]], Dict[str, Dict[str, str]], List[List[str]]]:
    nodes_by_id = {n["id"]: n for n in nodes}
    parents: Dict[str, List[str]] = defaultdict(list)
    children: Dict[str, List[str]] = defaultdict(list)
    edge_handles: Dict[str, Dict[str, str]] = defaultdict(dict)
    indegree: Dict[str, int] = {n["id"]: 0 for n in nodes}

    for edge in edges:
        src, tgt = edge.get("source"), edge.get("target")
        if src not in nodes_by_id or tgt not in nodes_by_id:
            continue
        parents[tgt].append(src)
        children[src].append(tgt)
        handle = edge.get("sourceHandle") or (edge.get("data") or {}).get("sourceHandle") or "true"
        edge_handles[tgt][src] = str(handle)
        indegree[tgt] += 1

    # Tri topologique de Kahn + calcul du niveau (plus long chemin depuis une racine).
    queue = deque([nid for nid, deg in indegree.items() if deg == 0])
    level: Dict[str, int] = {nid: 0 for nid in queue}
    order: List[str] = []
    while queue:
        nid = queue.popleft()
        order.append(nid)
        for child in children[nid]:
            level[child] = max(level.get(child, 0), level[nid] + 1)
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)

    if len(order) != len(nodes):
        raise PipelineError("Le pipeline contient un cycle : impossible de l'exécuter.")

    grouped: Dict[int, List[str]] = defaultdict(list)
    for nid in order:
        grouped[level.get(nid, 0)].append(nid)
    levels = [grouped[k] for k in sorted(grouped)]
    return parents, dict(edge_handles), levels


def _resolve_parent_frame(
    parent_id: str,
    child_id: str,
    parent_result: NodeFrame,
    edge_handles: Dict[str, Dict[str, str]],
) -> Optional[pd.DataFrame]:
    if isinstance(parent_result, BranchFrames):
        handle = edge_handles.get(child_id, {}).get(parent_id, "true")
        return parent_result.false_df if handle == "false" else parent_result.true_df
    if isinstance(parent_result, pd.DataFrame):
        return parent_result
    return None


# --------------------------------------------------------------------------- #
#  Exécution d'un node
# --------------------------------------------------------------------------- #
def _execute_node(
    node: Dict[str, Any],
    parent_frames: List[pd.DataFrame],
    datasets: Dict[str, str],
    max_preview_rows: int,
) -> NodeResult:
    nid = node["id"]
    ntype = node.get("type", "")
    cfg = (node.get("data", {}) or {}).get("config", {}) or {}
    phase = _phase_of(ntype)
    started = time.perf_counter()
    res = NodeResult(node_id=nid, phase=phase)

    try:
        if ntype in EXTRACTORS:
            # EXTRACT -> RAW
            raw = EXTRACTORS[ntype](cfg, datasets)
            res.staged["raw"] = store.write(Layer.RAW, f"{config.RAW_PREFIX}_{nid}", raw)
            # STANDARDIZE -> CLEAN
            norm_opts = cfg.get("normalizeOptions") or {}
            clean, report = standardize(
                raw,
                drop_empty_rows=norm_opts.get("dropEmptyRows", True),
                drop_null_column_pct=float(norm_opts.get("dropNullColumnPct") or 0),
                fill_numeric_nulls=str(norm_opts.get("fillNumericNulls") or "none"),
                drop_duplicates=bool(norm_opts.get("dropDuplicates")),
            )
            res.staged["clean"] = store.write(Layer.CLEAN, f"{config.CLEAN_PREFIX}_{nid}", clean)
            res.frame = clean
            res.preview = _frame_to_preview(clean, max_preview_rows)
            res.preview["standardization"] = report.as_dict()

        elif ntype in MULTI_INPUT_TRANSFORMS:
            if len(parent_frames) < 2:
                raise PipelineError("Cette transformation nécessite deux entrées connectées.")
            df = MULTI_INPUT_TRANSFORMS[ntype](parent_frames[0], parent_frames[1], cfg)
            res.staged["work"] = store.write(Layer.CLEAN, f"{config.WORK_PREFIX}_{nid}", df)
            res.frame = df
            res.preview = _frame_to_preview(df, max_preview_rows)

        elif ntype in N_INPUT_TRANSFORMS:
            if len(parent_frames) < 2:
                raise PipelineError("Cette transformation nécessite au moins deux entrées connectées.")
            df = N_INPUT_TRANSFORMS[ntype](parent_frames, cfg)
            res.staged["work"] = store.write(Layer.CLEAN, f"{config.WORK_PREFIX}_{nid}", df)
            res.frame = df
            res.preview = _frame_to_preview(df, max_preview_rows)

        elif ntype == "branch":
            if not parent_frames:
                raise PipelineError("Le branchement conditionnel nécessite une entrée.")
            df_in = parent_frames[0]
            expr = (cfg.get("expression") or "").strip()
            if expr:
                true_df = df_in.query(expr)
                false_df = df_in.drop(true_df.index)
            else:
                true_df, false_df = df_in, df_in.iloc[0:0].copy()
            res.frame = true_df
            res.preview = _frame_to_preview(true_df, max_preview_rows)
            res.preview["branch"] = {
                "trueCount": int(len(true_df)),
                "falseCount": int(len(false_df)),
                "expression": expr,
            }
            res.staged["work"] = store.write(Layer.CLEAN, f"{config.WORK_PREFIX}_{nid}_true", true_df)
            res.branch = BranchFrames(true_df=true_df, false_df=false_df)

        elif ntype == "output":
            # LOAD -> WAREHOUSE (+ métadonnées d'export)
            if not parent_frames:
                raise PipelineError("Le node de sortie n'a aucune entrée connectée.")
            df = parent_frames[0]
            res.staged["warehouse"] = store.write(Layer.WAREHOUSE, f"{config.GOLD_PREFIX}_{nid}", df)
            res.frame = df
            res.preview = _frame_to_preview(df, max_preview_rows)
            from .export_fmt import export_preview_meta

            out_fmt = (cfg.get("format") or "csv").lower()
            res.preview["export"] = export_preview_meta(df, out_fmt)
            res.preview["export"]["filename"] = cfg.get("filename") or "resultat"
            res.preview["export"]["tableName"] = cfg.get("tableName") or "dataset"

        elif ntype in SINGLE_INPUT_TRANSFORMS:
            if not parent_frames:
                raise PipelineError("Ce node n'a aucune entrée connectée.")
            df = SINGLE_INPUT_TRANSFORMS[ntype](parent_frames[0], cfg)
            res.staged["work"] = store.write(Layer.CLEAN, f"{config.WORK_PREFIX}_{nid}", df)
            res.frame = df
            res.preview = _frame_to_preview(df, max_preview_rows)

        else:
            raise PipelineError(f"Type de node inconnu : {ntype}")

    except PipelineError as exc:
        res.error = str(exc)
        res.preview = {"error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        res.error = f"Erreur inattendue : {exc}"
        res.preview = {"error": res.error}

    res.duration_ms = round((time.perf_counter() - started) * 1000, 2)
    res.preview["phase"] = phase
    if res.staged:
        res.preview["staged"] = res.staged
    return res


# --------------------------------------------------------------------------- #
#  Orchestration principale
# --------------------------------------------------------------------------- #
def execute_graph(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    datasets: Dict[str, str],
    max_preview_rows: int = 100,
) -> Dict[str, Any]:
    nodes_by_id = {n["id"]: n for n in nodes}
    if not nodes_by_id:
        return {"previews": {}, "finalNodeId": None, "final": None,
                "etl": {"levels": [], "phases": {}, "durationMs": 0}}

    parents, edge_handles, levels = _build_levels(nodes, edges)

    results: Dict[str, NodeFrame] = {}
    previews: Dict[str, Any] = {}
    order: List[str] = []
    total_started = time.perf_counter()
    level_report: List[Dict[str, Any]] = []

    for level_idx, level_nodes in enumerate(levels):
        runnable: List[Dict[str, Any]] = []
        for nid in level_nodes:
            order.append(nid)
            node = nodes_by_id[nid]
            parent_ids = parents.get(nid, [])
            # Un parent en échec coupe la branche.
            failed_parents = [p for p in parent_ids if p not in results and p in previews]
            if failed_parents:
                previews[nid] = {
                    "error": "Entrée en amont en échec : corrigez le node précédent.",
                    "phase": _phase_of(node.get("type", "")),
                }
                continue
            runnable.append(node)

        # Exécution parallèle de tous les nodes prêts de ce niveau.
        workers = max(1, min(config.MAX_WORKERS, len(runnable)))
        node_results: List[NodeResult] = []
        if runnable:
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futures = [
                    pool.submit(
                        _execute_node,
                        node,
                        [
                            _resolve_parent_frame(p, node["id"], results[p], edge_handles)
                            for p in parents.get(node["id"], [])
                            if p in results
                            and _resolve_parent_frame(p, node["id"], results[p], edge_handles) is not None
                        ],
                        datasets,
                        max_preview_rows,
                    )
                    for node in runnable
                ]
                node_results = [f.result() for f in futures]

        for nr in node_results:
            previews[nr.node_id] = nr.preview
            if nr.error is None:
                if nr.branch is not None:
                    results[nr.node_id] = nr.branch
                elif nr.frame is not None:
                    results[nr.node_id] = nr.frame

        level_report.append({
            "level": level_idx,
            "nodes": [n["id"] for n in runnable],
            "parallel": len(runnable),
        })

    final_id = next(
        (nid for nid in reversed(order)
         if nodes_by_id[nid].get("type") == "output" and nid in results
         and not isinstance(results[nid], BranchFrames)),
        None,
    )
    if final_id is None:
        final_id = next(
            (nid for nid in reversed(order) if nid in results and not isinstance(results[nid], BranchFrames)),
            None,
        )

    phases_count: Dict[str, int] = defaultdict(int)
    for nid in order:
        phases_count[_phase_of(nodes_by_id[nid].get("type", ""))] += 1

    return {
        "previews": previews,
        "finalNodeId": final_id,
        "final": previews.get(final_id) if final_id else None,
        "etl": {
            "levels": level_report,
            "maxParallel": max((lr["parallel"] for lr in level_report), default=0),
            "phases": dict(phases_count),
            "durationMs": round((time.perf_counter() - total_started) * 1000, 2),
            "staging": store.summary(),
        },
    }


# --------------------------------------------------------------------------- #
#  Aperçu immédiat d'un fichier source (sans exécuter tout le pipeline)
# --------------------------------------------------------------------------- #
def preview_source(
    content: str,
    kind: str,
    delimiter: Optional[str] = None,
    max_rows: int = 20,
    table: Optional[str] = None,
) -> Dict[str, Any]:
    """Extrait puis standardise un contenu de fichier et renvoie un aperçu.

    Utilisé par la route d'import pour montrer immédiatement à l'analyste les
    colonnes détectées, les types inférés et les premières lignes harmonisées
    (dates JJ-MM-AAAA, nombres normalisés), avant même de lancer le pipeline.
    """
    from .kind_detect import node_kind_for_source_kind

    kind_l = (kind or "").lower()
    cfg: Dict[str, Any] = {"content": content, "sourceKind": kind_l}
    if kind_l in ("sql", "sqlite"):
        ntype = "source_sql_file"
        if table:
            cfg["table"] = table
    elif kind_l == "json":
        ntype = "source_json"
    elif kind_l in ("excel", "pdf", "word", "txt", "markup"):
        ntype = node_kind_for_source_kind(kind_l)
    elif kind_l == "html":
        from .extract import _html_to_df

        raw = _html_to_df(content, "aperçu")
        clean, report = standardize(raw)
        preview = _frame_to_preview(clean, max_rows)
        preview["standardization"] = report.as_dict()
        return preview
    else:
        ntype = "source_csv"
        if delimiter:
            cfg["delimiter"] = delimiter

    raw = EXTRACTORS[ntype](cfg, {})
    clean, report = standardize(raw)
    preview = _frame_to_preview(clean, max_rows)
    preview["standardization"] = report.as_dict()
    return preview


# --------------------------------------------------------------------------- #
#  Sérialisation JSON-friendly d'un DataFrame
# --------------------------------------------------------------------------- #
def _friendly_label(dtype: Any) -> str:
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "date"
    if pd.api.types.is_bool_dtype(dtype):
        return "boolean"
    if pd.api.types.is_integer_dtype(dtype):
        return "integer"
    if pd.api.types.is_float_dtype(dtype):
        return "float"
    return "text"


def _json_safe(value: Any) -> Any:
    if value is None or value is pd.NA:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, np.integer):
        return int(value)
    if isinstance(value, np.floating):
        f = float(value)
        return None if math.isnan(f) else f
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, (pd.Timestamp,)):
        return value.strftime(config.DATE_OUTPUT_FORMAT)
    return value


def _frame_to_preview(df: pd.DataFrame, max_rows: int) -> Dict[str, Any]:
    head = df.head(max_rows).copy()
    dtypes: Dict[str, str] = {}

    for col in head.columns:
        series = head[col]
        if pd.api.types.is_datetime64_any_dtype(series):
            non_na = series.dropna()
            has_time = False
            if not non_na.empty:
                has_time = bool(
                    (non_na.dt.hour.ne(0) | non_na.dt.minute.ne(0) | non_na.dt.second.ne(0)).any()
                )
            fmt = config.DATETIME_OUTPUT_FORMAT if has_time else config.DATE_OUTPUT_FORMAT
            head[col] = series.dt.strftime(fmt)
            dtypes[str(col)] = "date"
        else:
            dtypes[str(col)] = _friendly_label(df[col].dtype)

    columns = [str(c) for c in head.columns]
    col_values = {c: [_json_safe(v) for v in head[c].tolist()] for c in head.columns}
    rows = [
        {str(c): col_values[c][i] for c in head.columns}
        for i in range(len(head))
    ]

    return {
        "columns": columns,
        "rows": rows,
        "rowCount": int(len(df)),
        "truncated": bool(len(df) > max_rows),
        "dtypes": dtypes,
    }
