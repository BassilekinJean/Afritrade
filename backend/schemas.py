"""Schémas Pydantic : authentification, gestion des comptes, projets, journal."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
#  Auth (par nom d'utilisateur)
# --------------------------------------------------------------------------- #
class LoginRequest(BaseModel):
    username: str
    password: str
    # Onglet choisi sur la page de connexion ("admin" ou "user"), purement
    # indicatif : le rôle réel est déterminé par le compte côté serveur.
    as_role: Optional[str] = Field(default=None, pattern="^(admin|user)$")


class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: str
    updated_at: str
    last_login_at: Optional[str] = None
    last_seen_at: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    token: str
    user: UserOut


# --------------------------------------------------------------------------- #
#  Administration des comptes
# --------------------------------------------------------------------------- #
class AdminCreateUser(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6)
    role: str = Field(default="user", pattern="^(admin|user)$")
    email: Optional[str] = None
    full_name: Optional[str] = None


class AdminUpdateUser(BaseModel):
    """Réinitialisation / mise à jour des informations d'un compte par l'admin."""
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    password: Optional[str] = Field(default=None, min_length=6)
    role: Optional[str] = Field(default=None, pattern="^(admin|user)$")
    email: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None


# --------------------------------------------------------------------------- #
#  Journal d'activité
# --------------------------------------------------------------------------- #
class ActivityEntry(BaseModel):
    id: str
    userId: Optional[str] = None
    email: Optional[str] = None  # contient le username de l'auteur de l'action
    action: str
    detail: Optional[str] = None
    ip: Optional[str] = None
    createdAt: str


# --------------------------------------------------------------------------- #
#  Projets
# --------------------------------------------------------------------------- #
class Graph(BaseModel):
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    graph: Optional[Graph] = None


class ProjectSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    owner_username: Optional[str] = None
    owner_name: Optional[str] = None


class ProjectOut(ProjectSummary):
    graph: Dict[str, Any]


# --------------------------------------------------------------------------- #
#  Connexions réutilisables (Talend)
# --------------------------------------------------------------------------- #
class ConnectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    conn_type: str = Field(default="database", pattern="^(database|http)$")
    connection_url: str = Field(min_length=1)
    description: Optional[str] = None


class ConnectionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    conn_type: Optional[str] = Field(default=None, pattern="^(database|http)$")
    connection_url: Optional[str] = None
    description: Optional[str] = None


class ConnectionOut(BaseModel):
    id: str
    user_id: str
    name: str
    conn_type: str
    connection_url: str
    description: Optional[str] = None
    created_at: str
    updated_at: str


# --------------------------------------------------------------------------- #
#  Historique d'exécution
# --------------------------------------------------------------------------- #
class NodeRunLog(BaseModel):
    id: str
    run_id: str
    node_id: str
    node_type: Optional[str] = None
    phase: Optional[str] = None
    status: str
    duration_ms: Optional[float] = None
    row_count: Optional[int] = None
    error: Optional[str] = None


class PipelineRunOut(BaseModel):
    id: str
    project_id: Optional[str] = None
    project_title: Optional[str] = None
    user_id: Optional[str] = None
    status: str
    trigger_type: str
    node_count: int
    duration_ms: Optional[float] = None
    error_message: Optional[str] = None
    result_summary: Optional[Dict[str, Any]] = None
    created_at: str
    finished_at: Optional[str] = None
    node_logs: Optional[List[NodeRunLog]] = None


# --------------------------------------------------------------------------- #
#  Automation (n8n)
# --------------------------------------------------------------------------- #
class ScheduleCreate(BaseModel):
    project_id: str
    cron_expression: str = Field(min_length=5, max_length=100)


class ScheduleUpdate(BaseModel):
    cron_expression: Optional[str] = Field(default=None, min_length=5, max_length=100)
    enabled: Optional[bool] = None


class ScheduleOut(BaseModel):
    id: str
    project_id: str
    user_id: str
    cron_expression: str
    enabled: bool
    last_run_at: Optional[str] = None
    next_run_at: Optional[str] = None
    created_at: str
    updated_at: str


class WebhookCreate(BaseModel):
    project_id: str


class WebhookOut(BaseModel):
    id: str
    project_id: str
    user_id: str
    token: str
    enabled: bool
    created_at: str
    webhook_url: Optional[str] = None


# --------------------------------------------------------------------------- #
#  Conducteur IA (pipeline guidé)
# --------------------------------------------------------------------------- #
class ConductorStartRequest(BaseModel):
    columns: List[str] = Field(default_factory=list)
    sourceLabel: str = "Source importée"
    projectId: Optional[str] = None
    sourceNodeId: Optional[str] = None


class ConductorIntentRequest(BaseModel):
    sessionId: str
    intent: str = Field(min_length=3)


class ConductorPlanRequest(BaseModel):
    sessionId: str
    action: str = Field(pattern="^(accept|revise)$")
    feedback: Optional[str] = None


class ConductorStepRequest(BaseModel):
    sessionId: str
    action: str = Field(pattern="^(accept|reject|revise)$")
    feedback: Optional[str] = None
