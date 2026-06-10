"""Compatibilité historique.

Le moteur d'exécution a été refactorisé en un véritable ETL multi-couches dans
le package `etl` (extract / standardize / transform / load + orchestration
parallèle). Ce module conserve les symboles attendus par `main.py` afin de ne
rien casser côté API.
"""

from __future__ import annotations

from etl import PipelineError, execute_graph, preview_source, store
from etl.transform import run_pandas_code

__all__ = ["PipelineError", "execute_graph", "preview_source", "store", "run_pandas_code"]


#salut