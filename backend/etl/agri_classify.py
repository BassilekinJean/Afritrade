"""Classification sémantique des sources de données agricoles."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import pandas as pd

from .agri_taxonomy import AGRI_DOMAINS, domain_labels
from .embeddings import classify_text, semantic_similarity


def _sample_cell_values(df: pd.DataFrame, max_cols: int = 15, max_rows: int = 4) -> List[str]:
    parts: List[str] = []
    for col in list(df.columns)[:max_cols]:
        parts.append(str(col))
        series = df[col].dropna()
        for v in series.head(max_rows):
            s = str(v).strip()
            if s and s.lower() not in ("nan", "none"):
                parts.append(s[:120])
    return parts


def build_source_text(
    df: pd.DataFrame,
    label: str = "",
    source_kind: str = "",
    filename: str = "",
    url: str = "",
) -> str:
    """Construit une représentation textuelle d'une source pour l'embedding."""
    chunks: List[str] = [label, source_kind, filename, url]
    if df is None or df.empty:
        return " ".join(c for c in chunks if c)

    chunks.extend(_sample_cell_values(df))

    # Contenu textuel long (PDF, articles web)
    for col in ("contenu", "content", "texte", "titre", "title"):
        if col in df.columns:
            for v in df[col].dropna().head(5):
                chunks.append(str(v)[:300])

    return " ".join(c for c in chunks if c)


def classify_dataframe(
    df: pd.DataFrame,
    *,
    label: str = "",
    source_kind: str = "",
    filename: str = "",
    url: str = "",
) -> Dict[str, Any]:
    """Classifie une source selon la taxonomie agricole."""
    text = build_source_text(df, label=label, source_kind=source_kind, filename=filename, url=url)
    result = classify_text(text)
    domain_id = str(result["domain"])
    labels = domain_labels()
    result["domainLabel"] = labels.get(domain_id, domain_id)
    result["sourceTextLength"] = len(text)
    result["agriKeywords"] = _detect_agri_keywords(text)
    return result


def _detect_agri_keywords(text: str) -> List[str]:
    lower = (text or "").lower()
    keywords = [
        "maïs", "mais", "riz", "cacao", "café", "cafe", "manioc", "arachide",
        "coopérative", "cooperative", "rendement", "hectare", "pluie", "saison",
        "prix", "marché", "marche", "engrais", "semence", "récolte", "recolte",
        "élevage", "elevage", "irrigation", "sol", "export", "producteur",
    ]
    return [k for k in keywords if k in lower][:12]


def classify_sources_batch(
    sources: List[Dict[str, Any]],
    datasets: Dict[str, str],
) -> Dict[str, Any]:
    """Classifie plusieurs sources et propose des liens inter-sources."""
    from .errors import PipelineError
    from .extract import EXTRACTORS

    classified: List[Dict[str, Any]] = []
    errors: List[str] = []

    for src in sources:
        sid = src.get("id") or "?"
        ntype = src.get("type") or ""
        cfg = src.get("config") or {}
        label = src.get("label") or sid
        entry: Dict[str, Any] = {"id": sid, "label": label, "type": ntype}

        try:
            if ntype not in EXTRACTORS:
                raise PipelineError(f"Type inconnu : {ntype}")
            df = EXTRACTORS[ntype](cfg, datasets)
            clf = classify_dataframe(
                df,
                label=label,
                source_kind=str(cfg.get("sourceKind") or cfg.get("__kind") or ""),
                filename=str(cfg.get("__filename") or ""),
                url=str(cfg.get("url") or cfg.get("__url") or ""),
            )
            entry["classification"] = clf
            entry["columns"] = list(df.columns)
            entry["rowCount"] = int(len(df))
        except Exception as exc:  # noqa: BLE001
            entry["error"] = str(exc)
            errors.append(f"{label}: {exc}")

        classified.append(entry)

    cross_links = _cross_source_links(classified)
    fusion = _suggest_fusion(classified)

    return {
        "sources": classified,
        "summary": {
            "total": len(sources),
            "classified": sum(1 for c in classified if "classification" in c),
            "domains": _domain_distribution(classified),
        },
        "crossSourceLinks": cross_links,
        "fusionSuggestions": fusion,
        "errors": errors,
        "theme": "Analyse causale et prédiction — sources multiples agricoles",
    }


def _domain_distribution(classified: List[Dict[str, Any]]) -> Dict[str, int]:
    dist: Dict[str, int] = {}
    for c in classified:
        clf = c.get("classification") or {}
        d = clf.get("domain")
        if d:
            dist[str(d)] = dist.get(str(d), 0) + 1
    return dist


def _normalize_col(name: str) -> str:
    return str(name).lower().replace(" ", "_").replace("-", "_")


def _cross_source_links(classified: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Liens sémantiques et colonnes communes entre sources."""
    links: List[Dict[str, Any]] = []
    ok = [c for c in classified if "classification" in c]

    for i, a in enumerate(ok):
        for b in ok[i + 1 :]:
            cols_a = {_normalize_col(c) for c in a.get("columns", [])}
            cols_b = {_normalize_col(c) for c in b.get("columns", [])}
            common = sorted(cols_a & cols_b)
            dom_a = (a.get("classification") or {}).get("domain", "")
            dom_b = (b.get("classification") or {}).get("domain", "")
            label_a = (a.get("classification") or {}).get("domainLabel", dom_a)
            label_b = (b.get("classification") or {}).get("domainLabel", dom_b)

            sim = 0.0
            if dom_a and dom_b:
                desc_a = AGRI_DOMAINS.get(dom_a, {}).get("description", dom_a)
                desc_b = AGRI_DOMAINS.get(dom_b, {}).get("description", dom_b)
                sim = semantic_similarity(desc_a, desc_b)

            causal_hint = _causal_hint(dom_a, dom_b)

            if common or sim > 0.15 or causal_hint:
                links.append({
                    "sourceA": a.get("label"),
                    "sourceB": b.get("label"),
                    "domainA": label_a,
                    "domainB": label_b,
                    "commonColumns": common[:10],
                    "semanticSimilarity": round(sim, 3),
                    "causalHypothesis": causal_hint,
                    "joinSuggestion": common[0] if common else None,
                })
    return links


