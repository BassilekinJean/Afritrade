"""Assistant IA de génération de code de transformation.

Deux modes :
  - Si OPENAI_API_KEY est défini, on interroge un modèle OpenAI.
  - Sinon, un générateur heuristique couvre les transformations bancaires
    courantes (filtrage de montants, masquage de comptes, détection d'anomalies,
    déduplication, conversion de dates...).

La sortie est toujours du code exploitable par le moteur :
  - mode "pandas" : code manipulant un DataFrame `df`
  - mode "sql"    : requête SQL sur la table `input`
"""

from __future__ import annotations

import ast
import json
import os
import re
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional


SYSTEM_PROMPT = """Tu es un assistant expert en ingénierie de données pour le secteur AGRICOLE (Aaprovidir).
Tu génères du code de transformation de données propre, sûr et minimal pour pipelines agricoles :
prix de marché, rendements, météo, coopératives, intrants, sécurité alimentaire.

CONTRAINTES STRICTES — à respecter sans exception :
- Génère UNIQUEMENT du code pandas (mode "pandas") OU une requête SQL (mode "sql").
- N'effectue AUCUNE entrée/sortie (pas de read_csv, to_csv, to_sql, open, requêtes réseau...).
- N'importe AUCUNE librairie (pas d'`import`, pas de `__import__`).
- N'utilise AUCUN code destructeur ni accès système (os, sys, subprocess, eval, exec, __...__).

Règles selon le mode demandé :
- mode "pandas" : écris du code Python utilisant pandas. Une variable `df`
  (DataFrame) est déjà disponible en entrée. `pd` (pandas) est déjà importé.
  Réassigne `df` avec le résultat final (ou définis `result`).
- mode "sql" : écris UNE SEULE requête SQL en LECTURE (dialecte SQLite) lisant la
  table `input`. Seuls SELECT / WITH sont autorisés ; jamais DROP, DELETE, UPDATE,
  INSERT, ALTER, TRUNCATE, CREATE.

Réponds STRICTEMENT en JSON, sans texte autour : {"code": "...", "explanation": "..."}.
Le champ "explanation" est une phrase courte en français."""


# --------------------------------------------------------------------------- #
#  Garde-fous : validation du code généré
# --------------------------------------------------------------------------- #
class CodeValidationError(ValueError):
    """Le code généré ne respecte pas les règles de sûreté."""


# Mots-clés SQL destructeurs / non autorisés (requêtes de lecture uniquement).
_FORBIDDEN_SQL = (
    "drop", "delete", "update", "insert", "alter", "truncate",
    "create", "replace", "grant", "revoke", "attach", "detach", "pragma",
)

# Noms interdits dans le code pandas (fonctions dangereuses).
_FORBIDDEN_NAMES = {
    "eval", "exec", "compile", "open", "input", "__import__",
    "globals", "locals", "vars", "getattr", "setattr", "delattr",
    "exit", "quit",
}

# Appels de méthodes interdits (I/O, accès système).
_FORBIDDEN_CALLS = {
    "to_csv", "to_sql", "to_excel", "to_json", "to_pickle", "to_parquet",
    "to_feather", "to_hdf", "to_clipboard",
    "read_csv", "read_sql", "read_json", "read_excel", "read_parquet",
    "read_pickle", "read_html", "read_clipboard",
    "system", "popen", "remove", "unlink", "rmtree",
}


def _validate_sql(query: str) -> None:
    stripped = query.strip()
    if not stripped:
        raise CodeValidationError("Requête SQL vide.")
    lowered = stripped.lower()
    for kw in _FORBIDDEN_SQL:
        if re.search(rf"\b{kw}\b", lowered):
            raise CodeValidationError(f"Mot-clé SQL interdit : {kw.upper()}.")
    if not (lowered.startswith("select") or lowered.startswith("with")):
        raise CodeValidationError("Seules les requêtes de lecture (SELECT/WITH) sont autorisées.")
    # Interdit le chaînage de plusieurs instructions.
    if ";" in stripped.rstrip(";"):
        raise CodeValidationError("Une seule requête SELECT est autorisée.")


