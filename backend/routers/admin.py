"""Routes d'administration (réservées au rôle « admin »).

- Gestion des comptes : lister, créer, modifier/réinitialiser, activer/désactiver,
  supprimer.
- Journal d'activité (connexions/déconnexions…) pour le suivi en temps réel.

Toutes les routes exigent un jeton d'un utilisateur admin (`get_current_admin`).
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, status

import database
from auth import CurrentUser, get_current_admin
from schemas import ActivityEntry, AdminCreateUser, AdminUpdateUser, ProjectOut, UserOut
from security import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "?"


# --------------------------------------------------------------------------- #
#  Comptes
# --------------------------------------------------------------------------- #
@router.get("/users", response_model=List[UserOut])
def list_users(_admin: CurrentUser = Depends(get_current_admin)) -> List[Dict[str, Any]]:
    return database.list_users()


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminCreateUser,
    request: Request,
    admin: CurrentUser = Depends(get_current_admin),
) -> Dict[str, Any]:
    if database.get_user_by_username(payload.username) is not None:
        raise HTTPException(status_code=409, detail="Ce nom d'utilisateur est déjà pris.")
    user = database.create_user(
        username=payload.username.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        email=payload.email,
        full_name=payload.full_name,
    )
    database.log_activity(
        action="user_created", user_id=admin.id, email=admin.username,
        detail=f"{payload.username} (role={payload.role})", ip=_client_ip(request),
    )
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: AdminUpdateUser,
    request: Request,
    admin: CurrentUser = Depends(get_current_admin),
) -> Dict[str, Any]:
    target = database.get_user_by_id(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Compte introuvable.")

    fields: Dict[str, Any] = {}
    if payload.username is not None and payload.username.strip() != target["username"]:
        existing = database.get_user_by_username(payload.username)
        if existing is not None and existing["id"] != user_id:
            raise HTTPException(status_code=409, detail="Ce nom d'utilisateur est déjà pris.")
        fields["username"] = payload.username.strip()
    if payload.email is not None:
        fields["email"] = payload.email
    if payload.full_name is not None:
        fields["full_name"] = payload.full_name
    if payload.role is not None:
        fields["role"] = payload.role
    if payload.is_active is not None:
        fields["is_active"] = payload.is_active
    if payload.password:
        fields["password_hash"] = hash_password(payload.password)

    # Garde-fou : ne pas se retirer à soi-même le rôle admin ou se désactiver.
    if user_id == admin.id:
        if fields.get("role") == "user":
            raise HTTPException(status_code=400, detail="Vous ne pouvez pas retirer votre propre rôle admin.")
        if fields.get("is_active") is False:
            raise HTTPException(status_code=400, detail="Vous ne pouvez pas désactiver votre propre compte.")

    updated = database.update_user(user_id, fields)
    changed = ", ".join(k for k in fields if k != "password_hash")
    if "password_hash" in fields:
        changed = (changed + ", " if changed else "") + "password"
    database.log_activity(
        action="user_updated", user_id=admin.id, email=admin.username,
        detail=f"{target['username']} → [{changed}]", ip=_client_ip(request),
    )
    return updated


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: str,
    request: Request,
    admin: CurrentUser = Depends(get_current_admin),
):
    target = database.get_user_by_id(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Compte introuvable.")
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte.")
    if target["role"] == "admin":
        admins = [u for u in database.list_users() if u["role"] == "admin"]
        if len(admins) <= 1:
            raise HTTPException(status_code=400, detail="Impossible de supprimer le dernier administrateur.")
    database.delete_user(user_id)
    database.log_activity(
        action="user_deleted", user_id=admin.id, email=admin.username,
        detail=target["username"], ip=_client_ip(request),
    )
    return None


# --------------------------------------------------------------------------- #
#  Projets de tous les utilisateurs (vue admin)
# --------------------------------------------------------------------------- #
@router.get("/projects")
def all_projects(_admin: CurrentUser = Depends(get_current_admin)) -> List[Dict[str, Any]]:
    """Liste tous les projets de tous les utilisateurs (avec le propriétaire)."""
    return database.list_all_projects()


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_any_project(
    project_id: str, _admin: CurrentUser = Depends(get_current_admin)
) -> Dict[str, Any]:
    project = database.get_project_any(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_any_project(
    project_id: str, request: Request, admin: CurrentUser = Depends(get_current_admin)
):
    if not database.delete_project_any(project_id):
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    database.log_activity(
        action="project_deleted", user_id=admin.id, email=admin.username,
        detail=f"(admin) {project_id}", ip=_client_ip(request),
    )
    return None


# --------------------------------------------------------------------------- #
#  Présence + journal (suivi temps réel unifié)
# --------------------------------------------------------------------------- #
@router.get("/presence")
def presence(_admin: CurrentUser = Depends(get_current_admin)) -> Dict[str, Any]:
    """État de connexion en temps réel : qui est connecté, comptes enrichis, journal."""
    return database.get_presence_snapshot()


@router.get("/activity", response_model=List[ActivityEntry])
def activity(
    limit: int = 100, _admin: CurrentUser = Depends(get_current_admin)
) -> List[Dict[str, Any]]:
    return database.list_activity(limit=min(max(limit, 1), 500))
