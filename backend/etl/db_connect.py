"""Résolution des URLs de connexion base de données."""

from __future__ import annotations

from pathlib import Path

from . import config


def resolve_connection_url(url: str) -> str:
    """Normalise les chemins SQLite relatifs vers des chemins absolus."""
    u = (url or "").strip()
    if not u:
        return u
    # sqlite:///./chemin/relatif.db  -> absolu sous DATA_DIR ou cwd backend
    if u.startswith("sqlite:///./"):
        rel = u[len("sqlite:///./") :]
        candidates = [
            config.DATA_DIR / rel,
            Path(__file__).resolve().parent.parent / rel,
            Path.cwd() / rel,
        ]
        for p in candidates:
            if p.parent.exists() or p.exists():
                return f"sqlite:///{p.resolve()}"
        # Crée le parent si besoin pour une nouvelle base
        target = (config.DATA_DIR / rel).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{target}"
    if u.startswith("sqlite:///") and not u.startswith("sqlite:////"):
        # sqlite:///abs/path sans le 4e slash — déjà valide sur Linux
        path_part = u[len("sqlite:///") :]
        if path_part and not path_part.startswith("/"):
            resolved = (config.DATA_DIR / path_part).resolve()
            return f"sqlite:///{resolved}"
    return u


def default_sqlite_hint() -> str:
    """URL SQLite de la base applicative (pour démo)."""
    db = (config.DATA_DIR / "datapipe.sqlite").resolve()
    return f"sqlite:///{db}"
