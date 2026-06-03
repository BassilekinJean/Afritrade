"""Routes d'authentification.

L'inscription / la connexion se font désormais directement côté front via
Supabase Auth. Le backend expose uniquement le profil de l'utilisateur courant
(jeton Supabase validé).
"""

from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends

from auth import get_current_user
from supabase_api import AuthUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
def me(current_user: AuthUser = Depends(get_current_user)) -> Dict[str, Any]:
    return {
        "id": current_user.id,
        "email": current_user.email,
        "created_at": current_user.created_at,
    }
