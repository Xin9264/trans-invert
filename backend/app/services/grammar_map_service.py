"""Aggregation service for the grammar tree map."""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any

from app.data.grammar_syllabus import (
    SYLLABUS_TREE,
    SyllabusNode,
    category_to_leaf_id,
    iter_nodes,
    validate_syllabus_categories,
)
from app.routers.texts import ALLOWED_CATEGORIES, ALLOWED_SEVERITY, ALLOWED_SOURCE
from app.schemas.grammar_map import (
    ErrorExample,
    GrammarMapNode,
    GrammarMapResponse,
    NodeExamplesResponse,
    NodeStats,
)
from app.schemas.text import Correction, PracticeHistoryRecord


validate_syllabus_categories(ALLOWED_CATEGORIES)

SEVERITY_VALUES = ("critical", "major", "minor")
SOURCE_VALUES = ("L1_transfer", "overgeneralization", "intralingual", "performance_slip")


def build_grammar_map(
    history: Sequence[PracticeHistoryRecord],
    since: str | datetime | None = None,
    until: str | datetime | None = None,
    folder_id: str | None = None,
    texts_storage: Mapping[str, Mapping[str, Any]] | None = None,
    now: datetime | None = None,
) -> GrammarMapResponse:
    """Build a decorated grammar map from practice history records."""
    now_dt = _normalize_datetime(now or datetime.now())
    since_dt = _parse_datetime(since) if since else None
    until_dt = _parse_datetime(until) if until else None
    category_index = category_to_leaf_id()
    stats_map = _empty_stats_map()

    total_practices = 0
    total_errors = 0

    for record in history:
        record_dt = _parse_datetime(record.timestamp)
        if not _record_in_scope(record, record_dt, since_dt, until_dt, folder_id, texts_storage):
            continue

        total_practices += 1
        for correction in _iter_correction_dicts(record):
            category = correction.get("category")
            leaf_id = category_index.get(category)
            if not leaf_id:
                continue

            severity = _clean_dimension(correction.get("severity"), ALLOWED_SEVERITY, "minor")
            source = _clean_dimension(correction.get("source"), ALLOWED_SOURCE, "intralingual")
            stat = stats_map[leaf_id]
            stat.error_count += 1
            stat.by_severity[severity] = stat.by_severity.get(severity, 0) + 1
            stat.by_source[source] = stat.by_source.get(source, 0) + 1
            stat.last_error_at = _latest_timestamp(stat.last_error_at, record.timestamp)

            if record_dt and _within_days(record_dt, now_dt, 7):
                stat.trend_7d += 1
            if record_dt and _within_days(record_dt, now_dt, 30):
                stat.trend_30d += 1
            total_errors += 1

    _rollup_stats(SYLLABUS_TREE, stats_map)
    for stat in stats_map.values():
        stat.mastery = _compute_mastery(stat)

    return GrammarMapResponse(
        generated_at=now_dt.isoformat(),
        total_practices=total_practices,
        total_errors=total_errors,
        tree=_decorate_tree(SYLLABUS_TREE, stats_map),
    )


def get_node_examples(
    history: Sequence[PracticeHistoryRecord],
    node_id: str,
    limit: int = 20,
    severity: str | None = None,
    source: str | None = None,
    since: str | datetime | None = None,
    until: str | datetime | None = None,
    folder_id: str | None = None,
    texts_storage: Mapping[str, Mapping[str, Any]] | None = None,
) -> NodeExamplesResponse:
    """Return concrete correction examples for a node and its subtree."""
    node_categories = _node_category_index().get(node_id)
    if node_categories is None:
        raise ValueError(f"Unknown grammar map node: {node_id}")

    since_dt = _parse_datetime(since) if since else None
    until_dt = _parse_datetime(until) if until else None
    examples: list[ErrorExample] = []
    for record in history:
        record_dt = _parse_datetime(record.timestamp)
        if not _record_in_scope(record, record_dt, since_dt, until_dt, folder_id, texts_storage):
            continue

        for correction in _iter_correction_dicts(record):
            category = correction.get("category")
            if category not in node_categories:
                continue

            correction_severity = _clean_dimension(correction.get("severity"), ALLOWED_SEVERITY, "minor")
            correction_source = _clean_dimension(correction.get("source"), ALLOWED_SOURCE, "intralingual")
            if severity and correction_severity != severity:
                continue
            if source and correction_source != source:
                continue

            normalized = {
                "original": str(correction.get("original", "")),
                "suggestion": str(correction.get("suggestion", "")),
                "reason": str(correction.get("reason", "")),
                "category": str(category),
                "severity": correction_severity,
                "source": correction_source,
            }
            examples.append(
                ErrorExample(
                    history_id=record.id,
                    timestamp=record.timestamp,
                    text_title=record.text_title,
                    correction=Correction(**normalized),
                    user_input_snippet=_build_snippet(
                        record.user_input,
                        normalized["original"],
                    ),
                )
            )

    examples.sort(key=lambda item: _parse_datetime(item.timestamp) or datetime.min, reverse=True)
    total = len(examples)
    safe_limit = max(0, limit)
    return NodeExamplesResponse(
        node_id=node_id,
        total=total,
        examples=examples[:safe_limit],
    )


