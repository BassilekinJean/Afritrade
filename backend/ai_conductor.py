"""Conducteur IA — planification interactive du pipeline DataPipe.

Flux : import → intention → plan proposé → validation étape par étape.
Fonctionne en heuristique locale ; enrichi par OpenAI si OPENAI_API_KEY est défini.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from typing import Any, Dict, List, Optional

import database

import ai as ai_module

# Sessions en mémoire (hackathon / MVP)
_sessions: Dict[str, Dict[str, Any]] = {}

ACTION_LABELS = {
    "login": "Connexion",
    "logout": "Déconnexion",
    "project_created": "Projet créé",
    "project_deleted": "Projet supprimé",
    "pipeline_run": "Pipeline exécuté",
    "export": "Export de données",
    "password_changed": "Mot de passe modifié",
    "conductor_plan": "Plan pipeline IA accepté",
    "conductor_step": "Étape pipeline IA appliquée",
}


def _msg(role: str, content: str) -> Dict[str, str]:
    return {"role": role, "content": content}


def _guess_target_column(columns: List[str], *keywords: str) -> Optional[str]:
    for col in columns:
        cl = col.lower()
        if any(k in cl for k in keywords):
            return col
    return columns[0] if columns else None


def _extract_crop(intent: str) -> Optional[str]:
    m = re.search(r"\b(ma[iï]s|riz|manioc|cacao|caf[eé]|arachide|bl[eé])\b", intent, re.I)
    return m.group(1) if m else None


def _build_heuristic_plan(intent: str, columns: List[str], source_label: str) -> Dict[str, Any]:
    """Construit un plan ETL agricole à partir de l'intention utilisateur."""
    intent_l = intent.lower()
    cols_txt = ", ".join(columns[:12]) if columns else "colonnes à détecter"
    steps: List[Dict[str, Any]] = []
    order = 1

    steps.append(
        {
            "id": f"step_{order}",
            "order": order,
            "title": "Analyser la qualité des données",
            "description": (
                f"Profilage automatique de « {source_label} » ({cols_txt}) : "
                "doublons, valeurs manquantes, domaine agricole (embeddings)."
            ),
            "action": "quality_check",
            "nodeKind": None,
            "config": {},
            "tab": "quality",
        }
    )
    order += 1

    if any(k in intent_l for k in ["classif", "domaine", "agricole", "embed"]):
        steps.append(
            {
                "id": f"step_{order}",
                "order": order,
                "title": "Classification agricole (embeddings)",
                "description": "Ajouter le nœud Classification pour taguer prix, production, météo…",
                "action": "add_node",
                "nodeKind": "agri_classify",
                "config": {"textColumn": _guess_target_column(columns, "message", "contenu", "texte", "description") or ""},
                "connectTo": "chain",
            }
        )
        order += 1

    crop = _extract_crop(intent)
    if crop or any(k in intent_l for k in ["filtr", "garder", "seulement", "uniquement"]):
        expr = f"culture == '{crop}'" if crop else "True  # à affiner"
        if _guess_target_column(columns, "culture", "produit", "crop"):
            steps.append(
                {
                    "id": f"step_{order}",
                    "order": order,
                    "title": f"Filtrer les données{f' ({crop})' if crop else ''}",
                    "description": "Conserver uniquement les lignes utiles pour votre analyse.",
                    "action": "add_node",
                    "nodeKind": "filter",
                    "config": {"expression": expr},
                    "connectTo": "chain",
                    "codePrompt": f"Filtrer uniquement le {crop}" if crop else intent,
                }
            )
            order += 1

    if any(k in intent_l for k in ["doublon", "nettoy", "qualité", "missing", "vide"]):
        steps.append(
            {
                "id": f"step_{order}",
                "order": order,
                "title": "Nettoyer les doublons",
                "description": "Transformation pandas : déduplication et suppression des lignes vides.",
                "action": "add_node",
                "nodeKind": "custom",
                "config": {},
                "connectTo": "chain",
                "codePrompt": "Supprimer les doublons et les lignes vides",
            }
        )
        order += 1

    if any(k in intent_l for k in ["région", "region", "somme", "total", "agréger", "group", "prix"]):
        amount = _guess_target_column(columns, "prix", "price", "montant", "rendement") or "prix"
        region = _guess_target_column(columns, "region", "pays", "zone") or "region"
        steps.append(
            {
                "id": f"step_{order}",
                "order": order,
                "title": f"Agréger {amount} par {region}",
                "description": "Regroupement statistique pour visualiser les tendances par zone.",
                "action": "add_node",
                "nodeKind": "custom",
                "config": {},
                "connectTo": "chain",
                "codePrompt": f"Somme des {amount} par {region}",
            }
        )
        order += 1

    if any(k in intent_l for k in ["causal", "corrélation", "corrél", "cause", "impact"]):
        target = _guess_target_column(columns, "prix", "rendement", "yield", "impact") or ""
        steps.append(
            {
                "id": f"step_{order}",
                "order": order,
                "title": "Analyse causale",
                "description": "Identifier les variables qui influencent la cible (corrélations, encodage catégoriel).",
                "action": "add_node",
                "nodeKind": "causal_analysis",
                "config": {"targetColumn": target, "columns": columns[:8]},
                "connectTo": "source",
            }
        )
        order += 1

    if any(k in intent_l for k in ["prédi", "predi", "forecast", "tendance", "futur"]):
        target = _guess_target_column(columns, "prix", "rendement", "yield") or ""
        steps.append(
            {
                "id": f"step_{order}",
                "order": order,
                "title": "Prédiction / prévision",
                "description": "Modèle de régression sur la colonne cible (branché sur la source, pas après causal).",
                "action": "add_node",
                "nodeKind": "predict",
                "config": {"targetColumn": target, "mode": "regression"},
                "connectTo": "source",
            }
        )
        order += 1

    if any(k in intent_l for k in ["sql", "requête", "requete"]):
        steps.append(
            {
                "id": f"step_{order}",
                "order": order,
                "title": "Transformation SQL",
                "description": "Requête SQL de lecture sur la table input.",
                "action": "add_node",
                "nodeKind": "sql",
                "config": {},
                "connectTo": "chain",
                "codePrompt": intent,
            }
        )
        order += 1

    steps.append(
        {
            "id": f"step_{order}",
            "order": order,
            "title": "Résultat final (export)",
            "description": "Nœud de sortie pour exécuter et exporter en CSV.",
            "action": "add_node",
            "nodeKind": "output",
            "config": {"format": "csv"},
            "connectTo": "chain",
        }
    )

    summary = (
        f"Pipeline en {len(steps)} étapes pour « {intent.strip()[:120]} » : "
        + " → ".join(s["title"] for s in steps)
    )
    return {"summary": summary, "steps": steps}