def _causal_hint(dom_a: str, dom_b: str) -> Optional[str]:
    """Hypothèses causales métier entre domaines agricoles."""
    pairs = {
        frozenset({"meteo_climat", "production"}): (
            "La météo (pluie, sécheresse) influence probablement le rendement agricole."
        ),
        frozenset({"meteo_climat", "prix_marche"}): (
            "Les aléas climatiques peuvent impacter les prix de marché par effet offre."
        ),
        frozenset({"intrants_logistique", "production"}): (
            "Les intrants (engrais, semences) sont un facteur causal du rendement."
        ),
        frozenset({"production", "prix_marche"}): (
            "Le volume de production peut expliquer les variations de prix (loi de l'offre)."
        ),
        frozenset({"politique_subventions", "production"}): (
            "Les subventions publiques influencent les décisions de production."
        ),
        frozenset({"sante_sols", "production"}): (
            "La santé des sols et l'irrigation sont des déterminants du rendement."
        ),
        frozenset({"cooperative_commerce", "prix_marche"}): (
            "Les flux commerciaux des coopératives alimentent les données de prix."
        ),
    }
    key = frozenset({dom_a, dom_b})
    return pairs.get(key)


def _suggest_fusion(classified: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Suggère des fusions multi-sources pour analyse causale."""
    suggestions: List[Dict[str, Any]] = []
    ok = [c for c in classified if "classification" in c]
    if len(ok) < 2:
        return suggestions

    production = [c for c in ok if (c.get("classification") or {}).get("domain") == "production"]
    meteo = [c for c in ok if (c.get("classification") or {}).get("domain") == "meteo_climat"]
    prix = [c for c in ok if (c.get("classification") or {}).get("domain") == "prix_marche"]

    if production and meteo:
        suggestions.append({
            "goal": "Prédire le rendement selon les conditions climatiques",
            "sources": [production[0]["label"], meteo[0]["label"]],
            "method": "join + causal_analysis + predict",
            "targetDomain": "production",
        })
    if production and prix:
        suggestions.append({
            "goal": "Analyser l'effet de la production sur les prix",
            "sources": [production[0]["label"], prix[0]["label"]],
            "method": "join + causal_analysis",
            "targetDomain": "prix_marche",
        })
    if len(ok) >= 2 and not suggestions:
        suggestions.append({
            "goal": "Fusion multi-sources pour analyse causale transversale",
            "sources": [ok[0]["label"], ok[1]["label"]],
            "method": "union ou join + embed_text + causal_analysis",
            "targetDomain": "multi",
        })
    return suggestions
