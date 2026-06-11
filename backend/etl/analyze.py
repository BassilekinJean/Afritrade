"""Analyse et normalisation batch de plusieurs sources."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from .errors import PipelineError
from .extract import EXTRACTORS
from .profiler import profile_dataframe
from .standardize import standardize


def analyze_sources(
    sources: List[Dict[str, Any]],
    datasets: Dict[str, str],
    *,
    apply_normalize: bool = False,
    normalize_options: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Extrait, profile et optionnellement normalise chaque source."""
    opts = normalize_options or {}
    drop_null_pct = float(opts.get("dropNullColumnPct") or 0)
    fill_nulls = str(opts.get("fillNumericNulls") or "none")
    drop_dupes = bool(opts.get("dropDuplicates"))
    drop_empty = opts.get("dropEmptyRows", True)

    results: List[Dict[str, Any]] = []
    errors: List[str] = []

    for src in sources:
        sid = src.get("id") or "?"
        ntype = src.get("type") or ""
        cfg = src.get("config") or {}
        label = src.get("label") or sid
        source_kind = cfg.get("sourceKind") or cfg.get("__kind") or ""

        entry: Dict[str, Any] = {"id": sid, "type": ntype, "label": label}
        try:
            if ntype not in EXTRACTORS:
                raise PipelineError(f"Type de source inconnu : {ntype}")
            raw = EXTRACTORS[ntype](cfg, datasets)
            profile = profile_dataframe(raw, source_kind=source_kind, label=label)
            entry["profile"] = profile
            entry["rawPreview"] = {
                "rowCount": int(len(raw)),
                "columns": list(raw.columns),
            }

            if apply_normalize:
                clean, report = standardize(
                    raw,
                    drop_empty_rows=bool(drop_empty),
                    drop_null_column_pct=drop_null_pct,
                    fill_numeric_nulls=fill_nulls,
                    drop_duplicates=drop_dupes,
                )
                entry["normalized"] = {
                    "rowCount": int(len(clean)),
                    "columns": list(clean.columns),
                    "standardization": report.as_dict(),
                }
                entry["profile"]["qualityScoreAfter"] = min(
                    100,
                    profile.get("qualityScore", 0) + 10,
                )
        except PipelineError as exc:
            entry["error"] = str(exc)
            errors.append(f"{label}: {exc}")
        except Exception as exc:  # noqa: BLE001
            entry["error"] = str(exc)
            errors.append(f"{label}: {exc}")

        results.append(entry)

    ok = [r for r in results if "error" not in r]
    return {
        "sources": results,
        "summary": {
            "total": len(sources),
            "success": len(ok),
            "failed": len(sources) - len(ok),
            "avgQuality": round(
                sum(r.get("profile", {}).get("qualityScore", 0) for r in ok) / max(len(ok), 1),
                1,
            ),
        },
        "errors": errors,
        "normalized": apply_normalize,
    }
