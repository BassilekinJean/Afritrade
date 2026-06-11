"""Planificateur cron pour exécution automatique des pipelines (n8n)."""

from __future__ import annotations

import logging
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

import database

logger = logging.getLogger("datapipe.scheduler")

_scheduler: Optional[BackgroundScheduler] = None


def _run_scheduled_project(schedule_id: str, project_id: str, user_id: str) -> None:
    """Exécute un projet planifié."""
    from pipeline_service import graph_to_api_nodes, run_pipeline_tracked
    from storage import DATASETS

    project = database.get_project(project_id, user_id)
    if project is None:
        logger.warning("Projet introuvable pour planification %s", schedule_id)
        return
    graph = project.get("graph") or {}
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    if not nodes:
        return
    api_nodes = graph_to_api_nodes(nodes)
    try:
        run_pipeline_tracked(
            api_nodes, edges, DATASETS,
            user_id=user_id, project_id=project_id, trigger_type="schedule",
        )
        database.log_activity(
            action="pipeline_run", user_id=user_id,
            email=database.get_user_by_id(user_id).get("username") if database.get_user_by_id(user_id) else None,
            detail=f"schedule:{schedule_id}",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Échec exécution planifiée %s : %s", schedule_id, exc)
    database.update_schedule(schedule_id, user_id, {"last_run_at": database._now()})  # noqa: SLF001


def _register_schedule(sched: dict) -> None:
    global _scheduler
    if _scheduler is None:
        return
    job_id = f"schedule_{sched['id']}"
    try:
        trigger = CronTrigger.from_crontab(sched["cron_expression"])
    except Exception as exc:  # noqa: BLE001
        logger.warning("Cron invalide pour %s : %s", sched["id"], exc)
        return
    _scheduler.add_job(
        _run_scheduled_project,
        trigger=trigger,
        id=job_id,
        replace_existing=True,
        kwargs={
            "schedule_id": sched["id"],
            "project_id": sched["project_id"],
            "user_id": sched["user_id"],
        },
    )


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(timezone="UTC")
    for sched in database.list_all_enabled_schedules():
        _register_schedule(sched)
    _scheduler.start()
    logger.info("Planificateur démarré (%d tâches)", len(database.list_all_enabled_schedules()))


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def refresh_schedule(sched: dict) -> None:
    global _scheduler
    if _scheduler is None:
        return
    job_id = f"schedule_{sched['id']}"
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)
    if sched.get("enabled"):
        _register_schedule(sched)


def remove_schedule_job(schedule_id: str) -> None:
    global _scheduler
    if _scheduler and _scheduler.get_job(f"schedule_{schedule_id}"):
        _scheduler.remove_job(f"schedule_{schedule_id}")
