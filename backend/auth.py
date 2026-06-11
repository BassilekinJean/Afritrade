"""Dépendances FastAPI d'authentification (JWT local).

`get_current_user`  : exige un jeton valide, renvoie l'utilisateur courant.
`get_current_admin` : exige en plus le rôle « admin ».
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import database
from security import TokenError, decode_access_token

bearer_scheme = HTTPBearer(auto_error=True)


@dataclass
class CurrentUser:
    id: str
    username: str
    role: str
    email: Optional[str] = None
    full_name: Optional[str] = None

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    try:
        payload = decode_access_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = database.get_user_by_id(payload.get("sub", ""))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Compte introuvable.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Compte désactivé. Contactez l'administrateur.",
        )
    # Marque l'utilisateur comme « vu » (présence en temps réel), throttlé en base.
    database.touch_last_seen(user["id"])
    return CurrentUser(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        email=user["email"],
        full_name=user["full_name"],
    )


def get_current_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé à l'administrateur.",
        )
    return current_user
