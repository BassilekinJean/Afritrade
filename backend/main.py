"""API DataPipe — ETL visuel pour pipelines bancaires.

Endpoints :
  POST /api/auth/signup      -> inscription, renvoie un token JWT + l'utilisateur
  POST /api/auth/login       -> connexion, renvoie un token JWT + l'utilisateur
  GET  /api/auth/me          -> profil de l'utilisateur authentifié
  GET  /api/projects         -> liste des projets de l'utilisateur
  POST /api/projects         -> création d'un projet
  GET  /api/projects/{id}    -> détail d'un projet (avec son graphe)
  PATCH/DELETE /api/projects/{id} -> mise à jour / suppression
  POST /api/sources/upload   -> importe un fichier (CSV/JSON), renvoie un id + aperçu
  POST /api/pipeline/run     -> exécute le graphe nodal et renvoie les aperçus
  POST /api/ai/generate      -> génère du code de transformation depuis une description
  GET  /api/health           -> état du service
"""

from __future__ import annotations

import os
import base64
import uuid
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ai
from database import Base, engine
from etl.extract import SQLITE_B64_PREFIX
from pipeline import PipelineError, execute_graph, preview_source, store
from routers import auth as auth_router
from routers import projects as projects_router

load_dotenv()

app = FastAPI(title="DataPipe API", version="1.0.0")


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


_origins = os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(projects_router.router)

# Stockage en mémoire des fichiers importés (clé = datasetId).
DATASETS: Dict[str, str] = {}


# --------------------------------------------------------------------------- #
#  Schémas
# --------------------------------------------------------------------------- #
class GraphNode(BaseModel):
    id: str
    type: str
    data: Dict[str, Any] = {}


class GraphEdge(BaseModel):
    id: Optional[str] = None
    source: str
    target: str


class RunRequest(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


class AIRequest(BaseModel):
    description: str
    columns: Optional[List[str]] = None
    mode: str = "pandas"


# --------------------------------------------------------------------------- #
#  Endpoints
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "datasets": len(DATASETS), "aiKey": bool(__import__("os").environ.get("OPENAI_API_KEY"))}


def _detect_kind(filename: str) -> str:
    """Déduit le type de source à partir de l'extension du fichier."""
    lower = filename.lower()
    if lower.endswith(".json"):
        return "json"
    if lower.endswith(".sql"):
        return "sql"
    if lower.endswith((".sqlite", ".sqlite3", ".db")):
        return "sqlite"
    return "csv"


@app.post("/api/sources/upload")
async def upload_source(
    file: UploadFile = File(...),
    delimiter: Optional[str] = Form(default=None),
    table: Optional[str] = Form(default=None),
) -> Dict[str, Any]:
    """Importe un fichier source (CSV / JSON / SQL / SQLite).

    Le contenu est conservé en mémoire (réutilisé tel quel par le pipeline) et,
    en plus, immédiatement extrait + standardisé pour renvoyer un aperçu
    structuré (colonnes, types inférés, premières lignes harmonisées).

    Les bases SQLite (`.sqlite` / `.db`) étant binaires, elles sont stockées
    encodées en base64 (préfixe interne) pour rester compatibles avec le même
    stockage texte que les autres sources.
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Fichier vide.")

    filename = file.filename or "source"
    kind = _detect_kind(filename)

    if kind == "sqlite":
        content = SQLITE_B64_PREFIX + base64.b64encode(raw).decode("ascii")
    else:
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            content = raw.decode("latin-1")

    dataset_id = str(uuid.uuid4())
    DATASETS[dataset_id] = content

    response: Dict[str, Any] = {
        "datasetId": dataset_id,
        "filename": filename,
        "kind": kind,
        "size": len(raw),
        "delimiter": delimiter,
        "table": table,
    }
    try:
        preview = preview_source(content, kind, delimiter=delimiter, table=table)
        response["preview"] = preview
        response["columns"] = preview.get("columns", [])
        response["rowCount"] = preview.get("rowCount", 0)
    except PipelineError as exc:
        response["preview"] = {"error": str(exc)}
        response["columns"] = []
        response["rowCount"] = 0
    except Exception as exc:  # noqa: BLE001
        response["preview"] = {"error": f"Lecture du fichier impossible : {exc}"}
        response["columns"] = []
        response["rowCount"] = 0
    return response


@app.post("/api/pipeline/run")
def run_pipeline(req: RunRequest) -> Dict[str, Any]:
    nodes = [n.model_dump() for n in req.nodes]
    edges = [e.model_dump() for e in req.edges]
    try:
        return execute_graph(nodes, edges, DATASETS)
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Erreur interne : {exc}") from exc


@app.post("/api/ai/generate")
def ai_generate(req: AIRequest) -> Dict[str, Any]:
    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Description vide.")
    mode = req.mode if req.mode in ("pandas", "sql") else "pandas"
    return ai.generate_transformation(req.description, req.columns, mode)


@app.get("/api/etl/staging")
def etl_staging() -> Dict[str, Any]:
    """Inspecte les trois bases tampon (RAW / CLEAN / WAREHOUSE)."""
    return store.summary()


@app.post("/api/etl/reset")
def etl_reset() -> Dict[str, Any]:
    """Vide les bases tampon (utile pour repartir d'un état propre)."""
    store.reset()
    return {"status": "ok", "message": "Bases tampon réinitialisées."}
