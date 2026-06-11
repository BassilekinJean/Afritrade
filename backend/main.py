"""API DataPipe — ETL visuel pour pipelines bancaires.

Authentification 100 % locale (SQLite + JWT). L'inscription publique n'existe
pas : seul un administrateur crée les comptes.

Endpoints principaux :
  POST /api/auth/login        -> connexion (renvoie un JWT + l'utilisateur)
  POST /api/auth/logout       -> déconnexion (journalisée)
  GET  /api/auth/me           -> profil courant
  GET  /api/admin/users       -> (admin) liste des comptes
  POST /api/admin/users       -> (admin) création de compte
  PATCH/DELETE /api/admin/users/{id} -> (admin) mise à jour / suppression
  GET  /api/admin/activity    -> (admin) journal d'activité (temps réel)
  GET  /api/projects ...      -> CRUD projets de l'utilisateur
  POST /api/sources/upload    -> import d'un fichier source (CSV/JSON/SQL)
  POST /api/pipeline/run      -> exécution du graphe ETL
  POST /api/ai/generate       -> génération de code via l'assistant IA
  GET  /api/health            -> état du service
"""

from __future__ import annotations

import base64
import logging
import os
import uuid
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

import ai
from ai.conductor import (
    build_welcome,
    create_session,
    get_session_state,
    respond_to_plan,
    respond_to_step,
    submit_intent,
)
import database
from auth import CurrentUser, get_current_user
from etl.kind_detect import SQLITE_B64_PREFIX, detect_kind_from_filename, encode_binary
from pipeline import PipelineError, execute_graph, preview_source, store as etl_store
from pipeline_service import run_pipeline_tracked
from routers import admin as admin_router
from routers import auth as auth_router
from routers import automation as automation_router
from schemas import (
    ConductorIntentRequest,
    ConductorPlanRequest,
    ConductorStartRequest,
    ConductorStepRequest,
)
from routers import connections as connections_router
from routers import executions as executions_router
from routers import projects as projects_router
from security import hash_password
from storage import DATASETS, DatasetStore

load_dotenv()

logger = logging.getLogger("datapipe")

app = FastAPI(title="DataPipe API", version="2.0.0")


def _seed_admin() -> None:
    """Crée le compte administrateur initial s'il n'existe aucun compte."""
    if database.count_users() > 0:
        return
    username = os.environ.get("ADMIN_USERNAME", "aaprovidir")
    password = os.environ.get("ADMIN_PASSWORD", "aaprovidir")
    database.create_user(
        username=username,
        password_hash=hash_password(password),
        role="admin",
        full_name="Administrateur",
    )
    logger.warning(
        "Compte admin initial créé : %s (mot de passe par défaut — à changer).", username
    )


@app.on_event("startup")
def on_startup() -> None:
    database.init_db()
    _seed_admin()
    try:
        import scheduler as sched_mod

        sched_mod.start_scheduler()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Planificateur non démarré : %s", exc)


@app.on_event("shutdown")
def on_shutdown() -> None:
    try:
        import scheduler as sched_mod

        sched_mod.stop_scheduler()
    except Exception:  # noqa: BLE001
        pass


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
app.include_router(admin_router.router)
app.include_router(projects_router.router)
app.include_router(connections_router.router)
app.include_router(executions_router.router)
app.include_router(automation_router.router)
app.include_router(automation_router.hooks_router)

# Cache local des fichiers importés (clé = datasetId).
# Réexporte l'instance globale définie dans storage.py.


# --------------------------------------------------------------------------- #
#  Schémas (pipeline / IA)
# --------------------------------------------------------------------------- #
class GraphNode(BaseModel):
    id: str
    type: str
    data: Dict[str, Any] = {}


class GraphEdge(BaseModel):
    id: Optional[str] = None
    source: str
    target: str
    sourceHandle: Optional[str] = None


class RunRequest(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    project_id: Optional[str] = None


class AIRequest(BaseModel):
    description: str
    columns: Optional[List[str]] = None
    mode: str = "pandas"


class FetchUrlRequest(BaseModel):
    url: str


class DatabasePreviewRequest(BaseModel):
    connectionUrl: str
    table: Optional[str] = None
    query: Optional[str] = None
    limit: Optional[int] = 5000


class SourceAnalyzeItem(BaseModel):
    id: str
    type: str
    label: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)


