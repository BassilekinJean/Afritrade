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

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ai
from pipeline import PipelineError, execute_graph

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
async def upload_source(file: UploadFile = File(...)) -> Dict[str, Any]:
    raw = await file.read()
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError:
        content = raw.decode("latin-1")

    dataset_id = str(uuid.uuid4())
    DATASETS[dataset_id] = content

    kind = "json" if (file.filename or "").lower().endswith(".json") else "csv"
    return {
        "datasetId": dataset_id,
        "filename": file.filename,
        "kind": kind,
        "size": len(content),
        "preview": content[:2000],
    }


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
