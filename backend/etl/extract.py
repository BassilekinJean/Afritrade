"""Phase EXTRACT de l'ETL.

Lit les données depuis les différentes sources (CSV, JSON, base SQL) et les
restitue sous forme de DataFrame pandas « brut » (couche RAW), sans aucune
transformation : c'est la standardisation (phase suivante) qui harmonisera
les formats.
"""

from __future__ import annotations

import base64
import io
import json
import os
import sqlite3
import tempfile
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy import create_engine, text

from .errors import PipelineError

# Préfixe interne marquant un contenu de base SQLite (binaire) encodé en base64.
# Permet de transporter un fichier .sqlite/.db dans le même stockage texte que
# les autres sources (CSV/JSON/SQL) sans casser le contrat existant.
SQLITE_B64_PREFIX = "__sqlite_b64__:"


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


# --------------------------------------------------------------------------- #
#  Import d'un FICHIER SQL : dump .sql (script) ou base .sqlite / .db (binaire)
# --------------------------------------------------------------------------- #
def _list_user_tables(conn: sqlite3.Connection) -> List[str]:
    """Liste les tables utilisateur d'une connexion SQLite (hors tables système)."""
    cur = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    return [row[0] for row in cur.fetchall()]


def _read_chosen_table(conn: sqlite3.Connection, table: Optional[str]) -> pd.DataFrame:
    """Lit la table demandée (ou la première trouvée) d'une base SQLite."""
    tables = _list_user_tables(conn)
    if not tables:
        raise PipelineError("Aucune table trouvée dans le fichier SQL importé.")
    chosen = (table or "").strip() or tables[0]
    if chosen not in tables:
        raise PipelineError(
            f"Table « {chosen} » introuvable. Tables disponibles : {', '.join(tables)}."
        )
    return pd.read_sql_query(f'SELECT * FROM "{chosen}"', conn)


def _read_sql_script(script: str, table: Optional[str]) -> pd.DataFrame:
    """Exécute un dump .sql dans une base SQLite en mémoire, puis lit une table.

    L'exécution est totalement isolée (base éphémère « :memory: ») : aucune
    donnée n'est écrite sur le disque et la base disparaît à la fin de l'appel.
    """
    conn = sqlite3.connect(":memory:")
    try:
        try:
            conn.executescript(script)
        except sqlite3.Error as exc:
            raise PipelineError(f"Script SQL illisible : {exc}") from exc
        return _read_chosen_table(conn, table)
    finally:
        conn.close()


def _read_sqlite_bytes(data: bytes, table: Optional[str]) -> pd.DataFrame:
    """Lit une table d'une base SQLite fournie sous forme d'octets (.sqlite/.db)."""
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        conn = sqlite3.connect(path)
        try:
            return _read_chosen_table(conn, table)
        finally:
            conn.close()
    except sqlite3.Error as exc:
        raise PipelineError(f"Base SQLite illisible : {exc}") from exc
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def extract_sql_file(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    """Extrait un DataFrame depuis un FICHIER SQL importé.

    Deux formats sont acceptés :
      * un dump `.sql` (script `CREATE TABLE` + `INSERT`) exécuté en mémoire ;
      * une base SQLite `.sqlite` / `.db` (octets encodés en base64).

    La table chargée est `config["table"]` si fournie, sinon la première table
    trouvée. Cela permet d'importer un export de core banking system sans avoir
    à configurer une connexion serveur.
    """
    raw = _resolve_content(config, datasets)
    if raw is None:
        raise PipelineError(
            "Fichier SQL vide : importez un fichier .sql ou une base .sqlite/.db."
        )
    table = config.get("table")
    if raw.startswith(SQLITE_B64_PREFIX):
        try:
            data = base64.b64decode(raw[len(SQLITE_B64_PREFIX):])
        except Exception as exc:  # noqa: BLE001
            raise PipelineError(f"Base SQLite corrompue : {exc}") from exc
        return _read_sqlite_bytes(data, table)
    return _read_sql_script(raw, table)


# Aiguillage type de source -> extracteur.
EXTRACTORS = {
    "source_csv": extract_csv,
    "source_json": extract_json,
    "source_sql": extract_sql,
    "source_sql_file": extract_sql_file,
}
