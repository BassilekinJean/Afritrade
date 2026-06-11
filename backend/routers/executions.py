"""Historique d'exécution des pipelines (Talend Job Monitor / n8n Executions)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

import database
from auth import CurrentUser, get_current_user
from schemas import PipelineRunOut

router = APIRouter(prefix="/api/executions", tags=["executions"])


@router.get("", response_model=List[PipelineRunOut])
def list_executions(
    limit: int = 50,
    project_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    return database.list_pipeline_runs(
        current_user.id, limit=min(max(limit, 1), 200), project_id=project_id
    )


@router.get("/{run_id}", response_model=PipelineRunOut)
def get_execution(
    run_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    run = database.get_pipeline_run(run_id, current_user.id)
    if run is None:
        raise HTTPException(status_code=404, detail="Exécution introuvable.")
    return run
