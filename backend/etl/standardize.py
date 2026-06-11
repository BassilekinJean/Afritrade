"""Phase de STANDARDISATION (normalisation) de l'ETL.

C'est l'étape qui transforme des données hétérogènes (couche RAW) en données
homogènes et fiables (couche CLEAN), avec la rigueur attendue d'un data
engineer / data analyst :

  1. Noms de colonnes normalisés       -> snake_case sans accents ni espaces.
  2. Valeurs texte nettoyées            -> trim, chaînes vides converties en NA.
  3. Inférence et harmonisation de type -> booléens, nombres, dates.
  4. Nombres au format francophone      -> « 1 250,50 FCFA » -> 1250.50 (float).
  5. Dates harmonisées                  -> type datetime unique (rendu JJ-MM-AAAA).
  6. Valeurs manquantes cohérentes      -> un seul marqueur NA (None).

Le format de date canonique imposé par le projet est jour-mois-année : les
colonnes de date sont stockées en type `datetime` (représentation canonique
unique, calculable et triable) puis affichées au format `%d-%m-%Y` à la
sérialisation. Tout l'aval du pipeline manipule donc des dates homogènes.

Chaque appel renvoie le DataFrame normalisé et un rapport d'audit décrivant les
décisions prises colonne par colonne.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import pandas as pd

from . import config

# Indices de nom suggérant une colonne de date.
_DATE_NAME_HINTS = ("date", "jour", "heure", "time", "timestamp", "horodat", "datetime", "echeance", "valeur_date")

# Valeurs textuelles interprétées comme booléennes.
_TRUE_TOKENS = {"true", "vrai", "oui", "yes", "y", "o", "1"}
_FALSE_TOKENS = {"false", "faux", "non", "no", "n", "0"}

# Valeurs textuelles interprétées comme manquantes.
_NA_TOKENS = {"", "na", "n/a", "nan", "null", "none", "nil", "-", "—", "?"}


@dataclass
class ColumnReport:
    original: str
    normalized: str
    inferred_type: str
    nulls: int = 0


@dataclass
class StandardizationReport:
    columns: List[ColumnReport] = field(default_factory=list)
    rows_in: int = 0
    rows_out: int = 0
    dropped_empty_rows: int = 0

    def as_dict(self) -> Dict[str, Any]:
        return {
            "rowsIn": self.rows_in,
            "rowsOut": self.rows_out,
            "droppedEmptyRows": self.dropped_empty_rows,
            "columns": [
                {
                    "original": c.original,
                    "normalized": c.normalized,
                    "type": c.inferred_type,
                    "nulls": c.nulls,
                }
                for c in self.columns
            ],
        }


# --------------------------------------------------------------------------- #
#  Outils de normalisation
# --------------------------------------------------------------------------- #
def _strip_accents(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c))


def normalize_column_name(name: str) -> str:
    """Transforme un libellé en identifiant `snake_case` propre."""
    base = _strip_accents(str(name)).strip().lower()
    base = re.sub(r"[^\w]+", "_", base)
    base = re.sub(r"_+", "_", base).strip("_")
    return base or "colonne"


def _dedupe_names(names: List[str]) -> List[str]:
    """Évite les collisions de noms (`montant`, `montant` -> `montant`, `montant_2`)."""
    seen: Dict[str, int] = {}
    out: List[str] = []
    for n in names:
        if n not in seen:
            seen[n] = 1
            out.append(n)
        else:
            seen[n] += 1
            out.append(f"{n}_{seen[n]}")
    return out


def _normalize_numeric_string(value: str) -> Optional[str]:
    """Convertit une écriture francophone d'un nombre en littéral parsable.

    Exemples : « 1 250,50 », « 1.250,50 FCFA », « 32 000 » -> « 1250.50 », « 32000 ».
    """
    txt = value.strip()
    if txt.lower() in _NA_TOKENS:
        return None
    # Retire les codes / symboles de devise.
    for token in config.CURRENCY_TOKENS:
        txt = re.sub(re.escape(token), "", txt, flags=re.IGNORECASE)
    # Retire les séparateurs de milliers.
    for ch in config.THOUSANDS_CHARS:
        txt = txt.replace(ch, "")
    txt = txt.strip()
    if txt == "":
        return None
    has_comma, has_dot = "," in txt, "." in txt
    if has_comma and has_dot:
        # Le séparateur décimal est le dernier rencontré.
        if txt.rfind(",") > txt.rfind("."):
            txt = txt.replace(".", "").replace(",", ".")
        else:
            txt = txt.replace(",", "")
    elif has_comma:
        txt = txt.replace(",", ".")
    return txt


def _try_numeric(series: pd.Series) -> Optional[pd.Series]:
    """Tente une conversion numérique tolérante au format francophone."""
    normalized = series.map(lambda v: _normalize_numeric_string(v) if isinstance(v, str) else v)
    converted = pd.to_numeric(normalized, errors="coerce")
    non_null = series.notna().sum()
    if non_null == 0:
        return None
    success = converted.notna().sum()
    if success / non_null >= config.INFERENCE_THRESHOLD:
        # Entiers si toutes les valeurs sont entières.
        non_na = converted.dropna()
        if not non_na.empty and non_na.map(lambda x: float(x).is_integer()).all():
            return converted.astype("Int64")
        return converted
    return None


def _try_boolean(series: pd.Series) -> Optional[pd.Series]:
    lowered = series.dropna().astype(str).str.strip().str.lower()
    if lowered.empty:
        return None
    uniques = set(lowered.unique())
    if uniques <= (_TRUE_TOKENS | _FALSE_TOKENS) and uniques & _TRUE_TOKENS:
        def to_bool(v: Any) -> Optional[bool]:
            if not isinstance(v, str):
                return None
            low = v.strip().lower()
            if low in _TRUE_TOKENS:
                return True
            if low in _FALSE_TOKENS:
                return False
            return None

        return series.map(to_bool).astype("boolean")
    return None


def _try_datetime(series: pd.Series, column_name: str) -> Optional[pd.Series]:
    """Parse une colonne en datetime (jour en premier — convention francophone)."""
    non_null = series.notna().sum()
    if non_null == 0:
        return None
    name_hint = any(h in column_name for h in _DATE_NAME_HINTS)
    parsed = pd.to_datetime(series, errors="coerce", dayfirst=True, format="mixed")
    success = parsed.notna().sum()
    ratio = success / non_null
    # On exige soit un indice dans le nom, soit une quasi-totalité de dates valides.
    if (name_hint and ratio >= config.INFERENCE_THRESHOLD) or ratio >= 0.95:
        return parsed
    return None


# --------------------------------------------------------------------------- #
#  Standardisation principale
# --------------------------------------------------------------------------- #
def standardize(
    df: pd.DataFrame,
    *,
    drop_empty_rows: bool = True,
    drop_null_column_pct: float = 0.0,
    fill_numeric_nulls: str = "none",
    drop_duplicates: bool = False,
) -> tuple[pd.DataFrame, StandardizationReport]:
    """Normalise un DataFrame brut et renvoie (df_normalisé, rapport d'audit).

    Options (niveau data engineer) :
      - drop_null_column_pct : supprime les colonnes dont le % de NA dépasse ce seuil (0 = désactivé).
      - fill_numeric_nulls   : « none » | « zero » | « median » pour les colonnes numériques.
      - drop_duplicates      : supprime les lignes en double après nettoyage.
    """
    report = StandardizationReport(rows_in=int(len(df)))
    df = df.copy()

    originals = [str(c) for c in df.columns]
    normalized = _dedupe_names([normalize_column_name(c) for c in originals])
    df.columns = normalized

    # Nettoyage des chaînes : trim + marqueurs NA harmonisés.
    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].map(_clean_string_cell)

    if drop_empty_rows:
        before = len(df)
        df = df.dropna(how="all").reset_index(drop=True)
        report.dropped_empty_rows = before - len(df)

    if drop_null_column_pct > 0 and len(df.columns):
        to_drop = [
            c for c in df.columns
            if df[c].isna().mean() * 100 > drop_null_column_pct
        ]
        if to_drop:
            df = df.drop(columns=to_drop)

    # Inférence de type colonne par colonne : booléen -> nombre -> date -> texte.
    inferred_types: Dict[str, str] = {}
    for col in df.columns:
        series = df[col]
        if series.dtype != object:
            inferred_types[col] = _friendly_dtype(series)
            continue

        as_bool = _try_boolean(series)
        if as_bool is not None:
            df[col] = as_bool
            inferred_types[col] = "boolean"
            continue

        as_num = _try_numeric(series)
        if as_num is not None:
            df[col] = as_num
            inferred_types[col] = "numeric"
            continue

        as_dt = _try_datetime(series, col)
        if as_dt is not None:
            df[col] = as_dt
            inferred_types[col] = "date"
            continue

        df[col] = series.astype("string")
        inferred_types[col] = "text"

    if fill_numeric_nulls in ("zero", "median"):
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                if fill_numeric_nulls == "zero":
                    df[col] = df[col].fillna(0)
                else:
                    med = df[col].median()
                    df[col] = df[col].fillna(med if pd.notna(med) else 0)

    if drop_duplicates and len(df):
        df = df.drop_duplicates().reset_index(drop=True)

    report.rows_out = int(len(df))
    for original, norm in zip(originals, normalized):
        report.columns.append(
            ColumnReport(
                original=original,
                normalized=norm,
                inferred_type=inferred_types.get(norm, "text"),
                nulls=int(df[norm].isna().sum()) if norm in df.columns else 0,
            )
        )
    return df, report


def _clean_string_cell(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    stripped = re.sub(r"\s+", " ", value).strip()
    if stripped.lower() in _NA_TOKENS:
        return None
    return stripped


def _friendly_dtype(series: pd.Series) -> str:
    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    return "text"
