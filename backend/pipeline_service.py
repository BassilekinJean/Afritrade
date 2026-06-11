"""Service d'exécution de pipeline avec persistance (historique Talend / n8n)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import database
from etl.engine import _phase_of, execute_graph
from etl.errors import PipelineError
from storage import DatasetStore


def graph_to_api_nodes(stored_nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convertit le graphe React Flow persisté en format API pipeline."""
    api_nodes: List[Dict[str, Any]] = []
    for n in stored_nodes:
        data = n.get("data") or {}
        kind = data.get("kind") or n.get("type") or "source_file"
        api_nodes.append({
            "id": n["id"],
            "type": kind,
            "data": {"config": data.get("config") or {}},
        })
    return api_nodes


def run_pipeline_tracked(
    nodes: List[Dict[str, Any]],
    edges: List[Dict[str, Any]],
    datasets: DatasetStore,
    *,
    user_id: Optional[str] = None,
    project_id: Optional[str] = None,
    trigger_type: str = "manual",
    persist: bool = True,
) -> Dict[str, Any]:
    """Exécute un graphe et enregistre l'historique + logs par nœud."""
    run_id: Optional[str] = None
    if persist and user_id:
        run_id = database.create_pipeline_run(
            user_id, project_id, trigger_type=trigger_type, node_count=len(nodes)
        )

    try:
        result = execute_graph(nodes, edges, datasets)
    except PipelineError as exc:
        if run_id:
            database.finish_pipeline_run(
                run_id, status="failed", duration_ms=0, error_message=str(exc)
            )
        raise

    duration = float(result.get("etl", {}).get("durationMs") or 0)
    previews = result.get("previews") or {}
    has_errors = any(p.get("error") for p in previews.values())
    status = "failed" if has_errors else "success"

    if run_id:
        nodes_by_id = {n["id"]: n for n in nodes}
        for nid, preview in previews.items():
            ntype = nodes_by_id.get(nid, {}).get("type", "")
            database.log_node_run(
                run_id,
                node_id=nid,
                node_type=ntype,
                phase=preview.get("phase") or _phase_of(ntype),
                status="error" if preview.get("error") else "ok",
                duration_ms=0,
                row_count=preview.get("rowCount"),
                error=preview.get("error"),
            )
        final = result.get("final") or {}
        database.finish_pipeline_run(
            run_id,
            status=status,
            duration_ms=duration,
            error_message=next((p.get("error") for p in previews.values() if p.get("error")), None),
            result_summary={
                "finalNodeId": result.get("finalNodeId"),
                "rowCount": final.get("rowCount"),
                "nodeCount": len(nodes),
            },
        )
        result["runId"] = run_id

    return result
