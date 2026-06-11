"""Couche de persistance locale (SQLite) de DataPipe.

Remplace Supabase : comptes utilisateurs, projets et journal d'activité sont
désormais stockés dans une base SQLite locale unique. Cohérent avec le contexte
(traitement local, faible bande passante) et sans dépendance externe.

Les accès sont sérialisés par un verrou (SQLite n'autorise qu'un seul écrivain)
et chaque appel ouvre/ferme sa connexion : robuste avec les threads de FastAPI.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DATA_DIR = Path(os.environ.get("DATAPIPE_DATA_DIR", Path(__file__).resolve().parent / ".data"))
DB_PATH = DATA_DIR / "datapipe.sqlite"

_lock = threading.Lock()


def _now() -> str:
    """Horodatage ISO 8601 UTC (tri lexicographique = tri chronologique)."""
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return uuid.uuid4().hex


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Crée les tables si nécessaire (idempotent)."""
    with _lock, _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                username      TEXT NOT NULL UNIQUE,
                email         TEXT,
                full_name     TEXT,
                password_hash TEXT NOT NULL,
                role          TEXT NOT NULL DEFAULT 'user',
                is_active     INTEGER NOT NULL DEFAULT 1,
                created_at    TEXT NOT NULL,
                updated_at    TEXT NOT NULL,
                last_login_at TEXT,
                last_seen_at  TEXT
            );

            CREATE TABLE IF NOT EXISTS projects (
                id         TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL,
                title      TEXT NOT NULL,
                graph      TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id         TEXT PRIMARY KEY,
                user_id    TEXT,
                email      TEXT,
                action     TEXT NOT NULL,
                detail     TEXT,
                ip         TEXT,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

            CREATE TABLE IF NOT EXISTS connections (
                id              TEXT PRIMARY KEY,
                user_id         TEXT NOT NULL,
                name            TEXT NOT NULL,
                conn_type       TEXT NOT NULL DEFAULT 'database',
                connection_url  TEXT NOT NULL,
                description     TEXT,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS pipeline_runs (
                id              TEXT PRIMARY KEY,
                project_id      TEXT,
                user_id         TEXT,
                status          TEXT NOT NULL DEFAULT 'running',
                trigger_type    TEXT NOT NULL DEFAULT 'manual',
                node_count      INTEGER NOT NULL DEFAULT 0,
                duration_ms     REAL,
                error_message   TEXT,
                result_summary  TEXT,
                created_at      TEXT NOT NULL,
                finished_at     TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS node_run_logs (
                id              TEXT PRIMARY KEY,
                run_id          TEXT NOT NULL,
                node_id         TEXT NOT NULL,
                node_type       TEXT,
                phase           TEXT,
                status          TEXT NOT NULL DEFAULT 'ok',
                duration_ms     REAL,
                row_count       INTEGER,
                error           TEXT,
                FOREIGN KEY (run_id) REFERENCES pipeline_runs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS schedules (
                id              TEXT PRIMARY KEY,
                project_id      TEXT NOT NULL,
                user_id         TEXT NOT NULL,
                cron_expression TEXT NOT NULL,
                enabled         INTEGER NOT NULL DEFAULT 1,
                last_run_at     TEXT,
                next_run_at     TEXT,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS webhooks (
                id              TEXT PRIMARY KEY,
                project_id      TEXT NOT NULL,
                user_id         TEXT NOT NULL,
                token           TEXT NOT NULL UNIQUE,
                enabled         INTEGER NOT NULL DEFAULT 1,
                created_at      TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_runs_project ON pipeline_runs(project_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_runs_user ON pipeline_runs(user_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_connections_user ON connections(user_id);
            CREATE INDEX IF NOT EXISTS idx_schedules_project ON schedules(project_id);
            CREATE INDEX IF NOT EXISTS idx_webhooks_token ON webhooks(token);
            """
        )
        # Migration vers l'authentification par username. Une base antérieure
        # (basée sur l'email : `email NOT NULL`, `username` nullable) est
        # incompatible -> on recrée la table users. Pas de données réelles en jeu.
        info = conn.execute("PRAGMA table_info(users)").fetchall()
        cols = {r["name"]: r["notnull"] for r in info}
        legacy = (
            "username" not in cols
            or cols.get("email", 0) == 1  # email était NOT NULL dans l'ancien schéma
            or cols.get("username", 1) == 0  # username doit désormais être NOT NULL
        )
        if legacy:
            conn.execute("DROP TABLE IF EXISTS users")
            conn.execute(
                """
                CREATE TABLE users (
                    id            TEXT PRIMARY KEY,
                    username      TEXT NOT NULL UNIQUE,
                    email         TEXT,
                    full_name     TEXT,
                    password_hash TEXT NOT NULL,
                    role          TEXT NOT NULL DEFAULT 'user',
                    is_active     INTEGER NOT NULL DEFAULT 1,
                    created_at    TEXT NOT NULL,
                    updated_at    TEXT NOT NULL,
                    last_login_at TEXT,
                    last_seen_at  TEXT
                )
                """
            )
        elif "last_seen_at" not in cols:
            conn.execute("ALTER TABLE users ADD COLUMN last_seen_at TEXT")


# --------------------------------------------------------------------------- #
#  Utilisateurs
# --------------------------------------------------------------------------- #
def _user_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "role": row["role"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "last_login_at": row["last_login_at"],
        "last_seen_at": row["last_seen_at"] if "last_seen_at" in row.keys() else None,
    }


def create_user(
    username: str,
    password_hash: str,
    role: str = "user",
    email: Optional[str] = None,
    full_name: Optional[str] = None,
) -> Dict[str, Any]:
    uid = _new_id()
    now = _now()
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO users
               (id, username, email, full_name, password_hash, role, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)""",
            (uid, username.strip(), email, full_name, password_hash, role, now, now),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    return _user_to_dict(row)


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username.strip(),)
        ).fetchone()
    return _user_to_dict(row) if row else None


def get_user_password_hash(username: str) -> Optional[str]:
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT password_hash FROM users WHERE username = ?", (username.strip(),)
        ).fetchone()
    return row["password_hash"] if row else None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    with _lock, _connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_to_dict(row) if row else None


def list_users() -> List[Dict[str, Any]]:
    with _lock, _connect() as conn:
        rows = conn.execute("SELECT * FROM users ORDER BY created_at ASC").fetchall()
    return [_user_to_dict(r) for r in rows]


def count_users() -> int:
    with _lock, _connect() as conn:
        row = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()
    return int(row["n"])


def update_user(user_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Met à jour les champs autorisés d'un utilisateur."""
    allowed = {"username", "email", "full_name", "password_hash", "role", "is_active"}
    patch = {k: v for k, v in fields.items() if k in allowed}
    if not patch:
        return get_user_by_id(user_id)
    if "username" in patch and patch["username"]:
        patch["username"] = patch["username"].strip()
    if "is_active" in patch:
        patch["is_active"] = 1 if patch["is_active"] else 0
    patch["updated_at"] = _now()
    cols = ", ".join(f"{k} = ?" for k in patch)
    values = list(patch.values()) + [user_id]
    with _lock, _connect() as conn:
        conn.execute(f"UPDATE users SET {cols} WHERE id = ?", values)
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return _user_to_dict(row) if row else None


def touch_last_login(user_id: str) -> None:
    with _lock, _connect() as conn:
        conn.execute(
            "UPDATE users SET last_login_at = ? WHERE id = ?", (_now(), user_id)
        )


# Présence : on n'écrit en base qu'au plus une fois toutes les _SEEN_THROTTLE s
# par utilisateur (évite une écriture SQLite à chaque requête authentifiée).
_SEEN_THROTTLE_S = 20.0
_last_seen_mem: Dict[str, float] = {}
_seen_lock = threading.Lock()


def touch_last_seen(user_id: str) -> None:
    import time as _time

    now = _time.monotonic()
    with _seen_lock:
        last = _last_seen_mem.get(user_id, 0.0)
        if now - last < _SEEN_THROTTLE_S:
            return
        _last_seen_mem[user_id] = now
    with _lock, _connect() as conn:
        conn.execute("UPDATE users SET last_seen_at = ? WHERE id = ?", (_now(), user_id))


def mark_offline(user_id: str) -> None:
    """Marque explicitement un utilisateur comme déconnecté (appelé au logout)."""
    with _seen_lock:
        _last_seen_mem.pop(user_id, None)
    with _lock, _connect() as conn:
        conn.execute("UPDATE users SET last_seen_at = NULL WHERE id = ?", (user_id,))


# Fenêtre de présence : heartbeat front toutes les 30s → 90s = 3 ratés max.
_ONLINE_WINDOW_SECONDS = 90


def _parse_iso(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _last_session_action(user_id: str) -> Optional[str]:
    """Dernière action de session (login ou logout) pour un utilisateur."""
    with _lock, _connect() as conn:
        row = conn.execute(
            """SELECT action FROM activity_log
               WHERE user_id = ? AND action IN ('login', 'logout')
               ORDER BY created_at DESC LIMIT 1""",
            (user_id,),
        ).fetchone()
    return row["action"] if row else None


def is_user_online(user: Dict[str, Any]) -> bool:
    """Détermine si un utilisateur est connecté en temps réel.

    Critères (tous requis) :
      1. Compte actif (is_active).
      2. last_seen_at renseigné et récent (< 90 s).
      3. Dernière action de session = login (pas logout après).
    """
    if not user.get("is_active"):
        return False
    seen = _parse_iso(user.get("last_seen_at"))
    if seen is None:
        return False
    age = (datetime.now(timezone.utc) - seen).total_seconds()
    if age > _ONLINE_WINDOW_SECONDS:
        return False
    return _last_session_action(user["id"]) == "login"


def get_presence_snapshot() -> Dict[str, Any]:
    """État de présence pour le tableau de bord admin."""
    users = list_users()
    online: List[Dict[str, Any]] = []
    enriched: List[Dict[str, Any]] = []
    for u in users:
        online_flag = is_user_online(u)
        entry = {**u, "is_online": online_flag}
        enriched.append(entry)
        if online_flag:
            online.append(
                {
                    "id": u["id"],
                    "username": u["username"],
                    "full_name": u.get("full_name"),
                    "role": u["role"],
                    "last_seen_at": u.get("last_seen_at"),
                }
            )
    return {
        "online_count": len(online),
        "online_users": online,
        "users": enriched,
        "activity": list_activity(80),
        "window_seconds": _ONLINE_WINDOW_SECONDS,
    }


def delete_user(user_id: str) -> bool:
    with _lock, _connect() as conn:
        cur = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    return cur.rowcount > 0


# --------------------------------------------------------------------------- #
#  Projets
# --------------------------------------------------------------------------- #
def _project_to_dict(row: sqlite3.Row, with_graph: bool = True) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "id": row["id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
    if with_graph:
        try:
            out["graph"] = json.loads(row["graph"])
        except (json.JSONDecodeError, TypeError):
            out["graph"] = {"nodes": [], "edges": []}
    return out


def list_projects(user_id: str) -> List[Dict[str, Any]]:
    with _lock, _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC", (user_id,)
        ).fetchall()
    return [_project_to_dict(r) for r in rows]


def list_all_projects() -> List[Dict[str, Any]]:
    """Tous les projets, avec le propriétaire (réservé à l'admin)."""
    with _lock, _connect() as conn:
        rows = conn.execute(
            """SELECT p.*, u.username AS owner_username, u.full_name AS owner_name
               FROM projects p JOIN users u ON u.id = p.user_id
               ORDER BY p.updated_at DESC"""
        ).fetchall()
    out: List[Dict[str, Any]] = []
    for r in rows:
        d = _project_to_dict(r, with_graph=False)
        d["owner_username"] = r["owner_username"]
        d["owner_name"] = r["owner_name"]
        out.append(d)
    return out


def get_project(project_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id)
        ).fetchone()
    return _project_to_dict(row) if row else None


def get_project_any(project_id: str) -> Optional[Dict[str, Any]]:
    """Récupère un projet sans filtrer par propriétaire (accès admin)."""
    with _lock, _connect() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _project_to_dict(row) if row else None


def create_project(user_id: str, title: str) -> Dict[str, Any]:
    pid = _new_id()
    now = _now()
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO projects (id, user_id, title, graph, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (pid, user_id, title, json.dumps({"nodes": [], "edges": []}), now, now),
        )
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    return _project_to_dict(row)


def update_project(
    project_id: str, user_id: str, patch: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    existing = get_project(project_id, user_id)
    if existing is None:
        return None
    fields: Dict[str, Any] = {}
    if "title" in patch and patch["title"] is not None:
        fields["title"] = patch["title"]
    if "graph" in patch and patch["graph"] is not None:
        fields["graph"] = json.dumps(patch["graph"])
    if not fields:
        return existing
    fields["updated_at"] = _now()
    cols = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [project_id, user_id]
    with _lock, _connect() as conn:
        conn.execute(
            f"UPDATE projects SET {cols} WHERE id = ? AND user_id = ?", values
        )
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _project_to_dict(row) if row else None


def update_project_any(project_id: str, patch: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Met à jour un projet quel que soit son propriétaire (accès admin)."""
    existing = get_project_any(project_id)
    if existing is None:
        return None
    fields: Dict[str, Any] = {}
    if "title" in patch and patch["title"] is not None:
        fields["title"] = patch["title"]
    if "graph" in patch and patch["graph"] is not None:
        fields["graph"] = json.dumps(patch["graph"])
    if not fields:
        return existing
    fields["updated_at"] = _now()
    cols = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [project_id]
    with _lock, _connect() as conn:
        conn.execute(f"UPDATE projects SET {cols} WHERE id = ?", values)
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return _project_to_dict(row) if row else None


def delete_project(project_id: str, user_id: str) -> bool:
    with _lock, _connect() as conn:
        cur = conn.execute(
            "DELETE FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id)
        )
    return cur.rowcount > 0


def delete_project_any(project_id: str) -> bool:
    with _lock, _connect() as conn:
        cur = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    return cur.rowcount > 0


# --------------------------------------------------------------------------- #
#  Journal d'activité
# --------------------------------------------------------------------------- #
def log_activity(
    action: str,
    user_id: Optional[str] = None,
    email: Optional[str] = None,
    detail: Optional[str] = None,
    ip: Optional[str] = None,
) -> None:
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO activity_log (id, user_id, email, action, detail, ip, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (_new_id(), user_id, email, action, detail, ip, _now()),
        )


def list_activity(limit: int = 100) -> List[Dict[str, Any]]:
    with _lock, _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    return [
        {
            "id": r["id"],
            "userId": r["user_id"],
            "email": r["email"],
            "action": r["action"],
            "detail": r["detail"],
            "ip": r["ip"],
            "createdAt": r["created_at"],
        }
        for r in rows
    ]


# --------------------------------------------------------------------------- #
#  Connexions réutilisables (Talend)
# --------------------------------------------------------------------------- #
def _connection_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "conn_type": row["conn_type"],
        "connection_url": row["connection_url"],
        "description": row["description"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def list_connections(user_id: str) -> List[Dict[str, Any]]:
    with _lock, _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM connections WHERE user_id = ? ORDER BY name ASC", (user_id,)
        ).fetchall()
    return [_connection_to_dict(r) for r in rows]


def get_connection(connection_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT * FROM connections WHERE id = ? AND user_id = ?",
            (connection_id, user_id),
        ).fetchone()
    return _connection_to_dict(row) if row else None


def get_connection_any(connection_id: str) -> Optional[Dict[str, Any]]:
    with _lock, _connect() as conn:
        row = conn.execute("SELECT * FROM connections WHERE id = ?", (connection_id,)).fetchone()
    return _connection_to_dict(row) if row else None


def create_connection(user_id: str, fields: Dict[str, Any]) -> Dict[str, Any]:
    cid = _new_id()
    now = _now()
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO connections
               (id, user_id, name, conn_type, connection_url, description, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                cid, user_id,
                fields["name"].strip(),
                fields.get("conn_type") or "database",
                fields["connection_url"].strip(),
                fields.get("description"),
                now, now,
            ),
        )
        row = conn.execute("SELECT * FROM connections WHERE id = ?", (cid,)).fetchone()
    return _connection_to_dict(row)


def update_connection(connection_id: str, user_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    allowed = {"name", "conn_type", "connection_url", "description"}
    patch = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not patch:
        return get_connection(connection_id, user_id)
    if "name" in patch:
        patch["name"] = patch["name"].strip()
    if "connection_url" in patch:
        patch["connection_url"] = patch["connection_url"].strip()
    patch["updated_at"] = _now()
    cols = ", ".join(f"{k} = ?" for k in patch)
    values = list(patch.values()) + [connection_id, user_id]
    with _lock, _connect() as conn:
        conn.execute(f"UPDATE connections SET {cols} WHERE id = ? AND user_id = ?", values)
        row = conn.execute("SELECT * FROM connections WHERE id = ?", (connection_id,)).fetchone()
    return _connection_to_dict(row) if row else None


def delete_connection(connection_id: str, user_id: str) -> bool:
    with _lock, _connect() as conn:
        cur = conn.execute(
            "DELETE FROM connections WHERE id = ? AND user_id = ?", (connection_id, user_id)
        )
    return cur.rowcount > 0


# --------------------------------------------------------------------------- #
#  Historique d'exécution (Talend / n8n)
# --------------------------------------------------------------------------- #
def create_pipeline_run(
    user_id: Optional[str],
    project_id: Optional[str],
    trigger_type: str = "manual",
    node_count: int = 0,
) -> str:
    rid = _new_id()
    now = _now()
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO pipeline_runs
               (id, project_id, user_id, status, trigger_type, node_count, created_at)
               VALUES (?, ?, ?, 'running', ?, ?, ?)""",
            (rid, project_id, user_id, trigger_type, node_count, now),
        )
    return rid


def finish_pipeline_run(
    run_id: str,
    *,
    status: str,
    duration_ms: float,
    error_message: Optional[str] = None,
    result_summary: Optional[Dict[str, Any]] = None,
) -> None:
    with _lock, _connect() as conn:
        conn.execute(
            """UPDATE pipeline_runs
               SET status = ?, duration_ms = ?, error_message = ?,
                   result_summary = ?, finished_at = ?
               WHERE id = ?""",
            (
                status, duration_ms, error_message,
                json.dumps(result_summary) if result_summary else None,
                _now(), run_id,
            ),
        )


def log_node_run(
    run_id: str,
    node_id: str,
    node_type: str,
    phase: str,
    status: str,
    duration_ms: float,
    row_count: Optional[int] = None,
    error: Optional[str] = None,
) -> None:
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO node_run_logs
               (id, run_id, node_id, node_type, phase, status, duration_ms, row_count, error)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (_new_id(), run_id, node_id, node_type, phase, status, duration_ms, row_count, error),
        )


def list_pipeline_runs(user_id: str, limit: int = 50, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with _lock, _connect() as conn:
        if project_id:
            rows = conn.execute(
                """SELECT r.*, p.title AS project_title
                   FROM pipeline_runs r
                   LEFT JOIN projects p ON p.id = r.project_id
                   WHERE r.user_id = ? AND r.project_id = ?
                   ORDER BY r.created_at DESC LIMIT ?""",
                (user_id, project_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT r.*, p.title AS project_title
                   FROM pipeline_runs r
                   LEFT JOIN projects p ON p.id = r.project_id
                   WHERE r.user_id = ?
                   ORDER BY r.created_at DESC LIMIT ?""",
                (user_id, limit),
            ).fetchall()
    return [_run_to_dict(r) for r in rows]


def get_pipeline_run(run_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    with _lock, _connect() as conn:
        row = conn.execute(
            """SELECT r.*, p.title AS project_title
               FROM pipeline_runs r
               LEFT JOIN projects p ON p.id = r.project_id
               WHERE r.id = ? AND r.user_id = ?""",
            (run_id, user_id),
        ).fetchone()
        if not row:
            return None
        out = _run_to_dict(row)
        logs = conn.execute(
            "SELECT * FROM node_run_logs WHERE run_id = ? ORDER BY rowid ASC", (run_id,)
        ).fetchall()
        out["node_logs"] = [_node_log_to_dict(l) for l in logs]
        return out


def _run_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    summary = None
    if row["result_summary"]:
        try:
            summary = json.loads(row["result_summary"])
        except (json.JSONDecodeError, TypeError):
            summary = None
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "project_title": row["project_title"] if "project_title" in row.keys() else None,
        "user_id": row["user_id"],
        "status": row["status"],
        "trigger_type": row["trigger_type"],
        "node_count": row["node_count"],
        "duration_ms": row["duration_ms"],
        "error_message": row["error_message"],
        "result_summary": summary,
        "created_at": row["created_at"],
        "finished_at": row["finished_at"],
    }


def _node_log_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "run_id": row["run_id"],
        "node_id": row["node_id"],
        "node_type": row["node_type"],
        "phase": row["phase"],
        "status": row["status"],
        "duration_ms": row["duration_ms"],
        "row_count": row["row_count"],
        "error": row["error"],
    }


def get_run_node_logs(run_id: str) -> List[Dict[str, Any]]:
    with _lock, _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM node_run_logs WHERE run_id = ? ORDER BY rowid ASC", (run_id,)
        ).fetchall()
    return [_node_log_to_dict(r) for r in rows]


# --------------------------------------------------------------------------- #
#  Planification (n8n cron)
# --------------------------------------------------------------------------- #
def list_schedules(user_id: str, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with _lock, _connect() as conn:
        if project_id:
            rows = conn.execute(
                "SELECT * FROM schedules WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC",
                (user_id, project_id),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM schedules WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
            ).fetchall()
    return [_schedule_to_dict(r) for r in rows]


def list_all_enabled_schedules() -> List[Dict[str, Any]]:
    with _lock, _connect() as conn:
        rows = conn.execute("SELECT * FROM schedules WHERE enabled = 1").fetchall()
    return [_schedule_to_dict(r) for r in rows]


def create_schedule(user_id: str, project_id: str, cron_expression: str) -> Dict[str, Any]:
    sid = _new_id()
    now = _now()
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO schedules
               (id, project_id, user_id, cron_expression, enabled, created_at, updated_at)
               VALUES (?, ?, ?, ?, 1, ?, ?)""",
            (sid, project_id, user_id, cron_expression.strip(), now, now),
        )
        row = conn.execute("SELECT * FROM schedules WHERE id = ?", (sid,)).fetchone()
    return _schedule_to_dict(row)


def update_schedule(schedule_id: str, user_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    allowed = {"cron_expression", "enabled", "last_run_at", "next_run_at"}
    patch = {k: v for k, v in fields.items() if k in allowed}
    if "enabled" in patch:
        patch["enabled"] = 1 if patch["enabled"] else 0
    if not patch:
        return None
    patch["updated_at"] = _now()
    cols = ", ".join(f"{k} = ?" for k in patch)
    values = list(patch.values()) + [schedule_id, user_id]
    with _lock, _connect() as conn:
        conn.execute(f"UPDATE schedules SET {cols} WHERE id = ? AND user_id = ?", values)
        row = conn.execute("SELECT * FROM schedules WHERE id = ?", (schedule_id,)).fetchone()
    return _schedule_to_dict(row) if row else None


def delete_schedule(schedule_id: str, user_id: str) -> bool:
    with _lock, _connect() as conn:
        cur = conn.execute(
            "DELETE FROM schedules WHERE id = ? AND user_id = ?", (schedule_id, user_id)
        )
    return cur.rowcount > 0


def _schedule_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "user_id": row["user_id"],
        "cron_expression": row["cron_expression"],
        "enabled": bool(row["enabled"]),
        "last_run_at": row["last_run_at"],
        "next_run_at": row["next_run_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


# --------------------------------------------------------------------------- #
#  Webhooks (n8n)
# --------------------------------------------------------------------------- #
def list_webhooks(user_id: str, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with _lock, _connect() as conn:
        if project_id:
            rows = conn.execute(
                "SELECT * FROM webhooks WHERE user_id = ? AND project_id = ?",
                (user_id, project_id),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
            ).fetchall()
    return [_webhook_to_dict(r) for r in rows]


def get_webhook_by_token(token: str) -> Optional[Dict[str, Any]]:
    with _lock, _connect() as conn:
        row = conn.execute(
            "SELECT * FROM webhooks WHERE token = ? AND enabled = 1", (token,)
        ).fetchone()
    return _webhook_to_dict(row) if row else None


def create_webhook(user_id: str, project_id: str, token: str) -> Dict[str, Any]:
    wid = _new_id()
    now = _now()
    with _lock, _connect() as conn:
        conn.execute(
            """INSERT INTO webhooks (id, project_id, user_id, token, enabled, created_at)
               VALUES (?, ?, ?, ?, 1, ?)""",
            (wid, project_id, user_id, token, now),
        )
        row = conn.execute("SELECT * FROM webhooks WHERE id = ?", (wid,)).fetchone()
    return _webhook_to_dict(row)


def delete_webhook(webhook_id: str, user_id: str) -> bool:
    with _lock, _connect() as conn:
        cur = conn.execute(
            "DELETE FROM webhooks WHERE id = ? AND user_id = ?", (webhook_id, user_id)
        )
    return cur.rowcount > 0


def toggle_webhook(webhook_id: str, user_id: str, enabled: bool) -> Optional[Dict[str, Any]]:
    with _lock, _connect() as conn:
        conn.execute(
            "UPDATE webhooks SET enabled = ? WHERE id = ? AND user_id = ?",
            (1 if enabled else 0, webhook_id, user_id),
        )
        row = conn.execute("SELECT * FROM webhooks WHERE id = ?", (webhook_id,)).fetchone()
    return _webhook_to_dict(row) if row else None


def _webhook_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "user_id": row["user_id"],
        "token": row["token"],
        "enabled": bool(row["enabled"]),
        "created_at": row["created_at"],
    }
