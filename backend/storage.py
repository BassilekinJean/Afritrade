"""Intégration Supabase Storage pour les fichiers sources de l'ETL.

Deux responsabilités :

1. `SupabaseStorage` — client REST minimal (via httpx) qui parle au service
   Storage de Supabase avec la clé `service_role` (côté serveur uniquement).
   Permet d'uploader / télécharger les fichiers sources dans un bucket privé.

2. `DatasetStore` — façade utilisée par le moteur ETL à la place de l'ancien
   dictionnaire en mémoire. Elle garde un cache mémoire mais sait réhydrater un
   dataset depuis Supabase Storage si le backend a redémarré (ou si un autre
   worker a servi l'upload). L'identifiant de dataset EST le chemin de l'objet
   dans le bucket, ce qui rend le stockage entièrement « stateless ».

Si Supabase n'est pas configuré (clés absentes), le système retombe
proprement sur un fonctionnement 100 % mémoire (comportement historique).
"""

from __future__ import annotations

import base64
import os
import threading
from pathlib import Path
from typing import Dict, Optional

import httpx
from dotenv import load_dotenv

from etl.extract import SQLITE_B64_PREFIX

load_dotenv()

# Cache disque local des fichiers importés : garantit que la source reste
# disponible pendant toute la session, même si le serveur redémarre ou recharge,
# et indépendamment de l'accès réseau à Supabase Storage.
_UPLOAD_DIR = Path(
    os.environ.get("DATAPIPE_DATA_DIR", Path(__file__).resolve().parent / ".data")
) / "uploads"

SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
BUCKET = os.environ.get("SUPABASE_BUCKET", "projets")

# Extensions traitées comme du binaire (bases SQLite) : on les transporte
# encodées en base64 dans le stockage texte, comme le fait déjà l'upload.
_BINARY_EXTS = (".sqlite", ".sqlite3", ".db")


class StorageError(Exception):
    """Erreur côté Supabase Storage (réseau, droits, bucket…)."""


def is_configured() -> bool:
    """Vrai si l'URL et la clé service_role sont présentes."""
    return bool(SUPABASE_URL and SERVICE_ROLE_KEY)


def _bytes_to_content(object_path: str, data: bytes) -> str:
    """Convertit des octets bruts en représentation texte attendue par l'ETL."""
    if object_path.lower().endswith(_BINARY_EXTS):
        return SQLITE_B64_PREFIX + base64.b64encode(data).decode("ascii")
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("latin-1")


class SupabaseStorage:
    """Client REST minimal pour Supabase Storage (clé service_role)."""

    def __init__(self) -> None:
        self._bucket_ready = False
        self._lock = threading.Lock()

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "apikey": SERVICE_ROLE_KEY,
        }
        if extra:
            headers.update(extra)
        return headers

    def ensure_bucket(self) -> None:
        """Crée le bucket privé s'il n'existe pas encore (idempotent)."""
        if self._bucket_ready or not is_configured():
            return
        with self._lock:
            if self._bucket_ready:
                return
            with httpx.Client(timeout=15.0) as client:
                resp = client.get(
                    f"{SUPABASE_URL}/storage/v1/bucket/{BUCKET}", headers=self._headers()
                )
                if resp.status_code == 200:
                    self._bucket_ready = True
                    return
                created = client.post(
                    f"{SUPABASE_URL}/storage/v1/bucket",
                    headers=self._headers({"Content-Type": "application/json"}),
                    json={"id": BUCKET, "name": BUCKET, "public": False},
                )
                # 200/201 = créé ; 409 = déjà existant (course entre workers).
                if created.status_code not in (200, 201, 409):
                    raise StorageError(
                        f"Création du bucket « {BUCKET} » impossible "
                        f"({created.status_code}): {created.text}"
                    )
                self._bucket_ready = True

    def upload(self, object_path: str, data: bytes, content_type: str) -> None:
        if not is_configured():
            raise StorageError(
                "Supabase Storage non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
            )
        self.ensure_bucket()
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{object_path}",
                headers=self._headers(
                    {"Content-Type": content_type or "application/octet-stream", "x-upsert": "true"}
                ),
                content=data,
            )
            if resp.status_code not in (200, 201):
                raise StorageError(
                    f"Upload vers Storage échoué ({resp.status_code}): {resp.text}"
                )

    def download(self, object_path: str) -> bytes:
        if not is_configured():
            raise StorageError("Supabase Storage non configuré.")
        with httpx.Client(timeout=60.0) as client:
            resp = client.get(
                f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{object_path}",
                headers=self._headers(),
            )
            if resp.status_code != 200:
                raise StorageError(
                    f"Téléchargement depuis Storage échoué ({resp.status_code}): {resp.text}"
                )
            return resp.content


class DatasetStore:
    """Cache mémoire des fichiers importés, réhydratable depuis Supabase Storage.

    Compatible avec l'ancien contrat (`id in store`, `store[id]`) attendu par le
    moteur ETL : l'identifiant de dataset est le chemin de l'objet dans le bucket.
    """

    def __init__(self, storage: Optional[SupabaseStorage] = None) -> None:
        self._mem: Dict[str, str] = {}
        self._lock = threading.Lock()
        self.storage = storage or SupabaseStorage()

    def _disk_path(self, dataset_id: str) -> Path:
        # dataset_id ressemble à "sources/<hex><ext>" ; on aplatit le chemin.
        safe = dataset_id.replace("/", "__")
        return _UPLOAD_DIR / safe

    def add(self, dataset_id: str, content: str) -> None:
        with self._lock:
            self._mem[dataset_id] = content
        # Persistance disque (best-effort) pour survivre aux reloads du serveur.
        try:
            _UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            self._disk_path(dataset_id).write_text(content, encoding="utf-8")
        except OSError:
            pass

    def _hydrate(self, dataset_id: str) -> bool:
        """Recharge un dataset absent du cache : d'abord le disque, puis Storage."""
        # 1) Cache disque local (rapide, sans réseau).
        path = self._disk_path(dataset_id)
        try:
            if path.is_file():
                content = path.read_text(encoding="utf-8")
                with self._lock:
                    self._mem[dataset_id] = content
                return True
        except OSError:
            pass
        # 2) Repli sur Supabase Storage.
        if not is_configured():
            return False
        try:
            data = self.storage.download(dataset_id)
        except StorageError:
            return False
        self.add(dataset_id, _bytes_to_content(dataset_id, data))
        return True

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

    def __len__(self) -> int:
        return len(self._mem)
