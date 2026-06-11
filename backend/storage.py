"""Stockage local des fichiers sources importés (CSV / JSON / SQL / SQLite).

Auth maison oblige : plus de Supabase Storage. Les fichiers importés sont gardés
en cache mémoire et persistés sur disque (dossier `.data/uploads`) afin de
survivre aux rechargements du serveur de dev. L'identifiant de dataset est le
chemin logique du fichier.
"""

from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Dict, Optional

_UPLOAD_DIR = Path(
    os.environ.get("DATAPIPE_DATA_DIR", Path(__file__).resolve().parent / ".data")
) / "uploads"


class DatasetStore:
    """Cache mémoire + disque des fichiers importés.

    Compatible avec le contrat attendu par le moteur ETL : `id in store`,
    `store[id]`, `len(store)`.
    """

    def __init__(self) -> None:
        self._mem: Dict[str, str] = {}
        self._lock = threading.Lock()

    def _disk_path(self, dataset_id: str) -> Path:
        safe = dataset_id.replace("/", "__")
        return _UPLOAD_DIR / safe

    def add(self, dataset_id: str, content: str) -> None:
        with self._lock:
            self._mem[dataset_id] = content
        try:
            _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            self._disk_path(dataset_id).write_text(content, encoding="utf-8")
        except OSError:
            pass

    def _hydrate(self, dataset_id: str) -> bool:
        path = self._disk_path(dataset_id)
        try:
            if path.is_file():
                content = path.read_text(encoding="utf-8")
                with self._lock:
                    self._mem[dataset_id] = content
                return True
        except OSError:
            pass
        return False

    def __contains__(self, dataset_id: str) -> bool:
        if dataset_id in self._mem:
            return True
        return self._hydrate(dataset_id)

    def __getitem__(self, dataset_id: str) -> str:
        if dataset_id in self._mem:
            return self._mem[dataset_id]
        if self._hydrate(dataset_id):
            return self._mem[dataset_id]
        raise KeyError(dataset_id)

    def get(self, dataset_id: str, default: Optional[str] = None) -> Optional[str]:
        try:
            return self[dataset_id]
        except KeyError:
            return default

    def __len__(self) -> int:
        return len(self._mem)


# Instance globale partagée (API, scheduler, webhooks).
DATASETS = DatasetStore()
