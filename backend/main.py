"""API DataPipe — ETL visuel pour pipelines bancaires.

Endpoints :
  POST /api/sources/upload   -> importe un fichier (CSV/JSON), renvoie un id + aperçu
  POST /api/pipeline/run     -> exécute le graphe nodal et renvoie les aperçus
  POST /api/ai/generate      -> génère du code de transformation depuis une description
  GET  /api/health           -> état du service
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ai
from pipeline import PipelineError, execute_graph, preview_source, store

app = FastAPI(title="DataPipe API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.post("/api/sources/upload")
async def upload_source(
    file: UploadFile = File(...),
    delimiter: Optional[str] = Form(default=None),
) -> Dict[str, Any]:
    """Importe un fichier source (CSV / JSON).

    Le contenu est conservé en mémoire (réutilisé tel quel par le pipeline) et,
    en plus, immédiatement extrait + standardisé pour renvoyer un aperçu
    structuré (colonnes, types inférés, premières lignes harmonisées).
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Fichier vide.")
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")

    filename = file.filename or "source"
    kind = "json" if filename.lower().endswith(".json") else "csv"

    dataset_id = str(uuid.uuid4())
    DATASETS[dataset_id] = content

    response: Dict[str, Any] = {
        "datasetId": dataset_id,
        "filename": filename,
        "kind": kind,
        "size": len(content),
        "delimiter": delimiter,
    }
    try:
        preview = preview_source(content, kind, delimiter=delimiter)
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
