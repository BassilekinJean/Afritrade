"""Détection du type de source à partir du nom de fichier ou du contenu."""

from __future__ import annotations

from typing import Optional

# Préfixes pour contenus binaires encodés en base64 dans le DatasetStore.
BINARY_B64_PREFIX = "__binary_b64__:"
SQLITE_B64_PREFIX = "__sqlite_b64__:"


def detect_kind_from_filename(filename: str) -> str:
    lower = (filename or "").lower()
    if lower.endswith(".json"):
        return "json"
    if lower.endswith((".xlsx", ".xls", ".xlsm", ".ods")):
        return "excel"
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith((".docx", ".doc")):
        return "word"
    if lower.endswith((".sql",)):
        return "sql"
    if lower.endswith((".sqlite", ".sqlite3", ".db")):
        return "sqlite"
    if lower.endswith((".csv", ".tsv")):
        return "csv"
    if lower.endswith(".txt"):
        return "txt"
    if lower.endswith((".xml", ".html", ".htm")):
        return "markup"
    return "csv"


def node_kind_for_source_kind(source_kind: str) -> str:
    """Mappe un kind de fichier vers le type de nœud extracteur."""
    mapping = {
        "csv": "source_csv",
        "txt": "source_txt",
        "json": "source_json",
        "sql": "source_sql_file",
        "sqlite": "source_sql_file",
        "excel": "source_excel",
        "pdf": "source_pdf",
        "word": "source_word",
        "markup": "source_txt",
    }
    return mapping.get(source_kind, "source_csv")


def encode_binary(kind: str, data: bytes) -> str:
    import base64

    return f"{BINARY_B64_PREFIX}{kind}:{base64.b64encode(data).decode('ascii')}"


def decode_binary(raw: str) -> tuple[Optional[str], bytes]:
    import base64

    if not raw.startswith(BINARY_B64_PREFIX):
        raise ValueError("Contenu binaire attendu.")
    rest = raw[len(BINARY_B64_PREFIX) :]
    kind, _, b64 = rest.partition(":")
    return kind or None, base64.b64decode(b64)
