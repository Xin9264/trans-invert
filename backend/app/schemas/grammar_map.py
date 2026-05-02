"""Schemas for grammar tree map responses."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.text import Correction


MasteryLevel = Literal["unseen", "weak", "warning", "stable"]


class NodeStats(BaseModel):
    """Aggregated mastery statistics for one syllabus node."""

    node_id: str
    error_count: int = 0
    by_severity: dict[str, int] = Field(default_factory=dict)
    by_source: dict[str, int] = Field(default_factory=dict)
    last_error_at: str | None = None
    trend_7d: int = 0
    trend_30d: int = 0
    mastery: MasteryLevel = "unseen"


class GrammarMapNode(BaseModel):
    """A decorated syllabus node returned to the frontend."""

    id: str
    label: str
    tip: str | None = None
    leaf_categories: list[str] | None = None
    children: list["GrammarMapNode"] = Field(default_factory=list)
    stats: NodeStats


class GrammarMapResponse(BaseModel):
    """Full grammar map response."""

    generated_at: str
    total_practices: int
    total_errors: int
    tree: GrammarMapNode


class ErrorExample(BaseModel):
    """One concrete correction attached to a history record."""

    history_id: str
    timestamp: str
    text_title: str
    correction: Correction
    user_input_snippet: str


class NodeExamplesResponse(BaseModel):
    """Examples for one selected grammar map node."""

    node_id: str
    total: int
    examples: list[ErrorExample] = Field(default_factory=list)