def _validate_pandas(code: str) -> None:
    if not code.strip():
        raise CodeValidationError("Code pandas vide.")
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        raise CodeValidationError(f"Code Python invalide : {exc.msg}") from exc

    assigns_df_or_result = False
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise CodeValidationError("Les imports sont interdits.")
        if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            raise CodeValidationError("Accès aux attributs spéciaux (dunder) interdit.")
        if isinstance(node, ast.Name) and node.id in _FORBIDDEN_NAMES:
            raise CodeValidationError(f"Fonction interdite : {node.id}.")
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr in _FORBIDDEN_CALLS:
                raise CodeValidationError(f"Opération d'I/O interdite : {node.func.attr}.")
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id in ("df", "result"):
                    assigns_df_or_result = True
                # df['col'] = ... ou df.loc[...] = ...
                if isinstance(target, ast.Subscript):
                    assigns_df_or_result = True

    if not assigns_df_or_result:
        raise CodeValidationError("Le code doit réassigner `df` (ou définir `result`).")


def validate_generated_code(code: str, mode: str) -> None:
    """Vérifie qu'un code généré est sûr. Lève CodeValidationError sinon."""
    if mode == "sql":
        _validate_sql(code)
    else:
        _validate_pandas(code)


def get_ai_status() -> Dict[str, Any]:
    """État du service IA pour le frontend."""
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    base = _api_base_url()
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    if key:
        provider = "openai"
        if "openrouter.ai" in base:
            provider = "openrouter"
        elif "groq.com" in base:
            provider = "groq"
        return {
            "enabled": True,
            "provider": provider,
            "model": model,
            "hasKey": True,
            "mode": "cloud",
            "hint": "Assistant cloud actif. Décrivez votre transformation en français.",
        }
    return {
        "enabled": True,
        "provider": "heuristic",
        "model": "local",
        "hasKey": False,
        "mode": "local",
        "hint": "Mode local sans clé API. Ajoutez OPENAI_API_KEY dans backend/.env pour GPT.",
    }


def generate_transformation(
    description: str,
    columns: Optional[List[str]] = None,
    mode: str = "pandas",
) -> Dict[str, Any]:
    columns = columns or []
    api_key = os.environ.get("OPENAI_API_KEY")
    if api_key:
        try:
            result = _generate_with_openai(description, columns, mode, api_key)
            validate_generated_code(result["code"], result["mode"])
            return result
        except Exception as exc:  # noqa: BLE001 - on retombe sur l'heuristique
            fallback = _generate_heuristic(description, columns, mode)
            fallback["explanation"] += f" (IA distante indisponible : {_explain_ai_error(exc)})"
            fallback["source"] = "heuristic-fallback"
            validate_generated_code(fallback["code"], fallback["mode"])
            return fallback
    result = _generate_heuristic(description, columns, mode)
    result["source"] = "heuristic"
    validate_generated_code(result["code"], result["mode"])
    return result


# --------------------------------------------------------------------------- #
#  Backend OpenAI
# --------------------------------------------------------------------------- #
class AIServiceError(RuntimeError):
    """Erreur renvoyée par le fournisseur d'IA distant (réseau, quota, auth...)."""


def _api_base_url() -> str:
    """Base d'API compatible OpenAI (OpenAI, Groq, OpenRouter, etc.)."""
    base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    # Tolère que l'utilisateur fournisse l'URL avec ou sans /v1.
    return base


