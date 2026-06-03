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

import json
import os
import re
import urllib.request
from typing import Any, Dict, List, Optional


SYSTEM_PROMPT = """Tu es un assistant expert en ingénierie de données pour le secteur bancaire.
Tu génères du code de transformation de données propre, sûr et commenté.

Règles selon le mode demandé :
- mode "pandas" : tu écris du code Python utilisant pandas. Une variable `df`
  (DataFrame) est déjà disponible en entrée. Réassigne `df` avec le résultat.
  N'importe rien, n'effectue aucune I/O, n'utilise que pandas (`pd`) déjà importé.
- mode "sql" : tu écris UNE requête SQL (dialecte SQLite) qui lit la table `input`.

Réponds STRICTEMENT en JSON : {"code": "...", "explanation": "..."}.
Le champ "explanation" est une phrase courte en français."""


def generate_transformation(
    description: str,
    columns: Optional[List[str]] = None,
    mode: str = "pandas",
) -> Dict[str, Any]:
    columns = columns or []
    api_key = os.environ.get("OPENAI_API_KEY")
    if api_key:
        try:
            return _generate_with_openai(description, columns, mode, api_key)
        except Exception as exc:  # noqa: BLE001 - on retombe sur l'heuristique
            fallback = _generate_heuristic(description, columns, mode)
            fallback["explanation"] += f" (IA distante indisponible : {exc})"
            fallback["source"] = "heuristic-fallback"
            return fallback
    result = _generate_heuristic(description, columns, mode)
    result["source"] = "heuristic"
    return result


# --------------------------------------------------------------------------- #
#  Backend OpenAI
# --------------------------------------------------------------------------- #
def _generate_with_openai(
    description: str, columns: List[str], mode: str, api_key: str
) -> Dict[str, Any]:
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    user_prompt = (
        f"Mode: {mode}\n"
        f"Colonnes disponibles: {', '.join(columns) if columns else 'inconnues'}\n"
        f"Description de la transformation souhaitée:\n{description}"
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
        body = json.loads(resp.read().decode("utf-8"))
    content = body["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    return {
        "code": parsed.get("code", ""),
        "explanation": parsed.get("explanation", ""),
        "mode": mode,
        "source": f"openai:{model}",
    }


# --------------------------------------------------------------------------- #
#  Générateur heuristique (sans clé API)
# --------------------------------------------------------------------------- #
def _guess_column(columns: List[str], *keywords: str) -> Optional[str]:
    for col in columns:
        low = col.lower()
        if any(k in low for k in keywords):
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
    amount_col = _guess_column(columns, "amount", "montant", "valeur", "value", "solde", "balance")
    account_col = _guess_column(columns, "account", "compte", "iban", "card", "carte", "numero")
    date_col = _guess_column(columns, "date", "time", "horodatage", "timestamp")
    snippets: List[str] = []
    explanations: List[str] = []

    if mode == "sql":
        return _heuristic_sql(desc, columns, amount_col, account_col, date_col)

    # ---- pandas ----
    if any(k in desc for k in ["doublon", "duplicate", "dédoublonn", "dedup", "unique"]):
        snippets.append("df = df.drop_duplicates()")
        explanations.append("suppression des doublons")

    if any(k in desc for k in ["masqu", "anonym", "mask", "rgpd", "cacher"]) and account_col:
        snippets.append(
            f"df['{account_col}'] = df['{account_col}'].astype(str).str.replace("
            f"r'.(?=.{{4}})', '*', regex=True)"
        )
        explanations.append(f"masquage de la colonne « {account_col} » (4 derniers caractères visibles)")

    if any(k in desc for k in ["supérieur", "superieur", "plus de", "au-dessus", "greater", "above", ">"]) and amount_col:
        threshold = _extract_number(desc) or 10000
        snippets.append(f"df = df[df['{amount_col}'] > {threshold}]")
        explanations.append(f"filtrage des lignes où {amount_col} > {threshold}")
    elif any(k in desc for k in ["inférieur", "inferieur", "moins de", "en dessous", "less", "below", "<"]) and amount_col:
        threshold = _extract_number(desc) or 0
        snippets.append(f"df = df[df['{amount_col}'] < {threshold}]")
        explanations.append(f"filtrage des lignes où {amount_col} < {threshold}")

    if any(k in desc for k in ["négati", "negati", "debit", "débit"]) and amount_col:
        snippets.append(f"df = df[df['{amount_col}'] < 0]")
        explanations.append(f"conservation des montants négatifs ({amount_col})")

    if any(k in desc for k in ["fraud", "anomal", "suspect", "outlier", "aberrant"]) and amount_col:
        snippets.append(
            f"_seuil = df['{amount_col}'].mean() + 3 * df['{amount_col}'].std()\n"
            f"df['is_suspect'] = df['{amount_col}'] > _seuil"
        )
        explanations.append(f"marquage des montants suspects (> moyenne + 3σ sur {amount_col})")

    if any(k in desc for k in ["date", "parse", "convert", "datetime"]) and date_col:
        snippets.append(f"df['{date_col}'] = pd.to_datetime(df['{date_col}'], errors='coerce')")
        explanations.append(f"conversion de « {date_col} » en datetime")

    if any(k in desc for k in ["null", "manquant", "missing", "vide", "nettoy", "clean", "na"]):
        snippets.append("df = df.dropna()")
        explanations.append("suppression des lignes avec valeurs manquantes")

    if any(k in desc for k in ["euro", "eur", "dollar", "usd", "convert", "taux", "devise"]) and amount_col:
        rate = _extract_number(desc) or 1.0
        snippets.append(f"df['{amount_col}_converted'] = df['{amount_col}'] * {rate}")
        explanations.append(f"conversion de devise sur {amount_col} (taux {rate})")

    if any(k in desc for k in ["majuscule", "upper", "uppercase"]):
        snippets.append(
            "for _c in df.select_dtypes(include='object').columns:\n"
            "    df[_c] = df[_c].astype(str).str.upper()"
        )
        explanations.append("mise en majuscules des colonnes texte")

    if not snippets:
        # Repli générique : un squelette commenté à adapter.
        cols_repr = columns or ["colonne_1", "colonne_2"]
        snippets.append(
            "# Transformation à adapter selon votre besoin.\n"
            f"# Colonnes disponibles : {', '.join(cols_repr)}\n"
            "df = df.copy()"
        )
        explanations.append(
            "aucune règle automatique reconnue — squelette généré, précisez votre demande"
        )

    code = "\n".join(snippets)
    return {
        "code": code,
        "explanation": "Heuristique : " + ", ".join(explanations) + ".",
        "mode": mode,
    }


def _heuristic_sql(
    desc: str,
    columns: List[str],
    amount_col: Optional[str],
    account_col: Optional[str],
    date_col: Optional[str],
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

    if any(k in desc for k in ["total", "somme", "sum", "agré", "agreg", "group"]) and amount_col:
        group_col = account_col or (columns[0] if columns else "id")
        select = f'"{group_col}", SUM("{amount_col}") AS total'
        group = f' GROUP BY "{group_col}"'
        explanations.append(f"somme de {amount_col} par {group_col}")

    if any(k in desc for k in ["trier", "tri", "order", "classer"]) and amount_col:
        order = f' ORDER BY "{amount_col}" DESC'
        explanations.append(f"tri décroissant par {amount_col}")

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