def _try_openai_plan(intent: str, columns: List[str], source_label: str) -> Optional[Dict[str, Any]]:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return None
    prompt = (
        "Tu es un expert ETL agricole Aaprovidir. Génère un plan JSON strict :\n"
        '{"summary":"...", "steps":[{"id":"step_1","order":1,"title":"...","description":"...",'
        '"action":"quality_check|add_node","nodeKind":null|"filter"|"custom"|"agri_classify"|'
        '"causal_analysis"|"predict"|"output"|"sql","config":{},"connectTo":"chain|source",'
        '"codePrompt":"optionnel","tab":"quality si quality_check"}]}\n'
        f"Source: {source_label}\nColonnes: {', '.join(columns)}\nIntention: {intent}\n"
        "Max 8 étapes. Toujours commencer par quality_check et finir par output."
    )
    try:
        raw = ai_module._generate_with_openai(prompt, columns, "pandas", key)
        text = raw.get("code", "") + raw.get("explanation", "")
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            plan = json.loads(text[start : end + 1])
            if isinstance(plan.get("steps"), list) and plan["steps"]:
                return plan
    except Exception:  # noqa: BLE001
        pass
    return None


def create_session(
    user_id: str,
    columns: List[str],
    source_label: str = "Source importée",
    project_id: Optional[str] = None,
    source_node_id: Optional[str] = None,
) -> Dict[str, Any]:
    sid = str(uuid.uuid4())
    _sessions[sid] = {
        "sessionId": sid,
        "userId": user_id,
        "columns": columns,
        "sourceLabel": source_label,
        "projectId": project_id,
        "sourceNodeId": source_node_id,
        "phase": "awaiting_intent",
        "intent": "",
        "plan": None,
        "currentStepIndex": -1,
        "messages": [
            _msg(
                "assistant",
                f"J'ai bien reçu **{source_label}**"
                + (f" ({len(columns)} colonnes : {', '.join(columns[:6])}{'…' if len(columns) > 6 else ''})" if columns else "")
                + ".\n\n**Que souhaitez-vous faire avec ces données ?**\n"
                "Exemples : analyser les prix par région, filtrer le maïs, étudier les corrélations, prédire les rendements…",
            )
        ],
        "acceptedSteps": [],
    }
    return get_session_state(sid)