def _generate_with_openai(
    description: str, columns: List[str], mode: str, api_key: str
) -> Dict[str, Any]:
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    user_prompt = (
        f"Mode: {mode}\n"
        f"Colonnes disponibles: {', '.join(columns) if columns else 'inconnues'}\n"
        f"Description de la transformation souhaitée:\n{description}"
    )
    base_url = _api_base_url()
    payload: Dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
    }
    # Le mode JSON strict n'est pas supporté par tous les modèles gratuits
    # (OpenRouter) ; on l'active seulement là où il est fiable.
    if "openrouter.ai" not in base_url:
        payload["response_format"] = {"type": "json_object"}
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    # En-têtes recommandés par OpenRouter (facultatifs, ignorés ailleurs).
    if "openrouter.ai" in base_url:
        headers["HTTP-Referer"] = "http://localhost:5173"
        headers["X-Title"] = "DataPipe"

    data = json.dumps(payload).encode("utf-8")
    # Les modèles gratuits (OpenRouter) sont souvent rate-limités en amont :
    # on réessaie quelques fois en respectant l'en-tête Retry-After.
    max_attempts = 4
    last_http_error: Optional[urllib.error.HTTPError] = None
    body: Optional[Dict[str, Any]] = None
    for attempt in range(max_attempts):
        req = urllib.request.Request(
            f"{base_url}/chat/completions",
            data=data,
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:  # noqa: S310
                body = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as exc:
            last_http_error = exc
            if exc.code == 429 and attempt < max_attempts - 1:
                retry_after = _retry_after_seconds(exc, default=3.0)
                time.sleep(min(retry_after, 8.0))
                continue
            raise AIServiceError(_format_http_error(exc)) from exc
        except urllib.error.URLError as exc:
            raise AIServiceError(
                f"connexion impossible au fournisseur IA ({exc.reason})"
            ) from exc

    if body is None:  # tous les essais ont échoué sur 429
        raise AIServiceError(_format_http_error(last_http_error))

    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIServiceError("réponse inattendue du fournisseur IA") from exc

    parsed = _parse_model_json(content)
    return {
        "code": parsed.get("code", ""),
        "explanation": parsed.get("explanation", ""),
        "mode": mode,
        "source": f"openai:{model}",
    }


def _parse_model_json(content: str) -> Dict[str, Any]:
    """Extrait l'objet JSON de la réponse du modèle.

    Tolère le texte autour et les blocs Markdown ```json … ``` que renvoient
    certains modèles gratuits ne supportant pas le mode JSON strict.
    """
    text = (content or "").strip()
    # Retire d'éventuelles clôtures Markdown.
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Repli : on isole le 1ᵉʳ objet JSON équilibré dans la chaîne.
    start = text.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        break
    raise AIServiceError("la réponse du modèle n'est pas un JSON valide")


def _retry_after_seconds(exc: "urllib.error.HTTPError", default: float) -> float:
    """Délai d'attente avant nouvel essai (en-tête HTTP Retry-After)."""
    header = exc.headers.get("Retry-After") if exc.headers else None
    if header:
        try:
            return float(header)
        except ValueError:
            pass
    return default


def _format_http_error(exc: "urllib.error.HTTPError") -> str:
    """Transforme une erreur HTTP du fournisseur en message clair (français)."""
    detail = ""
    code = ""
    try:
        body = json.loads(exc.read().decode("utf-8"))
        err = body.get("error", body) if isinstance(body, dict) else {}
        if isinstance(err, dict):
            detail = str(err.get("message", "") or "")
            code = str(err.get("code", "") or err.get("type", "") or "")
    except Exception:  # noqa: BLE001
        pass

    if exc.code == 429:
        if "insufficient_quota" in code or "quota" in detail.lower():
            return (
                "quota du compte OpenAI épuisé — ajoutez du crédit sur "
                "platform.openai.com (Billing) ou configurez OPENAI_BASE_URL "
                "vers un fournisseur compatible (Groq, OpenRouter…)"
            )
        if "rate-limit" in detail.lower() or "rate limited" in detail.lower():
            return (
                "modèle gratuit momentanément saturé (429) — réessayez, ou "
                "passez à Groq (plus fiable) ou à un modèle payant"
            )
        return "limite de débit atteinte (429), réessayez dans quelques instants"
    if exc.code == 401:
        return "clé API invalide ou révoquée (401) — vérifiez OPENAI_API_KEY"
    if exc.code == 404:
        return f"modèle « {os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')} » introuvable (404)"
    return f"HTTP {exc.code} : {detail or exc.reason}"


def _explain_ai_error(exc: Exception) -> str:
    if isinstance(exc, AIServiceError):
        return str(exc)
    return str(exc)


# --------------------------------------------------------------------------- #
#  Générateur heuristique (sans clé API)
# --------------------------------------------------------------------------- #
def _guess_column(columns: List[str], *keywords: str) -> Optional[str]:
    for col in columns:
        low = col.lower()
        if any(k in low for k in keywords):
            return col
    return None


def _mentioned_column(desc: str, columns: List[str], exclude: Optional[str] = None) -> Optional[str]:
    """Renvoie la 1ʳᵉ colonne disponible explicitement citée dans la description."""
    for col in columns:
        if col == exclude:
            continue
        if re.search(rf"\b{re.escape(col.lower())}\b", desc):
            return col
    return None


def _extract_number(text: str) -> Optional[float]:
    match = re.search(r"(\d[\d\s.,]*)", text)
    if not match:
        return None
    raw = match.group(1).replace(" ", "").replace(",", ".")
    raw = re.sub(r"\.(?=.*\.)", "", raw)  # garde la dernière virgule décimale
    try:
        return float(raw)
    except ValueError:
        return None


def _generate_heuristic(description: str, columns: List[str], mode: str) -> Dict[str, Any]:
    desc = description.lower()
    # Colonnes agricoles + legacy bancaire
    amount_col = _guess_column(
        columns,
        "prix", "price", "montant", "valeur", "rendement", "yield", "tonnage",
        "quantite", "quantity", "amount", "solde", "score",
    )
    category_col = _guess_column(
        columns,
        "culture", "crop", "produit", "product", "produits_echanges", "espece",
        "variety", "variete", "commodity",
    )
    region_col = _guess_column(
        columns, "region", "pays", "country", "zone", "localite", "ville", "market", "marche",
    )
    entity_col = _guess_column(
        columns,
        "entite", "entites", "entites_intervenantes", "cooperative", "coop", "producteur",
        "account", "compte", "iban",
    )
    evolution_col = _guess_column(
        columns, "evolution", "evolution_marche", "tendance", "impact", "statut",
    )
    date_col = _guess_column(columns, "date", "time", "jour", "mois", "annee", "timestamp", "saison")
    message_col = _guess_column(columns, "message", "contenu", "description", "texte", "commentaire")
    account_col = entity_col  # alias legacy

    snippets: List[str] = []
    explanations: List[str] = []

    if mode == "sql":
        return _heuristic_sql(desc, columns, amount_col, entity_col, date_col, category_col, region_col)

    # ---- pandas — règles agricoles ----
    if any(k in desc for k in ["doublon", "duplicate", "dédoublonn", "dedup"]) or re.search(
        r"\bunique(s)?\b", desc
    ):
        snippets.append("df = df.drop_duplicates()")
        explanations.append("suppression des doublons")

    if any(k in desc for k in ["vide", "null", "manquant", "missing", "na", "nettoy", "clean"]):
        snippets.append("df = df.dropna()")
        explanations.append("suppression des lignes avec valeurs manquantes")

    # Filtrer par culture (maïs, riz…)
    culture_match = re.search(r"\b(ma[iï]s|riz|manioc|cacao|caf[eé]|arachide|bl[eé])\b", desc)
    if culture_match and category_col:
        crop = culture_match.group(1).replace("é", "e").replace("ï", "i")
        snippets.append(f"df = df[df['{category_col}'].astype(str).str.lower().str.contains('{crop}', na=False)]")
        explanations.append(f"filtrage culture « {crop} » sur {category_col}")

    if any(k in desc for k in ["négativ", "negativ", "negative", "baisse", "dégrad"]) and evolution_col:
        snippets.append(
            f"df = df[df['{evolution_col}'].astype(str).str.contains('égatif|negatif|Negative', case=False, na=False)]"
        )
        explanations.append(f"filtrage évolution négative ({evolution_col})")

    if any(k in desc for k in ["supérieur", "superieur", "plus de", "au-dessus", "greater", "above", ">"]) and amount_col:
        threshold = _extract_number(desc) or 100
        snippets.append(f"df = df[pd.to_numeric(df['{amount_col}'], errors='coerce') > {threshold}]")
        explanations.append(f"filtrage {amount_col} > {threshold}")

    if any(k in desc for k in ["inférieur", "inferieur", "moins de", "en dessous", "less", "below", "<"]) and amount_col:
        threshold = _extract_number(desc) or 0
        snippets.append(f"df = df[pd.to_numeric(df['{amount_col}'], errors='coerce') < {threshold}]")
        explanations.append(f"filtrage {amount_col} < {threshold}")

    if any(k in desc for k in ["regroup", "group", "par ", "agréger", "agreger", "somme", "total", "sum", "moyenne", "mean"]) and amount_col:
        group_col = (
            _mentioned_column(desc, columns, exclude=amount_col)
            or region_col
            or category_col
            or entity_col
        )
        if group_col:
            agg = "mean" if any(k in desc for k in ["moyenne", "mean", "average"]) else "sum"
            snippets.append(
                f"df = df.groupby('{group_col}', as_index=False)['{amount_col}'].{agg}()"
            )
            explanations.append(f"regroupement par « {group_col} » ({agg} de {amount_col})")

    if any(k in desc for k in ["compter", "count", "nombre"]) and (region_col or category_col):
        group_col = region_col or category_col
        snippets.append(f"df = df.groupby('{group_col}', as_index=False).size().rename(columns={{'size': 'nombre'}})")
        explanations.append(f"comptage par {group_col}")

    if any(k in desc for k in ["sélection", "selection", "select", "garder colonnes", "choisir colonnes"]):
        mentioned = [c for c in columns if c.lower() in desc]
        if mentioned:
            snippets.append(f"df = df[{mentioned!r}]".replace("'", '"'))
            explanations.append(f"sélection des colonnes {', '.join(mentioned)}")

    if any(k in desc for k in ["renommer", "rename"]) and columns:
        # ex: renommer prix en prix_kg
        old = _mentioned_column(desc, columns)
        new_match = re.search(r"en\s+(\w+)|vers\s+(\w+)|->\s*(\w+)", desc)
        if old and new_match:
            new_name = next(g for g in new_match.groups() if g)
            snippets.append(f"df = df.rename(columns={{'{old}': '{new_name}'}})")
            explanations.append(f"renommage {old} → {new_name}")

    if any(k in desc for k in ["trier", "tri", "sort", "classer"]) and amount_col:
        asc = any(k in desc for k in ["croissant", "asc", "ascending"])
        snippets.append(f"df = df.sort_values('{amount_col}', ascending={str(asc).lower()})")
        explanations.append(f"tri par {amount_col}")

    if any(k in desc for k in ["date", "parse", "convert", "datetime"]) and date_col:
        snippets.append(f"df['{date_col}'] = pd.to_datetime(df['{date_col}'], dayfirst=True, errors='coerce')")
        explanations.append(f"conversion date « {date_col} »")

    if any(k in desc for k in ["masqu", "anonym", "mask", "rgpd", "cacher"]) and entity_col:
        snippets.append(
            f"df['{entity_col}'] = df['{entity_col}'].astype(str).str.replace("
            f"r'.(?=.{{4}})', '*', regex=True)"
        )
        explanations.append(f"masquage partiel « {entity_col} »")

    if any(k in desc for k in ["fraud", "anomal", "suspect", "outlier", "aberrant"]) and amount_col:
        snippets.append(
            f"_seuil = pd.to_numeric(df['{amount_col}'], errors='coerce').mean() + "
            f"3 * pd.to_numeric(df['{amount_col}'], errors='coerce').std()\n"
            f"df['suspect'] = pd.to_numeric(df['{amount_col}'], errors='coerce') > _seuil"
        )
        explanations.append(f"détection valeurs aberrantes sur {amount_col}")

    if any(k in desc for k in ["majuscule", "upper"]) and message_col:
        snippets.append(f"df['{message_col}'] = df['{message_col}'].astype(str).str.upper()")
        explanations.append(f"majuscules sur {message_col}")

    if not snippets:
        cols_repr = columns or ["colonne_1", "colonne_2"]
        snippets.append(
            "# Exemple : filtrer puis agréger\n"
            f"# Colonnes : {', '.join(cols_repr)}\n"
            "df = df.copy()\n"
            + (f"# df = df[df['{cols_repr[0]}'].notna()]" if cols_repr else "")
        )
        explanations.append(
            "précisez : filtrer culture, grouper par région, somme des prix, etc."
        )

    code = "\n".join(s for s in snippets if s)
    return {
        "code": code,
        "explanation": "Assistant local : " + ", ".join(explanations) + ".",
        "mode": mode,
    }


def _heuristic_sql(
    desc: str,
    columns: List[str],
    amount_col: Optional[str],
    account_col: Optional[str],
    date_col: Optional[str],
    category_col: Optional[str] = None,
    region_col: Optional[str] = None,
) -> Dict[str, Any]:
    where: List[str] = []
    select = "*"
    explanations: List[str] = []
    order = ""
    group = ""

    if any(k in desc for k in ["supérieur", "superieur", "plus de", "above", "greater", ">"]) and amount_col:
        threshold = _extract_number(desc) or 10000
        where.append(f'"{amount_col}" > {threshold}')
        explanations.append(f"{amount_col} > {threshold}")
    if any(k in desc for k in ["inférieur", "inferieur", "moins de", "below", "less", "<"]) and amount_col:
        threshold = _extract_number(desc) or 0
        where.append(f'"{amount_col}" < {threshold}')
        explanations.append(f"{amount_col} < {threshold}")

    if any(k in desc for k in ["total", "somme", "sum", "agré", "agreg", "group", "moyenne", "mean"]) and amount_col:
        group_col = region_col or category_col or account_col or (columns[0] if columns else "id")
        agg_fn = "AVG" if any(k in desc for k in ["moyenne", "mean"]) else "SUM"
        select = f'"{group_col}", {agg_fn}("{amount_col}") AS total'
        group = f' GROUP BY "{group_col}"'
        explanations.append(f"{agg_fn} de {amount_col} par {group_col}")

    if any(k in desc for k in ["trier", "tri", "order", "classer"]) and amount_col:
        order = f' ORDER BY "{amount_col}" DESC'
        explanations.append(f"tri décroissant par {amount_col}")

    culture_match = re.search(r"\b(ma[iï]s|riz|manioc|cacao|caf[eé])\b", desc)
    if culture_match and category_col:
        crop = culture_match.group(1)
        where.append(f'LOWER("{category_col}") LIKE \'%{crop.lower()}%\'')
        explanations.append(f"culture {crop}")

    query = f"SELECT {select} FROM input"
    if where:
        query += " WHERE " + " AND ".join(where)
    query += group + order

    if not explanations:
        explanations.append("requête de base — affinez votre description pour des filtres précis")

    return {
        "code": query,
        "explanation": "Heuristique SQL : " + ", ".join(explanations) + ".",
        "mode": "sql",
    }
