"""Erreurs métier de l'ETL."""

from __future__ import annotations


class PipelineError(Exception):
    """Erreur fonctionnelle d'un node, renvoyée proprement au client."""
