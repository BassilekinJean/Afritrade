"""Routes de gestion des projets (CRUD), via l'API Data de Supabase.

Authentification : jeton Supabase validé par `get_current_user`.
Stockage : table `projects` de Supabase, accédée par PostgREST avec la clé
service_role (le filtrage par `user_id` garantit l'isolation des données).
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

import supabase_api
from auth import get_current_user
from schemas import ProjectCreate, ProjectOut, ProjectSummary, ProjectUpdate
from supabase_api import AuthUser, SupabaseDataError

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _handle_data_error(exc: SupabaseDataError) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Accès aux données Supabase impossible : {exc}",
    )


@router.get("", response_model=List[ProjectSummary])
def list_projects(current_user: AuthUser = Depends(get_current_user)) -> List[Dict[str, Any]]:
    try:
        return supabase_api.list_projects(current_user.id)
    except SupabaseDataError as exc:
        raise _handle_data_error(exc) from exc


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate, current_user: AuthUser = Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        return supabase_api.create_project(current_user.id, payload.title.strip())
    except SupabaseDataError as exc:
        raise _handle_data_error(exc) from exc


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: uuid.UUID, current_user: AuthUser = Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        project = supabase_api.get_project(str(project_id), current_user.id)
    except SupabaseDataError as exc:
        raise _handle_data_error(exc) from exc
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    current_user: AuthUser = Depends(get_current_user),
) -> Dict[str, Any]:
    patch: Dict[str, Any] = {}
    if payload.title is not None:
        patch["title"] = payload.title.strip()
    if payload.graph is not None:
        patch["graph"] = payload.graph.model_dump()
    try:
        project = supabase_api.update_project(str(project_id), current_user.id, patch)
    except SupabaseDataError as exc:
        raise _handle_data_error(exc) from exc
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: uuid.UUID, current_user: AuthUser = Depends(get_current_user)
):
    try:
        deleted = supabase_api.delete_project(str(project_id), current_user.id)
    except SupabaseDataError as exc:
        raise _handle_data_error(exc) from exc
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projet introuvable.")
    return None
