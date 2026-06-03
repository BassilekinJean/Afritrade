"""Accès à Supabase côté serveur, SANS connexion Postgres directe.

Deux usages :

1. Authentification — `verify_access_token` valide le jeton d'accès Supabase
   envoyé par le front (header `Authorization: Bearer ...`) en interrogeant
   l'endpoint GoTrue `/auth/v1/user`. Pas besoin du secret JWT : Supabase fait
   la vérification et renvoie l'utilisateur.

2. Données — CRUD des projets via l'API Data (PostgREST) avec la clé
   `service_role`. Cela évite d'avoir besoin du mot de passe de la base
   (connexion Postgres directe), tout en restant entièrement côté serveur.

La table `projects` doit exister dans Supabase (voir `supabase/schema.sql`).
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
ANON_KEY = os.environ.get("SUPABASE_ANON_KEY") or ""
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""

_REST = f"{SUPABASE_URL}/rest/v1"
_AUTH = f"{SUPABASE_URL}/auth/v1"

# Durée de cache de validation d'un jeton (évite un appel réseau par requête).
_TOKEN_TTL_SECONDS = 30.0


class AuthError(Exception):
    """Jeton Supabase absent / invalide / expiré."""


class SupabaseDataError(Exception):
    """Erreur lors d'un appel à l'API Data (PostgREST)."""


@dataclass
class AuthUser:
    id: str
    email: Optional[str] = None
    created_at: Optional[str] = None


def is_configured() -> bool:
    return bool(SUPABASE_URL and ANON_KEY and SERVICE_ROLE_KEY)


# --------------------------------------------------------------------------- #
#  Authentification : validation du jeton via GoTrue
# --------------------------------------------------------------------------- #
_token_cache: Dict[str, tuple[AuthUser, float]] = {}
_cache_lock = threading.Lock()


def verify_access_token(token: str) -> AuthUser:
    """Valide un jeton d'accès Supabase et renvoie l'utilisateur correspondant."""
    if not token:
        raise AuthError("Jeton manquant.")
    if not is_configured():
        raise AuthError("Backend Supabase non configuré.")

    now = time.monotonic()
    with _cache_lock:
        cached = _token_cache.get(token)
        if cached and cached[1] > now:
            return cached[0]

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                f"{_AUTH}/user",
                headers={"Authorization": f"Bearer {token}", "apikey": ANON_KEY},
            )
    except httpx.HTTPError as exc:
        raise AuthError(f"Validation du jeton impossible : {exc}") from exc

    if resp.status_code != 200:
        raise AuthError("Identifiants invalides ou expirés.")

    data = resp.json()
    user = AuthUser(
        id=data.get("id"),
        email=data.get("email"),
        created_at=data.get("created_at"),
    )
    if not user.id:
        raise AuthError("Réponse d'authentification Supabase invalide.")

    with _cache_lock:
        _token_cache[token] = (user, now + _TOKEN_TTL_SECONDS)
    return user


# --------------------------------------------------------------------------- #
#  API Data (PostgREST) : CRUD des projets avec la clé service_role
# --------------------------------------------------------------------------- #
def _rest_headers(extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def _request(method: str, path: str, **kwargs: Any) -> httpx.Response:
    if not is_configured():
        raise SupabaseDataError("Backend Supabase non configuré.")
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.request(method, f"{_REST}{path}", **kwargs)
    except httpx.HTTPError as exc:
        raise SupabaseDataError(f"Appel Supabase échoué : {exc}") from exc
    if resp.status_code >= 400:
        detail = resp.text
        raise SupabaseDataError(
            f"Erreur Supabase ({resp.status_code}) sur {path} : {detail}"
        )
    return resp


def list_projects(user_id: str) -> List[Dict[str, Any]]:
    resp = _request(
        "GET",
        "/projects",
        params={
            "user_id": f"eq.{user_id}",
            "select": "id,title,graph,created_at,updated_at",
            "order": "updated_at.desc",
        },
        headers=_rest_headers(),
    )
    return resp.json()


def get_project(project_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    resp = _request(
        "GET",
        "/projects",
        params={
            "id": f"eq.{project_id}",
            "user_id": f"eq.{user_id}",
            "select": "id,title,graph,created_at,updated_at",
            "limit": "1",
        },
        headers=_rest_headers(),
    )
    rows = resp.json()
    return rows[0] if rows else None


def create_project(user_id: str, title: str) -> Dict[str, Any]:
    resp = _request(
        "POST",
        "/projects",
        json={"user_id": user_id, "title": title, "graph": {"nodes": [], "edges": []}},
        headers=_rest_headers({"Prefer": "return=representation"}),
    )
    rows = resp.json()
    if not rows:
        raise SupabaseDataError("Création du projet : réponse vide.")
    return rows[0]


def update_project(
    project_id: str, user_id: str, patch: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    if not patch:
        return get_project(project_id, user_id)
    resp = _request(
        "PATCH",
        "/projects",
        params={"id": f"eq.{project_id}", "user_id": f"eq.{user_id}"},
        json=patch,
        headers=_rest_headers({"Prefer": "return=representation"}),
    )
    rows = resp.json()
    return rows[0] if rows else None


def delete_project(project_id: str, user_id: str) -> bool:
    resp = _request(
        "DELETE",
        "/projects",
        params={"id": f"eq.{project_id}", "user_id": f"eq.{user_id}"},
        headers=_rest_headers({"Prefer": "return=representation"}),
    )
    rows = resp.json()
    return bool(rows)
