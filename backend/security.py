"""Sécurité : hachage des mots de passe (bcrypt) et jetons JWT.

Auth 100 % locale (sans Supabase) :
  - Mots de passe hachés avec bcrypt (jamais stockés en clair).
  - Sessions via JWT signé HS256, durée de vie configurable.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "12"))


class TokenError(Exception):
    """Jeton JWT absent, invalide ou expiré."""


# --------------------------------------------------------------------------- #
#  Mots de passe
# --------------------------------------------------------------------------- #
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# --------------------------------------------------------------------------- #
#  JWT
# --------------------------------------------------------------------------- #
def create_access_token(user_id: str, role: str, username: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "username": username,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    if not token:
        raise TokenError("Jeton manquant.")
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Session expirée, reconnectez-vous.") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Jeton invalide.") from exc