def _empty_stats_map() -> dict[str, NodeStats]:
    return {
        node["id"]: NodeStats(
            node_id=node["id"],
            by_severity={severity: 0 for severity in SEVERITY_VALUES},
            by_source={source: 0 for source in SOURCE_VALUES},
        )
        for node in iter_nodes()
    }


def _iter_correction_dicts(record: PracticeHistoryRecord) -> list[dict[str, Any]]:
    evaluation = record.ai_evaluation
    if not isinstance(evaluation, dict):
        return []
    corrections = evaluation.get("corrections", [])
    if not isinstance(corrections, list):
        return []
    return [item for item in corrections if isinstance(item, dict)]


def _rollup_stats(node: SyllabusNode, stats_map: dict[str, NodeStats]) -> NodeStats:
    stat = stats_map[node["id"]]
    for child in node.get("children", []):
        child_stat = _rollup_stats(child, stats_map)
        stat.error_count += child_stat.error_count
        stat.trend_7d += child_stat.trend_7d
        stat.trend_30d += child_stat.trend_30d
        stat.last_error_at = _latest_timestamp(stat.last_error_at, child_stat.last_error_at)
        for severity, count in child_stat.by_severity.items():
            stat.by_severity[severity] = stat.by_severity.get(severity, 0) + count
        for source, count in child_stat.by_source.items():
            stat.by_source[source] = stat.by_source.get(source, 0) + count
    return stat


def _decorate_tree(node: SyllabusNode, stats_map: dict[str, NodeStats]) -> GrammarMapNode:
    return GrammarMapNode(
        id=node["id"],
        label=node["label"],
        tip=node.get("tip"),
        leaf_categories=node.get("leaf_categories"),
        children=[_decorate_tree(child, stats_map) for child in node.get("children", [])],
        stats=stats_map[node["id"]],
    )


def _compute_mastery(stat: NodeStats) -> str:
    if (
        stat.error_count >= 5
        or stat.by_severity.get("critical", 0) >= 2
        or stat.trend_7d >= 3
    ):
        return "weak"
    if 1 <= stat.error_count < 5:
        return "warning"
    return "unseen"


def _node_category_index() -> dict[str, set[str]]:
    def collect(node: SyllabusNode, index: dict[str, set[str]]) -> set[str]:
        categories = set(node.get("leaf_categories", []))
        for child in node.get("children", []):
            categories.update(collect(child, index))
        index[node["id"]] = categories
        return categories

    result: dict[str, set[str]] = {}
    collect(SYLLABUS_TREE, result)
    return result


def _record_in_scope(
    record: PracticeHistoryRecord,
    record_dt: datetime | None,
    since_dt: datetime | None,
    until_dt: datetime | None,
    folder_id: str | None,
    texts_storage: Mapping[str, Mapping[str, Any]] | None,
) -> bool:
    if since_dt and (not record_dt or record_dt < since_dt):
        return False
    if until_dt and (not record_dt or record_dt > until_dt):
        return False
    if folder_id and not _record_matches_folder(record, folder_id, texts_storage):
        return False
    return True


def _record_matches_folder(
    record: PracticeHistoryRecord,
    folder_id: str,
    texts_storage: Mapping[str, Mapping[str, Any]] | None,
) -> bool:
    if not texts_storage:
        return False

    for text_info in texts_storage.values():
        if text_info.get("folder_id") != folder_id:
            continue
        title = str(text_info.get("title") or "")
        content = str(text_info.get("content") or "")
        title_matches = record.text_title == title or record.text_title.startswith(f"{title}（")
        content_matches = not content or record.text_content == content or record.text_content in content
        if title_matches and content_matches:
            return True
    return False


def _clean_dimension(value: Any, allowed: set[str], fallback: str) -> str:
    text = str(value or fallback)
    return text if text in allowed else fallback


def _parse_datetime(value: str | datetime | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return _normalize_datetime(value)
    try:
        return _normalize_datetime(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        return None


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _latest_timestamp(left: str | None, right: str | None) -> str | None:
    if not left:
        return right
    if not right:
        return left
    left_dt = _parse_datetime(left)
    right_dt = _parse_datetime(right)
    if not left_dt:
        return right
    if not right_dt:
        return left
    return right if right_dt > left_dt else left


def _within_days(record_dt: datetime, now_dt: datetime, days: int) -> bool:
    delta = now_dt - record_dt
    return 0 <= delta.total_seconds() <= days * 24 * 60 * 60


def _build_snippet(user_input: str, original: str, context: int = 50) -> str:
    if not user_input:
        return ""
    if not original:
        return _truncate(user_input, context * 2)

    index = user_input.find(original)
    if index < 0:
        return _truncate(user_input, context * 2)

    start = max(0, index - context)
    end = min(len(user_input), index + len(original) + context)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(user_input) else ""
    return f"{prefix}{user_input[start:end]}{suffix}"


def _truncate(value: str, limit: int) -> str:
    return value if len(value) <= limit else f"{value[:limit]}..."
