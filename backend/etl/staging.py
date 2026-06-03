"""Gestion des bases de données « tampon » (staging) de l'ETL.

Trois bases SQLite distinctes matérialisent les couches de l'architecture :

    RAW       -> staging_raw.sqlite      (données extraites brutes)
    CLEAN     -> staging_clean.sqlite     (données standardisées / transformées)
    WAREHOUSE -> warehouse.sqlite         (données finales chargées)

Chaque node du pipeline écrit une table dédiée dans la couche concernée, ce qui
donne une traçabilité complète (audit) du parcours de la donnée et permet le
rechargement / l'inspection a posteriori.

Les écritures SQLite sont sérialisées par un verrou car SQLite n'accepte qu'un
seul écrivain à la fois ; les lectures, elles, peuvent être concurrentes.
"""

from __future__ import annotations

import re
import threading
from enum import Enum
from typing import Any, Dict, List

import pandas as pd
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from . import config


class Layer(str, Enum):
    """Couches logiques de l'ETL."""

    RAW = "raw"
    CLEAN = "clean"
    WAREHOUSE = "warehouse"


_LAYER_DB = {
    Layer.RAW: config.RAW_DB,
    Layer.CLEAN: config.CLEAN_DB,
    Layer.WAREHOUSE: config.WAREHOUSE_DB,
}


def _safe_table_name(name: str) -> str:
    """Assainit un identifiant pour qu'il soit un nom de table SQL valide."""
    cleaned = re.sub(r"[^0-9a-zA-Z_]+", "_", str(name)).strip("_")
    if not cleaned:
        cleaned = "t"
    if cleaned[0].isdigit():
        cleaned = f"t_{cleaned}"
    return cleaned.lower()


class StagingStore:
    """Façade thread-safe au-dessus des trois bases tampon SQLite."""

    def __init__(self) -> None:
        config.ensure_data_dir()
        self._engines: Dict[Layer, Engine] = {}
        self._write_lock = threading.Lock()
        for layer, path in _LAYER_DB.items():
            # check_same_thread=False : les engines sont partagés entre threads
            # (l'exécution parallèle des nodes). L'écriture reste protégée par le verrou.
            self._engines[layer] = create_engine(
                f"sqlite:///{path}",
                connect_args={"check_same_thread": False},
                future=True,
            )

    # ------------------------------------------------------------------ #
    #  Écriture / lecture
    # ------------------------------------------------------------------ #
    def write(self, layer: Layer, table: str, df: pd.DataFrame) -> str:
        """Matérialise un DataFrame dans une table de la couche donnée.

        Retourne le nom réel (assaini) de la table écrite.
        """
        name = _safe_table_name(table)
        engine = self._engines[layer]
        with self._write_lock:
            df.to_sql(name, engine, index=False, if_exists="replace")
        return name

    def read(self, layer: Layer, table: str) -> pd.DataFrame:
        """Relit une table d'une couche sous forme de DataFrame."""
        name = _safe_table_name(table)
        engine = self._engines[layer]
        return pd.read_sql(text(f'SELECT * FROM "{name}"'), engine)

    # ------------------------------------------------------------------ #
    #  Inspection / maintenance
    # ------------------------------------------------------------------ #
    def list_tables(self, layer: Layer) -> List[str]:
        return list(inspect(self._engines[layer]).get_table_names())

    def summary(self) -> Dict[str, Any]:
        """Décrit l'état des trois couches (tables + nb de lignes)."""
        out: Dict[str, Any] = {}
        for layer, engine in self._engines.items():
            tables = []
            for tname in inspect(engine).get_table_names():
                try:
                    count = pd.read_sql(text(f'SELECT COUNT(*) AS n FROM "{tname}"'), engine)["n"].iloc[0]
                except Exception:  # noqa: BLE001
                    count = None
                tables.append({"table": tname, "rows": int(count) if count is not None else None})
            out[layer.value] = {"path": str(_LAYER_DB[layer]), "tables": tables}
        return out

    def reset(self) -> None:
        """Vide entièrement les trois bases tampon (réinitialisation propre)."""
        with self._write_lock:
            for engine in self._engines.values():
                insp = inspect(engine)
                with engine.begin() as conn:
                    for tname in insp.get_table_names():
                        conn.execute(text(f'DROP TABLE IF EXISTS "{tname}"'))


# Instance partagée (les engines SQLite gèrent leur propre pool de connexions).
store = StagingStore()
