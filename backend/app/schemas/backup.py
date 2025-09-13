"""统一备份/恢复的Schema"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from app.schemas.text import PracticeHistoryRecord


class SnapshotFolder(BaseModel):
    id: str
    name: str
    parent_id: Optional[str] = None
    created_at: Optional[str] = None


class SnapshotText(BaseModel):
    id: str
    title: str
    content: str
    word_count: int
    created_at: str
    practice_type: Optional[str] = None
    source: Optional[str] = None
    folder_id: Optional[str] = None


class SnapshotAnalysis(BaseModel):
    text_id: str
    translation: str
    difficult_words: List[Dict[str, Any]] = Field(default_factory=list)
    difficulty: int = 3
    key_points: List[str] = Field(default_factory=list)
    word_count: int = 0


class SnapshotPracticeHistoryRecord(PracticeHistoryRecord):
    # 在快照中，历史记录允许包含 text_id 以建立关联
    text_id: Optional[str] = None


class BackupSnapshot(BaseModel):
    version: str = Field(default="2.0", description="快照版本")
    exported_at: str = Field(..., description="导出时间ISO格式")
    stats: Dict[str, int] = Field(default_factory=dict)
    folders: Dict[str, SnapshotFolder] = Field(default_factory=dict)
    texts: Dict[str, SnapshotText] = Field(default_factory=dict)
    analyses: Dict[str, SnapshotAnalysis] = Field(default_factory=dict)
    practice_history: List[SnapshotPracticeHistoryRecord] = Field(default_factory=list)


class BackupImportOptions(BaseModel):
    mode: str = Field(default="merge", description="merge 或 replace")
    dry_run: bool = Field(default=False)

