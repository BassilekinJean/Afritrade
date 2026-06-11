"""Connexions réutilisables (style Talend Connection Repository)."""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status

import database
from auth import CurrentUser, get_current_user
from schemas import ConnectionCreate, ConnectionOut, ConnectionUpdate

router = APIRouter(prefix="/api/connections", tags=["connections"])


@router.get("", response_model=List[ConnectionOut])
def list_connections(current_user: CurrentUser = Depends(get_current_user)) -> List[Dict[str, Any]]:
    return database.list_connections(current_user.id)


@router.post("", response_model=ConnectionOut, status_code=status.HTTP_201_CREATED)
def create_connection(
    payload: ConnectionCreate,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    return database.create_connection(
        current_user.id,
        {
            "name": payload.name,
            "conn_type": payload.conn_type,
            "connection_url": payload.connection_url,
            "description": payload.description,
        },
    )


@router.patch("/{connection_id}", response_model=ConnectionOut)
def update_connection(
    connection_id: str,
    payload: ConnectionUpdate,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    updated = database.update_connection(
        connection_id,
        current_user.id,
        payload.model_dump(exclude_unset=True),
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Connexion introuvable.")
    return updated


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    connection_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    if not database.delete_connection(connection_id, current_user.id):
        raise HTTPException(status_code=404, detail="Connexion introuvable.")
    return None


@router.post("/{connection_id}/test")
def test_connection(
    connection_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> Dict[str, Any]:
    conn = database.get_connection(connection_id, current_user.id)
    if conn is None:
        raise HTTPException(status_code=404, detail="Connexion introuvable.")
    from etl.extract import extract_database

    try:
        result = extract_database(
            {"connectionUrl": conn["connection_url"], "table": "", "query": "SELECT 1 AS ok", "limit": 1},
            {},
        )
        return {"status": "ok", "message": "Connexion réussie.", "rows": len(result)}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
