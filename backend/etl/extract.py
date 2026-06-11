"""Phase EXTRACT de l'ETL.

Lit les données depuis les différentes sources (fichiers, liens web, bases
externes) et les restitue sous forme de DataFrame pandas « brut » (couche RAW).
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import sqlite3
import tempfile
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import pandas as pd

from .errors import PipelineError
from .kind_detect import BINARY_B64_PREFIX, SQLITE_B64_PREFIX, decode_binary, detect_kind_from_filename


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


def _text_to_lines_df(text: str, source: str = "texte") -> pd.DataFrame:
    """Convertit un texte libre en tableau (ligne, contenu)."""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return pd.DataFrame([{"ligne": 1, "contenu": "", "source": source}])
    return pd.DataFrame(
        [{"ligne": i + 1, "contenu": ln, "source": source} for i, ln in enumerate(lines)]
    )


def extract_txt(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    raw = _resolve_content(config, datasets)
    if raw is None:
        raise PipelineError("Fichier texte vide : importez un .txt ou collez du contenu.")
    if raw.startswith(BINARY_B64_PREFIX):
        _, data = decode_binary(raw)
        raw = data.decode("utf-8", errors="replace")
    return _text_to_lines_df(raw, config.get("__filename") or "texte")


def extract_excel(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    raw = _resolve_content(config, datasets)
    if raw is None:
        raise PipelineError("Fichier Excel vide : importez un .xlsx ou .xls.")
    sheet = (config.get("sheet") or "").strip() or 0
    try:
        if raw.startswith(BINARY_B64_PREFIX):
            kind, data = decode_binary(raw)
            buf = io.BytesIO(data)
            return pd.read_excel(buf, sheet_name=sheet, dtype=str)
        return pd.read_excel(io.StringIO(raw), sheet_name=sheet, dtype=str)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Lecture Excel impossible : {exc}") from exc


def extract_pdf(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    raw = _resolve_content(config, datasets)
    if raw is None:
        raise PipelineError("Fichier PDF vide : importez un document .pdf.")
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise PipelineError("Support PDF indisponible (pypdf manquant).") from exc
    try:
        if raw.startswith(BINARY_B64_PREFIX):
            _, data = decode_binary(raw)
            reader = PdfReader(io.BytesIO(data))
        else:
            reader = PdfReader(io.BytesIO(raw.encode("latin-1")))
        pages: List[Dict[str, Any]] = []
        for i, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            pages.append({"page": i, "contenu": text, "source": config.get("__filename") or "pdf"})
        if not pages:
            return pd.DataFrame([{"page": 1, "contenu": "", "source": "pdf"}])
        return pd.DataFrame(pages)
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Lecture PDF impossible : {exc}") from exc


def extract_word(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    raw = _resolve_content(config, datasets)
    if raw is None:
        raise PipelineError("Document Word vide : importez un .docx.")
    try:
        from docx import Document
    except ImportError as exc:
        raise PipelineError("Support Word indisponible (python-docx manquant).") from exc
    try:
        if not raw.startswith(BINARY_B64_PREFIX):
            raise PipelineError("Seuls les fichiers .docx sont supportés.")
        _, data = decode_binary(raw)
        doc = Document(io.BytesIO(data))
        rows = [
            {"paragraphe": i + 1, "contenu": p.text.strip(), "source": config.get("__filename") or "word"}
            for i, p in enumerate(doc.paragraphs)
            if p.text.strip()
        ]
        if not rows:
            return pd.DataFrame([{"paragraphe": 1, "contenu": "", "source": "word"}])
        return pd.DataFrame(rows)
    except PipelineError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Lecture Word impossible : {exc}") from exc


def _fetch_url_content(url: str) -> tuple[str, str]:
    """Télécharge une URL et renvoie (kind, contenu texte ou binaire encodé)."""
    from .http_fetch import fetch_url_bytes
    from .kind_detect import encode_binary

    raw, ctype, final_url = fetch_url_bytes(url)
    url_l = final_url.lower()

    def _decode_text(data: bytes) -> str:
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                return data.decode(enc)
            except UnicodeDecodeError:
                continue
        return data.decode("utf-8", errors="replace")

    if "json" in ctype or url_l.endswith(".json"):
        return "json", _decode_text(raw)
    if "csv" in ctype or url_l.endswith(".csv") or ("text/plain" in ctype and "," in _decode_text(raw[:2000])):
        return "csv", _decode_text(raw)
    if "pdf" in ctype or url_l.endswith(".pdf"):
        return "pdf", encode_binary("pdf", raw)
    # Pages web (Wikipedia, articles…) : HTML prioritaire sur text/plain
    if (
        "html" in ctype
        or url_l.endswith((".html", ".htm"))
        or "text/html" in ctype
        or "application/xhtml" in ctype
        or (not url_l.endswith((".csv", ".json", ".pdf", ".txt")) and raw[:256].lstrip().startswith((b"<", b"<!")))
    ):
        return "html", _decode_text(raw)
    return "txt", _decode_text(raw)


def _html_to_df(html: str, url: str) -> pd.DataFrame:
    try:
        from bs4 import BeautifulSoup
    except ImportError as exc:
        raise PipelineError("Support HTML indisponible (beautifulsoup4 manquant).") from exc
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    title = (soup.title.string or "").strip() if soup.title else ""
    paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p") if p.get_text(strip=True)]
    if not paragraphs:
        text = soup.get_text("\n", strip=True)
        paragraphs = [ln for ln in text.splitlines() if len(ln) > 40][:50]
    rows: List[Dict[str, Any]] = [{"titre": title, "url": url, "type": "article", "contenu": title}]
    for i, p in enumerate(paragraphs[:100], start=1):
        rows.append({"titre": title, "url": url, "type": "paragraphe", "contenu": p, "ordre": i})
    return pd.DataFrame(rows)


def extract_url(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    url = (config.get("url") or "").strip()
    if not url:
        raise PipelineError("Indiquez une adresse web (URL).")
    dataset_id = config.get("datasetId")
    if dataset_id and dataset_id in datasets:
        stored = datasets[dataset_id]
        kind = config.get("sourceKind") or "txt"
        if kind == "json":
            return extract_json({**config, "content": stored}, {})
        if kind == "csv":
            return extract_csv({**config, "content": stored}, {})
        if kind == "html":
            return _html_to_df(stored, url)
        if kind == "pdf":
            return extract_pdf({**config, "content": stored}, {})
        return _text_to_lines_df(stored, url)
    kind, content = _fetch_url_content(url)
    if kind == "json":
        return extract_json({"content": content}, {})
    if kind == "csv":
        return extract_csv({"content": content}, {})
    if kind == "html":
        return _html_to_df(content, url)
    if kind == "pdf":
        return extract_pdf({"content": content}, {})
    return _text_to_lines_df(content, url)


def extract_database(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    """Lit une table ou exécute une requête SELECT sur une base externe."""
    from .db_connect import resolve_connection_url

    conn_url = (config.get("connectionUrl") or config.get("connection_url") or "").strip()
    if not conn_url and config.get("connectionId"):
        conn_url = _resolve_connection_url(config.get("connectionId"))
    conn_url = resolve_connection_url(conn_url)
    if not conn_url:
        raise PipelineError("Indiquez l'URL de connexion à la base (ex. sqlite:///./.data/datapipe.sqlite).")
    query = (config.get("query") or "").strip()
    table = (config.get("table") or "").strip()
    limit = int(config.get("limit") or 5000)
    if not query:
        if not table:
            raise PipelineError("Indiquez une table ou une requête SQL SELECT.")
        if not re.match(r"^[\w.]+$", table):
            raise PipelineError("Nom de table invalide.")
        query = f'SELECT * FROM "{table}"'
    q_lower = query.lower()
    if not q_lower.strip().startswith("select"):
        raise PipelineError("Seules les requêtes SELECT sont autorisées.")
    for forbidden in ("drop", "delete", "update", "insert", "alter", "truncate", "create"):
        if forbidden in q_lower:
            raise PipelineError(f"Requête refusée : mot-clé « {forbidden} » interdit.")
    try:
        from sqlalchemy import create_engine, text
    except ImportError as exc:
        raise PipelineError("SQLAlchemy indisponible.") from exc
    try:
        engine = create_engine(conn_url)
        with engine.connect() as conn:
            df = pd.read_sql(text(query), conn)
        if len(df) > limit:
            df = df.head(limit)
        return df.astype(str) if not df.empty else df
    except Exception as exc:  # noqa: BLE001
        raise PipelineError(f"Connexion base de données impossible : {exc}") from exc


def _resolve_connection_url(connection_id: str) -> str:
    """Résout une connexion enregistrée (référentiel Talend)."""
    try:
        import database

        conn = database.get_connection_any(connection_id)
        if conn and conn.get("connection_url"):
            return conn["connection_url"]
    except Exception:  # noqa: BLE001
        pass
    return ""


def extract_trigger(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    """Nœud déclencheur n8n : émet un enregistrement de métadonnées."""
    from datetime import datetime, timezone

    payload = config.get("payload") or {}
    return pd.DataFrame([{
        "_trigger": config.get("triggerType") or "manual",
        "_triggered_at": datetime.now(timezone.utc).isoformat(),
        "_payload": json.dumps(payload) if isinstance(payload, dict) else str(payload),
    }])


def extract_trigger_manual(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    return extract_trigger({**config, "triggerType": "manual"}, datasets)


def extract_trigger_webhook(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    return extract_trigger({**config, "triggerType": "webhook"}, datasets)


def extract_trigger_schedule(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    return extract_trigger({**config, "triggerType": "schedule"}, datasets)


def extract_file(config: Dict[str, Any], datasets: Dict[str, str]) -> pd.DataFrame:
    """Extracteur universel : délègue selon sourceKind enregistré à l'import."""
    kind = (config.get("sourceKind") or config.get("__kind") or "csv").lower()
    dispatch = {
        "csv": extract_csv,
        "txt": extract_txt,
        "json": extract_json,
        "sql": extract_sql_file,
        "sqlite": extract_sql_file,
        "excel": extract_excel,
        "pdf": extract_pdf,
        "word": extract_word,
        "markup": extract_txt,
    }
    fn = dispatch.get(kind, extract_csv)
    return fn(config, datasets)


# Aiguillage type de nœud -> extracteur.
EXTRACTORS = {
    "source_csv": extract_csv,
    "source_json": extract_json,
    "source_sql_file": extract_sql_file,
    "source_txt": extract_txt,
    "source_excel": extract_excel,
    "source_pdf": extract_pdf,
    "source_word": extract_word,
    "source_url": extract_url,
    "source_database": extract_database,
    "source_file": extract_file,
    "trigger_manual": extract_trigger_manual,
    "trigger_webhook": extract_trigger_webhook,
    "trigger_schedule": extract_trigger_schedule,
}
