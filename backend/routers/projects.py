"""Routes de gestion des projets (CRUD), stockés en SQLite local.

Un utilisateur normal n'accède qu'à ses propres projets. Un administrateur peut
accéder à TOUS les projets (lecture, mise à jour, suppression) — il supervise
l'ensemble des espaces de travail.
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

import database
from auth import CurrentUser, get_current_user
from schemas import ProjectCreate, ProjectOut, ProjectSummary, ProjectUpdate

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=List[ProjectSummary])
def list_projects(current_user: CurrentUser = Depends(get_current_user)) -> List[Dict[str, Any]]:
    return database.list_projects(current_user.id)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate, current_user: CurrentUser = Depends(get_current_user)
) -> Dict[str, Any]:
    project = database.create_project(current_user.id, payload.title.strip())
    database.log_activity(
        action="project_created", user_id=current_user.id, email=current_user.username,
        detail=payload.title.strip(),
    )
    return project


def _project_for(current_user: CurrentUser, project_id: str) -> Dict[str, Any] | None:
    """Récupère un projet : le sien, ou n'importe lequel si l'utilisateur est admin."""
    if current_user.is_admin:
        return database.get_project_any(project_id)
    return database.get_project(project_id, current_user.id)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str, current_user: CurrentUser = Depends(get_current_user)
) -> Dict[str, Any]:
    project = _project_for(current_user, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    patch: Dict[str, Any] = {}
    if payload.title is not None:
        patch["title"] = payload.title.strip()
    if payload.graph is not None:
        patch["graph"] = payload.graph.model_dump()

    if current_user.is_admin:
        project = database.update_project_any(project_id, patch)
    else:
        project = database.update_project(project_id, current_user.id, patch)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str, current_user: CurrentUser = Depends(get_current_user)
):
    if current_user.is_admin:
        deleted = database.delete_project_any(project_id)
    else:
        deleted = database.delete_project(project_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")
    database.log_activity(
        action="project_deleted", user_id=current_user.id, email=current_user.username,
        detail=project_id,
    )
    return None