class NormalizeOptions(BaseModel):
    dropEmptyRows: bool = True
    dropNullColumnPct: float = 0.0
    fillNumericNulls: str = "none"  # none | zero | median
    dropDuplicates: bool = False


class AnalyzeRequest(BaseModel):
    sources: List[SourceAnalyzeItem]
    applyNormalize: bool = False
    normalizeOptions: Optional[NormalizeOptions] = None


class ExportRequest(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    format: str = "csv"
    filename: Optional[str] = "resultat"
    tableName: Optional[str] = "dataset"
    csvDelimiter: Optional[str] = ";"


# --------------------------------------------------------------------------- #
#  Endpoints généraux
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health() -> Dict[str, Any]:
    ai_status = ai.get_ai_status()
    return {
        "status": "ok",
        "datasets": len(DATASETS),
        "aiKey": ai_status["hasKey"],
        "aiProvider": ai_status["provider"],
        "aiModel": ai_status["model"],
        "aiMode": ai_status["mode"],
    }


@app.get("/api/sources/db-hint")
def db_connection_hint(_user: CurrentUser = Depends(get_current_user)) -> Dict[str, str]:
    """URL SQLite locale par défaut (base applicative) pour faciliter les tests."""
    from etl.db_connect import default_sqlite_hint

    return {"sqliteUrl": default_sqlite_hint(), "hint": "Tables : users, projects, activity_log"}


def _encode_upload_content(kind: str, raw: bytes) -> str:
    if kind == "sqlite":
        return SQLITE_B64_PREFIX + base64.b64encode(raw).decode("ascii")
    if kind in ("excel", "pdf", "word"):
        return encode_binary(kind, raw)
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1")


@app.post("/api/sources/upload")
async def upload_source(
    file: UploadFile = File(...),
    delimiter: Optional[str] = Form(default=None),
    table: Optional[str] = Form(default=None),
    sheet: Optional[str] = Form(default=None),
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Importe un fichier source (CSV, Excel, PDF, Word, JSON, SQL…) et renvoie un aperçu."""
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Fichier vide.")

    filename = file.filename or "source"
    kind = detect_kind_from_filename(filename)
    content = _encode_upload_content(kind, raw)

    ext = os.path.splitext(filename)[1].lower() or ".dat"
    dataset_id = f"sources/{uuid.uuid4().hex}{ext}"
    DATASETS.add(dataset_id, content)

    response: Dict[str, Any] = {
        "datasetId": dataset_id,
        "filename": filename,
        "kind": kind,
        "sourceKind": kind,
        "size": len(raw),
        "delimiter": delimiter,
        "table": table,
        "sheet": sheet,
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


@app.post("/api/sources/fetch-url")
def fetch_url_source(
    req: FetchUrlRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Récupère une page web, un article, un CSV/JSON en ligne et renvoie un aperçu."""
    from etl.extract import _fetch_url_content

    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL vide.")
    try:
        kind, content = _fetch_url_content(url)
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    dataset_id = f"sources/url_{uuid.uuid4().hex}.dat"
    DATASETS.add(dataset_id, content)

    response: Dict[str, Any] = {
        "datasetId": dataset_id,
        "filename": url,
        "kind": kind,
        "sourceKind": kind,
        "url": url,
        "size": len(content),
    }
    try:
        if kind == "html":
            from etl.extract import _html_to_df
            from etl.standardize import standardize
            from etl.engine import _frame_to_preview

            raw_df = _html_to_df(content, url)
            clean, report = standardize(raw_df)
            preview = _frame_to_preview(clean, 20)
            preview["standardization"] = report.as_dict()
        else:
            preview = preview_source(content, kind)
        response["preview"] = preview
        response["columns"] = preview.get("columns", [])
        response["rowCount"] = preview.get("rowCount", 0)
    except PipelineError as exc:
        response["preview"] = {"error": str(exc)}
        response["columns"] = []
        response["rowCount"] = 0
    return response


@app.post("/api/sources/database")
def preview_database(
    req: DatabasePreviewRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Teste une connexion base de données et renvoie un aperçu des données."""
    from etl.extract import extract_database

    cfg: Dict[str, Any] = {
        "connectionUrl": req.connectionUrl.strip(),
        "table": req.table,
        "query": req.query,
        "limit": req.limit or 5000,
    }
    try:
        raw = extract_database(cfg, {})
        from etl.standardize import standardize
        from etl.engine import _frame_to_preview

        clean, report = standardize(raw)
        preview = _frame_to_preview(clean, 20)
        preview["standardization"] = report.as_dict()
        return {
            "preview": preview,
            "columns": preview.get("columns", []),
            "rowCount": preview.get("rowCount", 0),
            "connectionUrl": req.connectionUrl.strip(),
        }
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/pipeline/run")
def run_pipeline(
    req: RunRequest, current_user: CurrentUser = Depends(get_current_user)
) -> Dict[str, Any]:
    nodes = [n.model_dump() for n in req.nodes]
    edges = [e.model_dump(exclude_none=True) for e in req.edges]
    try:
        result = run_pipeline_tracked(
            nodes, edges, DATASETS,
            user_id=current_user.id,
            project_id=req.project_id,
            trigger_type="manual",
        )
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Erreur interne : {exc}") from exc
    database.log_activity(
        action="pipeline_run", user_id=current_user.id, email=current_user.username,
        detail=f"{len(nodes)} nœuds",
    )
    return result


@app.get("/api/ai/status")
def ai_status_endpoint(_user: CurrentUser = Depends(get_current_user)) -> Dict[str, Any]:
    return ai.get_ai_status()


@app.post("/api/ai/generate")
def ai_generate(
    req: AIRequest, current_user: CurrentUser = Depends(get_current_user)
) -> Dict[str, Any]:
    if not req.description.strip():
        raise HTTPException(status_code=400, detail="Description vide.")
    mode = req.mode if req.mode in ("pandas", "sql") else "pandas"
    try:
        return ai.generate_transformation(req.description, req.columns, mode)
    except ai.CodeValidationError as exc:
        raise HTTPException(status_code=422, detail=f"Code généré rejeté : {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Échec de la génération : {exc}") from exc


@app.get("/api/ai/welcome")
def ai_welcome(current_user: CurrentUser = Depends(get_current_user)) -> Dict[str, Any]:
    return build_welcome(
        current_user.id,
        current_user.username,
        getattr(current_user, "full_name", None),
    )


@app.post("/api/ai/conductor/start")
def ai_conductor_start(
    req: ConductorStartRequest, current_user: CurrentUser = Depends(get_current_user)
) -> Dict[str, Any]:
    return create_session(
        current_user.id,
        req.columns,
        req.sourceLabel,
        req.projectId,
        req.sourceNodeId,
    )


@app.post("/api/ai/conductor/intent")
def ai_conductor_intent(
    req: ConductorIntentRequest, current_user: CurrentUser = Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        return submit_intent(req.sessionId, current_user.id, req.intent)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/ai/conductor/plan")
def ai_conductor_plan(
    req: ConductorPlanRequest, current_user: CurrentUser = Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        return respond_to_plan(req.sessionId, current_user.id, req.action, req.feedback)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/ai/conductor/step")
def ai_conductor_step(
    req: ConductorStepRequest, current_user: CurrentUser = Depends(get_current_user)
) -> Dict[str, Any]:
    try:
        return respond_to_step(req.sessionId, current_user.id, req.action, req.feedback)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/ai/conductor/{session_id}")
def ai_conductor_get(
    session_id: str, current_user: CurrentUser = Depends(get_current_user)
) -> Dict[str, Any]:
    from ai.conductor import get_session

    if not get_session(session_id, current_user.id):
        raise HTTPException(status_code=404, detail="Session conducteur introuvable.")
    return get_session_state(session_id)


@app.get("/api/etl/staging")
def etl_staging(_user: CurrentUser = Depends(get_current_user)) -> Dict[str, Any]:
    return etl_store.summary()


@app.post("/api/etl/reset")
def etl_reset(_user: CurrentUser = Depends(get_current_user)) -> Dict[str, Any]:
    etl_store.reset()
    return {"status": "ok", "message": "Bases tampon réinitialisées."}


@app.post("/api/etl/analyze")
def etl_analyze(
    req: AnalyzeRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Profilage intelligent de plusieurs sources + normalisation optionnelle."""
    from etl.analyze import analyze_sources

    try:
        opts = req.normalizeOptions.model_dump() if req.normalizeOptions else {}
        return analyze_sources(
            [s.model_dump() for s in req.sources],
            DATASETS,
            apply_normalize=req.applyNormalize,
            normalize_options=opts,
        )
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


class ClassifyRequest(BaseModel):
    sources: List[SourceAnalyzeItem]


class CausalPredictRequest(BaseModel):
    sources: List[SourceAnalyzeItem]
    targetColumn: str
    featureColumns: Optional[List[str]] = None
    timeColumn: Optional[str] = None
    joinColumn: Optional[str] = None
    mode: str = "causal"  # causal | predict | forecast
    horizon: int = 5


@app.post("/api/etl/classify")
def etl_classify(
    req: ClassifyRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Classification sémantique agricole (embeddings) de sources multiples."""
    from etl.agri_classify import classify_sources_batch

    try:
        return classify_sources_batch(
            [s.model_dump() for s in req.sources],
            DATASETS,
        )
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/etl/intelligence")
def etl_intelligence(
    req: CausalPredictRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Analyse causale et prédiction sur sources multiples (thème agricole)."""
    from etl.causal import multi_source_causal, analyze_causal
    from etl.extract import EXTRACTORS
    from etl.predict import forecast_timeseries, predict_regression
    import pandas as pd

    if not req.sources:
        raise HTTPException(status_code=400, detail="Au moins une source requise.")
    if not req.targetColumn.strip():
        raise HTTPException(status_code=400, detail="targetColumn requis.")

    try:
        mode = (req.mode or "causal").lower()
        if len(req.sources) > 1:
            if mode == "causal":
                return multi_source_causal(
                    [s.model_dump() for s in req.sources],
                    DATASETS,
                    target_column=req.targetColumn,
                    join_column=req.joinColumn,
                )
            # Fusion pour predict/forecast
            from etl.causal import multi_source_causal as _msc
            merged_report = _msc(
                [s.model_dump() for s in req.sources],
                DATASETS,
                target_column=req.targetColumn,
                join_column=req.joinColumn,
            )
            # Re-extraire merged df — refaire fusion simple
            frames = []
            for src in req.sources:
                ntype = src.type
                if ntype in EXTRACTORS:
                    frames.append(EXTRACTORS[ntype](src.config, DATASETS))
            if req.joinColumn and len(frames) > 1:
                df = frames[0]
                for other in frames[1:]:
                    if req.joinColumn in df.columns and req.joinColumn in other.columns:
                        df = df.merge(other, on=req.joinColumn, how="outer")
                    else:
                        df = pd.concat([df, other], ignore_index=True)
            else:
                df = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
        else:
            src = req.sources[0]
            if src.type not in EXTRACTORS:
                raise PipelineError(f"Type inconnu : {src.type}")
            df = EXTRACTORS[src.type](src.config, DATASETS)

        if mode == "forecast":
            if not req.timeColumn:
                raise HTTPException(status_code=400, detail="timeColumn requis pour forecast.")
            result = forecast_timeseries(df, req.timeColumn, req.targetColumn, horizon=req.horizon)
            pred_df = result.pop("predictions")
            result["preview"] = {
                "columns": list(pred_df.columns),
                "rows": pred_df.head(50).replace({pd.NA: None}).to_dict(orient="records"),
                "rowCount": int(len(pred_df)),
            }
            return result

        if mode == "predict":
            result = predict_regression(df, req.targetColumn, req.featureColumns)
            pred_df = result.pop("predictions")
            result["preview"] = {
                "columns": list(pred_df.columns),
                "rows": pred_df.head(50).replace({pd.NA: None}).to_dict(orient="records"),
                "rowCount": int(len(pred_df)),
            }
            return result

        # causal single source
        report = analyze_causal(
            df,
            target_column=req.targetColumn,
            feature_columns=req.featureColumns,
            time_column=req.timeColumn,
        )
        return report
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/export")
def export_pipeline(
    req: ExportRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    """Exécute le pipeline et télécharge le résultat final au format choisi."""
    from etl.export_fmt import export_dataframe

    nodes = [n.model_dump() for n in req.nodes]
    edges = [e.model_dump() for e in req.edges]
    try:
        result = execute_graph(nodes, edges, DATASETS)
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    final = result.get("final")
    if not final or not final.get("rows"):
        raise HTTPException(status_code=400, detail="Aucun résultat à exporter. Connectez une sortie au pipeline.")

    import pandas as pd

    df = pd.DataFrame(final["rows"])
    try:
        content, mime, fname = export_dataframe(
            df,
            req.format,
            filename=req.filename or "resultat",
            table_name=req.tableName or "dataset",
            csv_delimiter=req.csvDelimiter or ";",
        )
    except PipelineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    database.log_activity(
        action="export", user_id=current_user.id, email=current_user.username,
        detail=f"{req.format} ({len(df)} lignes)",
    )
    return Response(
        content=content,
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )
