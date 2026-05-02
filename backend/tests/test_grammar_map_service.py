from datetime import datetime
from typing import Any

from app.schemas.grammar_map import GrammarMapNode
from app.schemas.text import PracticeHistoryRecord
from app.services.grammar_map_service import build_grammar_map, get_node_examples


NOW = datetime(2026, 5, 2, 12, 0, 0)


def make_correction(
    category: str,
    severity: str = "major",
    source: str = "L1_transfer",
    original: str = "a mistake",
) -> dict[str, str]:
    return {
        "original": original,
        "suggestion": "the correction",
        "reason": "测试原因",
        "category": category,
        "severity": severity,
        "source": source,
    }


def make_record(
    record_id: str,
    timestamp: str,
    corrections: list[dict[str, Any]],
    title: str = "Article Practice",
    user_input: str = "This is a mistake in the sentence.",
) -> PracticeHistoryRecord:
    return PracticeHistoryRecord(
        id=record_id,
        timestamp=timestamp,
        text_title=title,
        text_content="This is the source sentence.",
        chinese_translation="这是原句。",
        user_input=user_input,
        ai_evaluation={
            "score": 80,
            "corrections": corrections,
            "overall_feedback": "测试反馈",
            "is_acceptable": False,
        },
        score=80,
    )


def flatten_tree(node: GrammarMapNode) -> dict[str, GrammarMapNode]:
    nodes = {node.id: node}
    for child in node.children:
        nodes.update(flatten_tree(child))
    return nodes


def test_empty_history_returns_unseen_tree():
    response = build_grammar_map([], now=NOW)
    nodes = flatten_tree(response.tree)

    assert response.total_practices == 0
    assert response.total_errors == 0
    assert all(node.stats.error_count == 0 for node in nodes.values())
    assert all(node.stats.mastery == "unseen" for node in nodes.values())


def test_single_correction_propagates_to_root():
    history = [
        make_record(
            "r1",
            "2026-05-01T12:00:00",
            [make_correction("grammar.article")],
        )
    ]
    nodes = flatten_tree(build_grammar_map(history, now=NOW).tree)

    assert nodes["grammar.article"].stats.error_count == 1
    assert nodes["grammar.morphology"].stats.error_count == 1
    assert nodes["grammar"].stats.error_count == 1
    assert nodes["root"].stats.error_count == 1
    assert nodes["lexis"].stats.error_count == 0


def test_severity_distribution():
    history = [
        make_record(
            "r1",
            "2026-05-01T12:00:00",
            [
                make_correction("grammar.article", severity="critical"),
                make_correction("grammar.article", severity="minor"),
            ],
        )
    ]

    node = flatten_tree(build_grammar_map(history, now=NOW).tree)["grammar.article"]

    assert node.stats.error_count == 2
    assert node.stats.by_severity["critical"] == 1
    assert node.stats.by_severity["minor"] == 1
    assert node.stats.by_severity["major"] == 0


def test_trend_window():
    history = [
        make_record(
            "r1",
            "2026-04-24T12:00:00",
            [make_correction("grammar.article")],
        )
    ]

    node = flatten_tree(build_grammar_map(history, now=NOW).tree)["grammar.article"]

    assert node.stats.trend_7d == 0
    assert node.stats.trend_30d == 1


def test_mastery_thresholds():
    five_errors = make_record(
        "r1",
        "2026-05-01T12:00:00",
        [make_correction("grammar.article", severity="minor") for _ in range(5)],
    )
    two_critical = make_record(
        "r2",
        "2026-05-01T12:00:00",
        [make_correction("grammar.number", severity="critical") for _ in range(2)],
    )
    three_minor = make_record(
        "r3",
        "2026-04-20T12:00:00",
        [make_correction("grammar.agreement", severity="minor") for _ in range(3)],
    )

    nodes = flatten_tree(build_grammar_map([five_errors, two_critical, three_minor], now=NOW).tree)

    assert nodes["grammar.article"].stats.mastery == "weak"
    assert nodes["grammar.number"].stats.mastery == "weak"
    assert nodes["grammar.agreement"].stats.mastery == "warning"


def test_node_examples_pagination_and_filter():
    history = [
        make_record(
            "recent",
            "2026-05-01T12:00:00",
            [make_correction("grammar.article", severity="critical", original="a mistake")],
        ),
        make_record(
            "older",
            "2026-04-01T12:00:00",
            [make_correction("grammar.number", severity="minor", original="mistake")],
        ),
    ]

    all_examples = get_node_examples(history, "grammar.morphology", limit=1)
    critical_examples = get_node_examples(history, "grammar.morphology", severity="critical")

    assert all_examples.total == 2
    assert len(all_examples.examples) == 1
    assert all_examples.examples[0].history_id == "recent"
    assert critical_examples.total == 1
    assert critical_examples.examples[0].correction.severity == "critical"
    assert "a mistake" in critical_examples.examples[0].user_input_snippet
