"""Règles de validation de qualité (style Talend Data Quality)."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List

import pandas as pd

from .errors import PipelineError


def _apply_rule(series: pd.Series, rule: Dict[str, Any]) -> pd.Series:
    """Retourne un masque booléen : True = valide."""
    rtype = (rule.get("rule") or rule.get("type") or "not_null").lower()
    value = rule.get("value")

    if rtype == "not_null":
        return series.notna() & (series.astype(str).str.strip() != "")
    if rtype == "regex":
        pattern = str(value or ".*")
        return series.astype(str).str.match(pattern, na=False)
    if rtype == "min":
        numeric = pd.to_numeric(series, errors="coerce")
        return numeric >= float(value)
    if rtype == "max":
        numeric = pd.to_numeric(series, errors="coerce")
        return numeric <= float(value)
    if rtype == "in_list":
        allowed = {str(v).strip() for v in (value or [])}
        return series.astype(str).isin(allowed)
    if rtype == "unique":
        return ~series.duplicated(keep=False)
    raise PipelineError(f"Règle de validation inconnue : {rtype}")


def validate_dataframe(df: pd.DataFrame, config: Dict[str, Any]) -> tuple[pd.DataFrame, Dict[str, Any]]:
    """Applique des règles métier et filtre ou marque les lignes invalides."""
    rules: List[Dict[str, Any]] = config.get("rules") or []
    if isinstance(rules, str):
        try:
            rules = json.loads(rules)
        except json.JSONDecodeError:
            rules = []
    mode = (config.get("mode") or "reject").lower()

    if not rules:
        return df, {"validCount": len(df), "invalidCount": 0, "violations": []}

    valid_mask = pd.Series(True, index=df.index)
    violations: List[Dict[str, Any]] = []

    for rule in rules:
        col = rule.get("column") or rule.get("field")
        if not col or col not in df.columns:
            raise PipelineError(f"Colonne introuvable pour la règle : {col}")
        mask = _apply_rule(df[col], rule)
        invalid = int((~mask).sum())
        if invalid:
            violations.append({
                "column": col,
                "rule": rule.get("rule") or rule.get("type"),
                "count": invalid,
                "message": rule.get("message") or f"Violation sur {col}",
            })
        valid_mask &= mask

    invalid_count = int((~valid_mask).sum())
    report = {
        "validCount": int(valid_mask.sum()),
        "invalidCount": invalid_count,
        "violations": violations,
    }

    if mode == "flag":
        out = df.copy()
        out["_validation_ok"] = valid_mask
        return out, report
    if mode == "warn":
        return df, report
    # reject (défaut)
    return df[valid_mask].reset_index(drop=True), report
