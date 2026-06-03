"""Phase EXTRACT de l'ETL.

Lit les données depuis les différentes sources (CSV, JSON, base SQL) et les
restitue sous forme de DataFrame pandas « brut » (couche RAW), sans aucune
transformation : c'est la standardisation (phase suivante) qui harmonisera
les formats.
"""

from __future__ import annotations

import io
import json
from typing import Any, Dict, Optional

import pandas as pd
from sqlalchemy import create_engine, text

from .errors import PipelineError


def _resolve_content(config: Dict[str, Any], datasets: Dict[str, str]) -> Optional[str]:
    """Récupère le contenu brut : soit un fichier uploadé, soit du contenu inline."""
    dataset_id = config.get("datasetId")
    if dataset_id and dataset_id in datasets:
        return datasets[dataset_id]
    content = config.get("content")
    if content:
        return content
    return None


def _sniff_delimiter(sample: str, fallback: str) -> str:
    """Devine le séparateur d'un CSV francophone (`;`, `,`, tab, `|`)."""
    first_line = sample.splitlines()[0] if sample.splitlines() else ""
    candidates = {sep: first_line.count(sep) for sep in (";", ",", "\t", "|")}
    best = max(candidates, key=candidates.get)
    return best if candidates[best] > 0 else fallback


def extract_csv(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    raw = _resolve_content(config, datasets)
    if raw is None:
        raise PipelineError("Source CSV vide : importez un fichier ou collez du contenu.")
    delimiter = config.get("delimiter") or _sniff_delimiter(raw, ",")
    try:
        return pd.read_csv(io.StringIO(raw), sep=delimiter, dtype=str, keep_default_na=True)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Lecture CSV impossible : {exc}") from exc


def extract_json(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    raw = _resolve_content(config, datasets)
    if raw is None:
        raise PipelineError("Source JSON vide : importez un fichier ou collez du contenu.")
    try:
        parsed = json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"JSON invalide : {exc}") from exc
    if isinstance(parsed, dict):
        # On privilégie la première liste imbriquée (cas {"data": [...]}).
        for value in parsed.values():
            if isinstance(value, list):
                return pd.json_normalize(value)
        return pd.json_normalize(parsed)
    return pd.json_normalize(parsed)


def extract_sql(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    conn = (config.get("connectionString") or "").strip()
    query = (config.get("query") or "").strip()
    if not conn:
        raise PipelineError("Chaîne de connexion SQL manquante.")
    if not query:
        raise PipelineError("Requête SQL manquante.")
    if _is_destructive(query):
        raise PipelineError("Seules les requêtes de lecture (SELECT) sont autorisées en source.")
    try:
        engine = create_engine(conn)
        with engine.connect() as connection:
            return pd.read_sql(text(query), connection)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Connexion / requête SQL échouée : {exc}") from exc


def _is_destructive(query: str) -> bool:
    lowered = query.lower()
    return any(kw in lowered for kw in ("drop ", "delete ", "update ", "insert ", "alter ", "truncate "))


# Aiguillage type de source -> extracteur.
EXTRACTORS = {
    "source_csv": extract_csv,
    "source_json": extract_json,
    "source_sql": extract_sql,
}
