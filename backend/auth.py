"""Authentification basée sur Supabase Auth.

Le front se connecte/inscrit directement via Supabase (GoTrue) et envoie le
jeton d'accès au backend. Ici, on se contente de VALIDER ce jeton auprès de
Supabase et d'en extraire l'utilisateur courant. Plus de mot de passe ni de JWT
« maison » côté backend.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from supabase_api import AuthError, AuthUser, verify_access_token

bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthUser:
    try:
        return verify_access_token(credentials.credentials)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc) or "Identifiants invalides ou expirés.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
