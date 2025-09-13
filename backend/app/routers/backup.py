"""统一备份与恢复路由"""
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.schemas.backup import BackupSnapshot, BackupImportOptions
from app.schemas.text import APIResponse
from app.services.backup_service import backup_service


router = APIRouter(prefix="/api/backup", tags=["backup"])


@router.get("/export")
async def export_backup():
    """导出全量快照（folders, texts, analyses, practice_history）。"""
    try:
        snapshot = backup_service.export_snapshot()
        content = snapshot.model_dump_json(indent=2)
        filename = f"backup_{snapshot.version}_{snapshot.exported_at.replace(':', '').replace('-', '')}.json"
        return Response(
            content=content,
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/json; charset=utf-8",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")


@router.post("/import", response_model=APIResponse)
async def import_backup(
    snapshot: BackupSnapshot,
    mode: str = Query(default="merge", pattern="^(merge|replace)$"),
    dry_run: bool = Query(default=False),
):
    """导入全量快照。支持 dry_run 进行合并预览。"""
    try:
        options = BackupImportOptions(mode=mode, dry_run=dry_run)
        result = backup_service.import_snapshot(snapshot, options)
        return APIResponse(success=True, data=result, message="导入完成" if not dry_run else "预览完成")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
