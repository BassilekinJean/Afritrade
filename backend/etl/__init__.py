"""Package ETL de DataPipe.

Architecture en couches (modèle Medallion) avec bases de données tampon :

    extract.py      EXTRACT      -> couche RAW
    standardize.py  STANDARDIZE  -> couche CLEAN (formats harmonisés)
    transform.py    TRANSFORM    -> couche CLEAN (transformations du graphe)
    engine.py       LOAD + orchestration parallèle -> couche WAREHOUSE
    staging.py      gestion des 3 bases tampon SQLite
"""

from __future__ import annotations

from .engine import execute_graph, preview_source
from .errors import PipelineError
from .staging import store

__all__ = ["execute_graph", "preview_source", "PipelineError", "store"]
