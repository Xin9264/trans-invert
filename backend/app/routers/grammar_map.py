"""Grammar map routes."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.routers.texts import ALLOWED_SEVERITY, ALLOWED_SOURCE, practice_history, texts_storage
from app.schemas.text import APIResponse
from app.services.grammar_map_service import build_grammar_map, get_node_examples


router = APIRouter(prefix="/api/grammar-map", tags=["grammar-map"])


@router.get("", response_model=APIResponse)
async def get_grammar_map(
    since: Optional[str] = Query(default=None),
    until: Optional[str] = Query(default=None),
    folder_id: Optional[str] = Query(default=None),
):
    """Return the full grammar map with aggregated mastery statistics."""
    try:
        data = build_grammar_map(
            practice_history,
            since=since,
            until=until,
            folder_id=folder_id,
            texts_storage=texts_storage,
        )
        return APIResponse(
            success=True,
            data=data,
            message="语法地图生成成功",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"生成语法地图失败: {str(exc)}")


@router.get("/", response_model=APIResponse, include_in_schema=False)
async def get_grammar_map_with_slash(
    since: Optional[str] = Query(default=None),
    until: Optional[str] = Query(default=None),
    folder_id: Optional[str] = Query(default=None),
):
    """Compatibility endpoint for clients that include a trailing slash."""
    return await get_grammar_map(since=since, until=until, folder_id=folder_id)


@router.get("/nodes/{node_id}/examples", response_model=APIResponse)
async def get_grammar_map_node_examples(
    node_id: str,
    limit: int = Query(default=20, ge=0, le=100),
    severity: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    since: Optional[str] = Query(default=None),
    until: Optional[str] = Query(default=None),
    folder_id: Optional[str] = Query(default=None),
):
    """Return concrete error examples for a node and its descendants."""
    if severity and severity not in ALLOWED_SEVERITY:
        raise HTTPException(status_code=400, detail="无效的 severity")
    if source and source not in ALLOWED_SOURCE:
        raise HTTPException(status_code=400, detail="无效的 source")

    try:
        data = get_node_examples(
            practice_history,
            node_id=node_id,
            limit=limit,
            severity=severity,
            source=source,
            since=since,
            until=until,
            folder_id=folder_id,
            texts_storage=texts_storage,
        )
        return APIResponse(
            success=True,
            data=data,
            message="错误样例获取成功",
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"获取错误样例失败: {str(exc)}")
