"""Export des jeux de données normalisés vers différents formats de stockage."""

from __future__ import annotations

import io
import json
from typing import Any, Dict, Tuple

import pandas as pd

from .errors import PipelineError


def export_dataframe(
    df: pd.DataFrame,
    fmt: str,
    *,
    filename: str = "export",
    table_name: str = "dataset",
    csv_delimiter: str = ";",
) -> Tuple[bytes, str, str]:
    """Exporte un DataFrame. Retourne (contenu_bytes, mime_type, nom_fichier)."""
    fmt_l = (fmt or "csv").lower().strip()
    base = filename.replace(".", "_")[:80] or "export"

    if fmt_l == "csv":
        buf = io.StringIO()
        df.to_csv(buf, index=False, sep=csv_delimiter)
        return buf.getvalue().encode("utf-8-sig"), "text/csv", f"{base}.csv"

    if fmt_l == "json":
        records = json.loads(df.to_json(orient="records", date_format="iso", default_handler=str))
        body = json.dumps(records, ensure_ascii=False, indent=2)
        return body.encode("utf-8"), "application/json", f"{base}.json"

    if fmt_l == "jsonl":
        lines = df.to_json(orient="records", lines=True, date_format="iso", default_handler=str)
        return lines.encode("utf-8"), "application/x-ndjson", f"{base}.jsonl"

    if fmt_l == "sqlite":
        import os
        import sqlite3
        import tempfile

        safe = "".join(c if c.isalnum() or c == "_" else "_" for c in table_name)[:60] or "dataset"
        fd, path = tempfile.mkstemp(suffix=".sqlite")
        os.close(fd)
        try:
            conn = sqlite3.connect(path)
            df.to_sql(safe, conn, index=False, if_exists="replace")
            conn.close()
            with open(path, "rb") as fh:
                data = fh.read()
            return data, "application/x-sqlite3", f"{base}.sqlite"
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass

    if fmt_l == "parquet":
        try:
            buf = io.BytesIO()
            df.to_parquet(buf, index=False)
            return buf.getvalue(), "application/octet-stream", f"{base}.parquet"
        except Exception as exc:  # noqa: BLE001
            raise PipelineError(
                "Export Parquet indisponible (installez pyarrow : pip install pyarrow)."
            ) from exc

    raise PipelineError(f"Format d'export non supporté : {fmt}")


def export_preview_meta(df: pd.DataFrame, fmt: str) -> Dict[str, Any]:
    return {
        "format": fmt,
        "rowCount": int(len(df)),
        "columnCount": int(len(df.columns)),
        "columns": list(df.columns),
    }
