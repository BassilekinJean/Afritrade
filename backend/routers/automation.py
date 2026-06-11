"""Planification et webhooks (style n8n)."""

from __future__ import annotations

import os
import secrets
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import database
from auth import CurrentUser, get_current_user
from pipeline_service import graph_to_api_nodes, run_pipeline_tracked
from schemas import ScheduleCreate, ScheduleOut, ScheduleUpdate, WebhookCreate, WebhookOut
from storage import DATASETS

router = APIRouter(prefix="/api/automation", tags=["automation"])


def _webhook_public_url(token: str, request: Optional[Request] = None) -> str:
    base = os.environ.get("PUBLIC_API_URL", "").rstrip("/")
    if not base and request is not None:
        base = str(request.base_url).rstrip("/")
    return f"{base}/api/hooks/{token}"


# --------------------------------------------------------------------------- #
#  Planification cron
# --------------------------------------------------------------------------- #
@router.get("/schedules", response_model=List[ScheduleOut])
def list_schedules(
    project_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    return database.list_schedules(current_user.id, project_id=project_id)


@router.post("/schedules", response_model=ScheduleOut, status_code=status.HTTP_201_CREATED)
def create_schedule(
    payload: ScheduleCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    project = database.get_project(payload.project_id, current_user.id)
    if project is None:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    sched = database.create_schedule(current_user.id, payload.project_id, payload.cron_expression)
    try:
        import scheduler as sched_mod

        sched_mod.refresh_schedule(sched)
    except Exception:  # noqa: BLE001
        pass
    return sched


@router.patch("/schedules/{schedule_id}", response_model=ScheduleOut)
def update_schedule(
    schedule_id: str,
    payload: ScheduleUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    updated = database.update_schedule(
        schedule_id, current_user.id, payload.model_dump(exclude_unset=True)
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Planification introuvable.")
    try:
        import scheduler as sched_mod

        sched_mod.refresh_schedule(updated)
    except Exception:  # noqa: BLE001
        pass
    return updated


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    if not database.delete_schedule(schedule_id, current_user.id):
        raise HTTPException(status_code=404, detail="Planification introuvable.")
    try:
        import scheduler as sched_mod

        sched_mod.remove_schedule_job(schedule_id)
    except Exception:  # noqa: BLE001
        pass
    return None


# --------------------------------------------------------------------------- #
#  Webhooks
# --------------------------------------------------------------------------- #
@router.get("/webhooks", response_model=List[WebhookOut])
def list_webhooks(
    request: Request,
    project_id: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    hooks = database.list_webhooks(current_user.id, project_id=project_id)
    for h in hooks:
        h["webhook_url"] = _webhook_public_url(h["token"], request)
    return hooks


@router.post("/webhooks", response_model=WebhookOut, status_code=status.HTTP_201_CREATED)
def create_webhook(
    payload: WebhookCreate,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    project = database.get_project(payload.project_id, current_user.id)
    if project is None:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    token = secrets.token_urlsafe(24)
    hook = database.create_webhook(current_user.id, payload.project_id, token)
    hook["webhook_url"] = _webhook_public_url(token, request)
    return hook


@router.delete("/webhooks/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(
    webhook_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    if not database.delete_webhook(webhook_id, current_user.id):
        raise HTTPException(status_code=404, detail="Webhook introuvable.")
    return None


class WebhookToggle(BaseModel):
    enabled: bool


@router.patch("/webhooks/{webhook_id}", response_model=WebhookOut)
def toggle_webhook(
    webhook_id: str,
    payload: WebhookToggle,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    hook = database.toggle_webhook(webhook_id, current_user.id, payload.enabled)
    if hook is None:
        raise HTTPException(status_code=404, detail="Webhook introuvable.")
    hook["webhook_url"] = _webhook_public_url(hook["token"], request)
    return hook


# --------------------------------------------------------------------------- #
#  Endpoint public webhook (sans JWT)
# --------------------------------------------------------------------------- #
hooks_router = APIRouter(prefix="/api/hooks", tags=["webhooks-public"])


@hooks_router.post("/{token}")
async def trigger_webhook(token: str, request: Request) -> Dict[str, Any]:
    hook = database.get_webhook_by_token(token)
    if hook is None:
        raise HTTPException(status_code=404, detail="Webhook introuvable ou désactivé.")
    project = database.get_project_any(hook["project_id"])
    if project is None:
        raise HTTPException(status_code=404, detail="Projet associé introuvable.")
    body: Dict[str, Any] = {}
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        body = {}
    graph = project.get("graph") or {}
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    if not nodes:
        raise HTTPException(status_code=400, detail="Pipeline vide.")
    api_nodes = graph_to_api_nodes(nodes)
    for n in api_nodes:
        if n["type"] == "trigger_webhook":
            n["data"]["config"] = {**(n["data"].get("config") or {}), "payload": body}
    result = run_pipeline_tracked(
        api_nodes, edges, DATASETS,
        user_id=hook["user_id"], project_id=hook["project_id"], trigger_type="webhook",
    )
    database.log_activity(
        action="pipeline_run",
        user_id=hook["user_id"],
        detail=f"webhook:{token[:8]}…",
    )
    return {"status": "ok", "runId": result.get("runId"), "finalNodeId": result.get("finalNodeId")}
