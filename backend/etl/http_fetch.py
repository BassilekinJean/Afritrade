"""Téléchargement HTTP robuste pour les sources URL."""

from __future__ import annotations

from typing import Tuple
from urllib.parse import urlparse

from .errors import PipelineError

# En-têtes réalistes : sans User-Agent, Wikipedia et beaucoup de sites renvoient 403.
_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; DataPipe/2.0; +https://datapipe.local) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/json,text/csv,application/pdf,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}


def fetch_url_bytes(url: str, *, timeout: float = 45.0) -> Tuple[bytes, str, str]:
    """Télécharge une URL. Retourne (contenu_bytes, content_type, url_finale)."""
    try:
        import httpx
    except ImportError as exc:
        raise PipelineError("Support URL indisponible (httpx manquant).") from exc

    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise PipelineError("URL invalide : utilisez http:// ou https://")

    try:
        with httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            headers=_DEFAULT_HEADERS,
            trust_env=False,
        ) as client:
            resp = client.get(url.strip())
            if resp.status_code == 403:
                raise PipelineError(
                    "Accès refusé (403) par le site distant. "
                    "Téléchargez le fichier sur votre poste puis importez-le via « Fichier », "
                    "ou utilisez une URL directe vers un CSV/JSON public."
                )
            if resp.status_code == 401:
                raise PipelineError("Accès non autorisé (401). Cette ressource exige une authentification.")
            resp.raise_for_status()
            ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
            return resp.content, ctype, str(resp.url)
    except PipelineError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Impossible d'accéder à l'URL : {exc}") from exc
