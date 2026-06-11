"""Routes d'authentification (login / logout / profil / mot de passe).

Connexion par NOM D'UTILISATEUR (pas d'email). Pas d'inscription publique :
seuls les comptes créés par un administrateur peuvent se connecter. Chaque
connexion / déconnexion est journalisée pour le suivi en temps réel côté admin.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status

import database
from auth import CurrentUser, get_current_user
from schemas import ChangePasswordRequest, LoginRequest, TokenResponse, UserOut
from security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "?"


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request) -> dict:
    username = payload.username.strip()
    user = database.get_user_by_username(username)
    password_hash = database.get_user_password_hash(username)

    if user is None or password_hash is None or not verify_password(payload.password, password_hash):
        database.log_activity(
            action="login_failed", email=username, detail="Identifiants invalides",
            ip=_client_ip(request),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect.",
        )

    if not user["is_active"]:
        database.log_activity(
            action="login_blocked", user_id=user["id"], email=username,
            detail="Compte désactivé", ip=_client_ip(request),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé. Contactez l'administrateur.",
        )

    # L'onglet « Administrateur » exige réellement un compte admin.
    if payload.as_role == "admin" and user["role"] != "admin":
        database.log_activity(
            action="login_denied", user_id=user["id"], email=username,
            detail="Connexion admin refusée (compte non admin)", ip=_client_ip(request),
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte n'est pas administrateur.",
        )

    database.touch_last_login(user["id"])
    database.touch_last_seen(user["id"])
    database.log_activity(
        action="login", user_id=user["id"], email=username,
        detail=f"role={user['role']}", ip=_client_ip(request),
    )
    token = create_access_token(user["id"], user["role"], user["username"])
    user = database.get_user_by_id(user["id"]) or user
    return {"token": token, "user": UserOut(**user)}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, current_user: CurrentUser = Depends(get_current_user)):
    database.log_activity(
        action="logout", user_id=current_user.id, email=current_user.username,
        ip=_client_ip(request),
    )
    # Marque immédiatement hors ligne (last_seen_at vidé + dernière action = logout).
    database.mark_offline(current_user.id)
    return None


@router.get("/me", response_model=UserOut)
def me(current_user: CurrentUser = Depends(get_current_user)) -> dict:
    user = database.get_user_by_id(current_user.id)
    if user is None:
        raise HTTPException(status_code=404, detail="Compte introuvable.")
    return UserOut(**user)


@router.post("/change-password", response_model=UserOut)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Permet à l'utilisateur connecté de changer son propre mot de passe."""
    current_hash = database.get_user_password_hash(current_user.username)
    if current_hash is None or not verify_password(payload.current_password, current_hash):
        raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")
    updated = database.update_user(
        current_user.id, {"password_hash": hash_password(payload.new_password)}
    )
    database.log_activity(
        action="password_changed", user_id=current_user.id, email=current_user.username,
        detail="self-service", ip=_client_ip(request),
    )
    return UserOut(**updated)
