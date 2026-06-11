"""Requêtes HTTP sortantes (style n8n HTTP Request node)."""

from __future__ import annotations

import json
from typing import Any, Dict

import httpx
import pandas as pd

from .errors import PipelineError


def http_request_to_dataframe(config: Dict[str, Any]) -> pd.DataFrame:
    """Exécute une requête HTTP et convertit la réponse JSON en DataFrame."""
    method = (config.get("method") or "GET").upper()
    url = (config.get("url") or "").strip()
    if not url:
        raise PipelineError("URL HTTP requise.")

    headers: Dict[str, str] = {}
    raw_headers = config.get("headers") or {}
    if isinstance(raw_headers, dict):
        headers = {str(k): str(v) for k, v in raw_headers.items()}

    body = config.get("body")
    if isinstance(body, str) and body.strip():
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            pass
    timeout = float(config.get("timeout") or 30)

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            kwargs: Dict[str, Any] = {"headers": headers}
            if method in ("POST", "PUT", "PATCH") and body:
                if isinstance(body, dict):
                    kwargs["json"] = body
                else:
                    kwargs["content"] = str(body)
            resp = client.request(method, url, **kwargs)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "json" in content_type or resp.text.strip().startswith(("{", "[")):
                data = resp.json()
                if isinstance(data, list):
                    return pd.json_normalize(data)
                if isinstance(data, dict):
                    for key in ("data", "results", "items", "records"):
                        if key in data and isinstance(data[key], list):
                            return pd.json_normalize(data[key])
                    return pd.json_normalize([data])
            # Texte / CSV léger
            text = resp.text.strip()
            if not text:
                return pd.DataFrame([{"status_code": resp.status_code, "url": url}])
            from io import StringIO
            try:
                return pd.read_csv(StringIO(text))
            except Exception:  # noqa: BLE001
                return pd.DataFrame([{"response": text[:2000], "status_code": resp.status_code}])
    except httpx.HTTPError as exc:
        raise PipelineError(f"Requête HTTP échouée : {exc}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineError(f"Réponse JSON invalide : {exc}") from exc
