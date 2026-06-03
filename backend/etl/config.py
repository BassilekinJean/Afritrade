"""Configuration centrale de l'ETL DataPipe.

Définit l'emplacement des trois bases de données « tampon » (staging) qui
matérialisent les couches de l'architecture ETL, ainsi que les constantes
métier (format de date, séparateurs francophones, devises).
"""

from __future__ import annotations

import os
from pathlib import Path

# Racine des données persistées (bases tampon SQLite).
DATA_DIR = Path(os.environ.get("DATAPIPE_DATA_DIR", Path(__file__).resolve().parent.parent / ".data"))

# --------------------------------------------------------------------------- #
#  Couches de l'architecture (modèle « Medallion » : Bronze / Silver / Gold)
# --------------------------------------------------------------------------- #
#  RAW       (Bronze) : données extraites telles quelles depuis les sources.
#  CLEAN     (Silver) : données standardisées + transformées (zone de travail).
#  WAREHOUSE (Gold)   : données finales chargées, prêtes à consommer.
RAW_DB = DATA_DIR / "staging_raw.sqlite"
CLEAN_DB = DATA_DIR / "staging_clean.sqlite"
WAREHOUSE_DB = DATA_DIR / "warehouse.sqlite"

# Préfixes de tables par couche (un node = une table).
RAW_PREFIX = "raw"
CLEAN_PREFIX = "clean"
WORK_PREFIX = "work"
GOLD_PREFIX = "gold"

# --------------------------------------------------------------------------- #
#  Constantes métier (contexte bancaire africain / francophone)
# --------------------------------------------------------------------------- #
# Format de date canonique imposé en sortie : jour-mois-année.
DATE_OUTPUT_FORMAT = "%d-%m-%Y"
DATETIME_OUTPUT_FORMAT = "%d-%m-%Y %H:%M:%S"

# Devise de référence du projet.
DEFAULT_CURRENCY = "XAF"

# Symboles / codes de devise nettoyés lors de la normalisation numérique.
CURRENCY_TOKENS = ("fcfa", "xaf", "xof", "cfa", "eur", "usd", "gbp", "€", "$", "£")

# Caractères de séparation des milliers rencontrés dans les exports francophones.
THOUSANDS_CHARS = ("\u00a0", "\u202f", "\u2009", " ", "'")

# Seuil de réussite pour décider de convertir une colonne (80 %).
INFERENCE_THRESHOLD = 0.8

# Nombre maximal de threads pour l'exécution parallèle des transformations.
MAX_WORKERS = int(os.environ.get("DATAPIPE_MAX_WORKERS", "8"))


def ensure_data_dir() -> None:
    """Crée le dossier des bases tampon si nécessaire (idempotent)."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
