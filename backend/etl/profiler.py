"""Profilage intelligent des jeux de données (data profiling).

Analyse automatique adaptée au type de source :
  - Tabulaire (CSV, Excel, JSON, SQL) : colonnes, types, nulls, cardinalité.
  - Document (PDF, Word, TXT) : structure texte, longueur, paragraphes.
  - Article / page web : titre, URL, blocs de contenu.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import pandas as pd

from .standardize import normalize_column_name


def _detect_dataset_kind(df: pd.DataFrame, source_kind: str = "") -> str:
    cols = {c.lower() for c in df.columns}
    sk = (source_kind or "").lower()
    if sk in ("pdf", "word") or cols <= {"page", "contenu", "source"} | cols <= {"paragraphe", "contenu", "source"}:
        return "document"
    if "titre" in cols and ("url" in cols or "type" in cols):
        return "article"
    if "contenu" in cols and "ligne" in cols and len(df.columns) <= 4:
        return "text"
    if len(df.columns) >= 2 and len(df) > 0:
        return "tabular"
    return "unknown"


def _column_profile(series: pd.Series, col_name: str) -> Dict[str, Any]:
    total = len(series)
    nulls = int(series.isna().sum())
    non_null = series.dropna()
    uniques = int(non_null.nunique()) if len(non_null) else 0
    samples: List[Any] = []
    for v in non_null.head(3):
        s = str(v)
        samples.append(s[:80] + ("…" if len(s) > 80 else ""))

    inferred = "text"
    name_lower = col_name.lower()
    if any(h in name_lower for h in ("date", "jour", "time", "timestamp")):
        inferred = "date_candidate"
    elif any(h in name_lower for h in ("montant", "amount", "prix", "qty", "quantite", "nombre", "total")):
        inferred = "numeric_candidate"
    elif any(h in name_lower for h in ("id", "code", "ref")):
        inferred = "identifier"
    elif pd.api.types.is_numeric_dtype(series):
        inferred = "numeric"
    elif pd.api.types.is_datetime64_any_dtype(series):
        inferred = "date"

    null_pct = round(100 * nulls / total, 1) if total else 0.0
    issues: List[str] = []
    if null_pct > 50:
        issues.append(f"{null_pct}% de valeurs manquantes")
    if uniques == 1 and total > 1:
        issues.append("colonne constante")
    if uniques == total and total > 20 and inferred != "identifier":
        issues.append("cardinalité maximale (identifiant probable)")

    return {
        "name": col_name,
        "normalizedName": normalize_column_name(col_name),
        "inferredType": inferred,
        "nullCount": nulls,
        "nullPercent": null_pct,
        "uniqueCount": uniques,
        "sampleValues": samples,
        "issues": issues,
    }


def _document_profile(df: pd.DataFrame) -> Dict[str, Any]:
    meta: Dict[str, Any] = {"pages": None, "paragraphs": None, "avgLength": None}
    if "page" in df.columns:
        meta["pages"] = int(df["page"].nunique())
    if "paragraphe" in df.columns:
        meta["paragraphs"] = len(df)
    content_col = next((c for c in df.columns if c.lower() in ("contenu", "content", "texte")), None)
    if content_col:
        lengths = df[content_col].dropna().astype(str).str.len()
        if len(lengths):
            meta["avgLength"] = int(lengths.mean())
            meta["totalChars"] = int(lengths.sum())
    return meta


def _article_profile(df: pd.DataFrame) -> Dict[str, Any]:
    meta: Dict[str, Any] = {}
    if "titre" in df.columns and len(df):
        meta["title"] = str(df["titre"].iloc[0])[:200]
    if "url" in df.columns and len(df):
        meta["url"] = str(df["url"].iloc[0])[:300]
    if "type" in df.columns:
        meta["blocks"] = df["type"].value_counts().to_dict()
    return meta


def profile_dataframe(
    df: pd.DataFrame,
    source_kind: str = "",
    label: str = "",
) -> Dict[str, Any]:
    """Construit un rapport de profilage complet pour un DataFrame."""
    if df is None or df.empty:
        return {
            "label": label,
            "sourceKind": source_kind,
            "datasetKind": "empty",
            "rowCount": 0,
            "columnCount": 0,
            "qualityScore": 0,
            "columns": [],
            "issues": ["Jeu de données vide"],
            "recommendations": ["Vérifiez la source ou les paramètres d'import."],
            "documentMeta": {},
        }

    dataset_kind = _detect_dataset_kind(df, source_kind)
    columns = [_column_profile(df[c], str(c)) for c in df.columns]
    total_cells = len(df) * len(df.columns)
    null_cells = int(df.isna().sum().sum())
    completeness = round(100 * (1 - null_cells / total_cells), 1) if total_cells else 0.0

    issues: List[str] = []
    recommendations: List[str] = []

    high_null_cols = [c["name"] for c in columns if c["nullPercent"] > 40]
    if high_null_cols:
        issues.append(f"{len(high_null_cols)} colonne(s) avec >40% de valeurs manquantes")
        recommendations.append("Envisager la suppression ou l'imputation des colonnes très creuses.")

    if dataset_kind == "tabular":
        recommendations.append("Normalisation recommandée : noms snake_case, types harmonisés, dates JJ-MM-AAAA.")
    elif dataset_kind == "document":
        recommendations.append("Texte structuré détecté — exploitable via filtres ou transformations SQL/custom.")
    elif dataset_kind == "article":
        recommendations.append("Article web détecté — titre et paragraphes extraits pour analyse textuelle.")

    col_issues = sum(len(c["issues"]) for c in columns)
    quality = max(0, min(100, int(completeness - col_issues * 3)))

    doc_meta: Dict[str, Any] = {}
    if dataset_kind == "document":
        doc_meta = _document_profile(df)
    elif dataset_kind == "article":
        doc_meta = _article_profile(df)

    return {
        "label": label,
        "sourceKind": source_kind,
        "datasetKind": dataset_kind,
        "rowCount": int(len(df)),
        "columnCount": int(len(df.columns)),
        "completenessPercent": completeness,
        "qualityScore": quality,
        "columns": columns,
        "issues": issues,
        "recommendations": recommendations,
        "documentMeta": doc_meta,
    }