def get_session(session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    s = _sessions.get(session_id)
    if not s or s["userId"] != user_id:
        return None
    return s


def get_session_state(session_id: str) -> Dict[str, Any]:
    s = _sessions[session_id]
    current = None
    idx = s["currentStepIndex"]
    plan = s.get("plan") or {}
    steps = plan.get("steps") or []
    if 0 <= idx < len(steps):
        current = steps[idx]
    return {
        "sessionId": session_id,
        "phase": s["phase"],
        "messages": s["messages"],
        "intent": s.get("intent") or "",
        "plan": plan if s["phase"] != "awaiting_intent" else None,
        "currentStep": current,
        "currentStepIndex": idx,
        "totalSteps": len(steps),
        "acceptedSteps": s.get("acceptedSteps") or [],
        "columns": s["columns"],
        "sourceLabel": s["sourceLabel"],
        "projectId": s.get("projectId"),
        "sourceNodeId": s.get("sourceNodeId"),
    }


def submit_intent(session_id: str, user_id: str, intent: str) -> Dict[str, Any]:
    s = get_session(session_id, user_id)
    if not s:
        raise ValueError("Session introuvable.")
    intent = intent.strip()
    if not intent:
        raise ValueError("Décrivez votre objectif.")
    s["intent"] = intent
    s["messages"].append(_msg("user", intent))

    plan = _try_openai_plan(intent, s["columns"], s["sourceLabel"])
    if not plan:
        plan = _build_heuristic_plan(intent, s["columns"], s["sourceLabel"])

    s["plan"] = plan
    s["phase"] = "plan_proposed"
    s["currentStepIndex"] = -1
    steps_txt = "\n".join(f"{i + 1}. **{st['title']}** — {st['description']}" for i, st in enumerate(plan["steps"]))
    s["messages"].append(
        _msg(
            "assistant",
            f"Voici ma proposition :\n\n{plan['summary']}\n\n{steps_txt}\n\n"
            "**Êtes-vous d'accord avec cette démarche ?** Validez, ou décrivez les ajustements souhaités.",
        )
    )
    return get_session_state(session_id)


def respond_to_plan(
    session_id: str,
    user_id: str,
    action: str,
    feedback: Optional[str] = None,
) -> Dict[str, Any]:
    s = get_session(session_id, user_id)
    if not s or s["phase"] != "plan_proposed":
        raise ValueError("Aucun plan en attente de validation.")

    if action == "accept":
        s["phase"] = "step_pending"
        s["currentStepIndex"] = 0
        s["messages"].append(_msg("user", "J'accepte le plan."))
        database.log_activity(
            action="conductor_plan",
            user_id=user_id,
            detail=s["plan"]["summary"][:200] if s.get("plan") else "",
        )
        return _append_current_step_message(s)

    if action == "revise":
        if not feedback or not feedback.strip():
            raise ValueError("Précisez les ajustements souhaités.")
        s["messages"].append(_msg("user", f"Ajustements : {feedback.strip()}"))
        combined = f"{s['intent']}. Ajustements : {feedback.strip()}"
        plan = _try_openai_plan(combined, s["columns"], s["sourceLabel"])
        if not plan:
            plan = _build_heuristic_plan(combined, s["columns"], s["sourceLabel"])
        s["plan"] = plan
        steps_txt = "\n".join(f"{i + 1}. **{st['title']}**" for i, st in enumerate(plan["steps"]))
        s["messages"].append(
            _msg("assistant", f"Plan révisé :\n{plan['summary']}\n\n{steps_txt}\n\nValidez ou ajustez à nouveau.")
        )
        return get_session_state(session_id)

    raise ValueError("Action invalide (accept ou revise).")


def _append_current_step_message(s: Dict[str, Any]) -> Dict[str, Any]:
    plan = s["plan"]
    steps = plan["steps"]
    idx = s["currentStepIndex"]
    if idx >= len(steps):
        s["phase"] = "completed"
        s["messages"].append(
            _msg("assistant", "✅ **Pipeline terminé !** Toutes les étapes validées. Vous pouvez exécuter le traitement.")
        )
        return get_session_state(s["sessionId"])

    step = steps[idx]
    s["messages"].append(
        _msg(
            "assistant",
            f"**Étape {idx + 1}/{len(steps)} — {step['title']}**\n{step['description']}\n\n"
            "Validez (**accep**), refusez (**reject**) ou proposez un ajustement (**revise**).",
        )
    )
    return get_session_state(s["sessionId"])


def respond_to_step(
    session_id: str,
    user_id: str,
    action: str,
    feedback: Optional[str] = None,
) -> Dict[str, Any]:
    s = get_session(session_id, user_id)
    if not s or s["phase"] not in ("step_pending",):
        raise ValueError("Aucune étape en attente.")

    plan = s["plan"]
    steps = plan["steps"]
    idx = s["currentStepIndex"]
    if idx < 0 or idx >= len(steps):
        raise ValueError("Index d'étape invalide.")

    step = steps[idx]

    if action == "accept":
        s["messages"].append(_msg("user", f"J'accepte : {step['title']}"))
        accepted = dict(step)
        if step.get("codePrompt") and step.get("nodeKind") in ("custom", "sql"):
            mode = "sql" if step["nodeKind"] == "sql" else "pandas"
            try:
                gen = ai_module.generate_transformation(step["codePrompt"], s["columns"], mode)
                key = "query" if mode == "sql" else "code"
                cfg = dict(step.get("config") or {})
                cfg[key] = gen["code"]
                accepted["config"] = cfg
                accepted["generatedExplanation"] = gen.get("explanation", "")
            except Exception as exc:  # noqa: BLE001
                accepted["generationError"] = str(exc)
        s.setdefault("acceptedSteps", []).append(accepted)
        database.log_activity(
            action="conductor_step",
            user_id=user_id,
            detail=step["title"],
        )
        s["currentStepIndex"] = idx + 1
        if s["currentStepIndex"] >= len(steps):
            s["phase"] = "completed"
            s["messages"].append(
                _msg("assistant", "✅ **Pipeline terminé !** Exécutez le traitement pour voir les résultats.")
            )
        else:
            return _append_current_step_message(s)
        return get_session_state(session_id)

    if action == "reject":
        s["messages"].append(_msg("user", f"Je refuse : {step['title']}"))
        s["currentStepIndex"] = idx + 1
        s["messages"].append(_msg("assistant", f"Étape « {step['title']} » ignorée."))
        if s["currentStepIndex"] >= len(steps):
            s["phase"] = "completed"
            s["messages"].append(_msg("assistant", "Parcours terminé (certaines étapes ignorées)."))
        else:
            return _append_current_step_message(s)
        return get_session_state(session_id)

    if action == "revise":
        if not feedback or not feedback.strip():
            raise ValueError("Décrivez comment ajuster cette étape.")
        s["messages"].append(_msg("user", f"Ajustement étape : {feedback.strip()}"))
        revised = dict(step)
        revised["description"] = f"{step['description']} (Ajusté : {feedback.strip()})"
        if step.get("nodeKind") in ("custom", "sql", "filter"):
            revised["codePrompt"] = feedback.strip()
        elif step.get("nodeKind") == "causal_analysis":
            cfg = dict(step.get("config") or {})
            cfg["targetColumn"] = feedback.strip()
            revised["config"] = cfg
        steps[idx] = revised
        s["plan"]["steps"] = steps
        s["messages"].append(
            _msg("assistant", f"Étape révisée :\n**{revised['title']}** — {revised['description']}\n\nValidez, refusez ou ajustez.")
        )
        return get_session_state(session_id)

    raise ValueError("Action invalide (accept, reject ou revise).")


def build_welcome(user_id: str, username: str, full_name: Optional[str] = None) -> Dict[str, Any]:
    """Message d'accueil + résumé activité + proposition de continuation."""
    activities = database.list_user_activity(user_id, 25)
    projects = database.list_projects(user_id)

    name = (full_name or username or "analyste").strip()
    greeting = f"Bonjour **{name}** ! Bienvenue sur Aaprovidir DataPipe."

    lines: List[str] = []
    for a in activities:
        label = ACTION_LABELS.get(a["action"], a["action"])
        detail = f" — {a['detail']}" if a.get("detail") else ""
        when = a.get("createdAt", "")[:16].replace("T", " ")
        lines.append(f"• {when} : {label}{detail}")
        if len(lines) >= 6:
            break

    if lines:
        summary = "**Dernière activité :**\n" + "\n".join(lines)
    else:
        summary = "C'est votre première session ou peu d'activité enregistrée. Commencez par importer une source CSV agricole."

    last_project = None
    suggested_action = "Importez un fichier CSV (prix, cultures, régions) — je vous guiderai étape par étape."
    continue_url = None

    if projects:
        p = projects[0]
        graph = p.get("graph") or {}
        nodes = graph.get("nodes") or []
        sources = [n for n in nodes if str(n.get("data", {}).get("kind", "")).startswith("source_")]
        last_project = {
            "id": p["id"],
            "title": p["title"],
            "updatedAt": p.get("updated_at"),
            "nodeCount": len(nodes),
            "sourceCount": len(sources),
        }
        continue_url = f"/projets/{p['id']}"
        if sources and len(nodes) <= len(sources) + 1:
            suggested_action = (
                f"Reprendre **{p['title']}** : source importée, pipeline à construire. "
                "Je peux proposer qualité → transformation → export."
            )
        elif nodes:
            suggested_action = (
                f"Continuer **{p['title']}** ({len(nodes)} étapes) : exécuter, affiner les transformations ou ajouter analyse causale."
            )
        else:
            suggested_action = f"Ouvrir **{p['title']}** et importer vos données agricoles."

    return {
        "greeting": greeting,
        "summary": summary,
        "suggestedAction": suggested_action,
        "lastProject": last_project,
        "continueUrl": continue_url,
        "projectCount": len(projects),
    }
