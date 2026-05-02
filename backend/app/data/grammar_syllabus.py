"""Static grammar syllabus tree for the grammar map feature."""
from __future__ import annotations

from collections import Counter
from typing import Iterable, Iterator, TypedDict


class SyllabusNode(TypedDict, total=False):
    """Static syllabus node.

    A node is either a branch with children or a leaf with leaf_categories.
    """

    id: str
    label: str
    tip: str
    children: list["SyllabusNode"]
    leaf_categories: list[str]


SYLLABUS_TREE: SyllabusNode = {
    "id": "root",
    "label": "English Grammar",
    "children": [
        {
            "id": "grammar",
            "label": "语法",
            "children": [
                {
                    "id": "grammar.morphology",
                    "label": "形态",
                    "children": [
                        {
                            "id": "grammar.article",
                            "label": "冠词",
                            "leaf_categories": ["grammar.article"],
                            "tip": "中文无冠词，最易遗漏 a/an/the",
                        },
                        {
                            "id": "grammar.number",
                            "label": "单复数",
                            "leaf_categories": ["grammar.number"],
                        },
                        {
                            "id": "grammar.agreement",
                            "label": "主谓一致",
                            "leaf_categories": ["grammar.agreement"],
                        },
                    ],
                },
                {
                    "id": "grammar.tense_aspect",
                    "label": "时态与体",
                    "children": [
                        {
                            "id": "grammar.tense",
                            "label": "时态",
                            "leaf_categories": ["grammar.tense"],
                        },
                        {
                            "id": "grammar.aspect",
                            "label": "体（进行/完成）",
                            "leaf_categories": ["grammar.aspect"],
                        },
                    ],
                },
                {
                    "id": "grammar.syntax",
                    "label": "句法",
                    "children": [
                        {
                            "id": "grammar.voice",
                            "label": "语态",
                            "leaf_categories": ["grammar.voice"],
                        },
                        {
                            "id": "grammar.mood",
                            "label": "语气",
                            "leaf_categories": ["grammar.mood"],
                        },
                        {
                            "id": "grammar.preposition",
                            "label": "介词",
                            "leaf_categories": ["grammar.preposition"],
                        },
                        {
                            "id": "grammar.conjunction",
                            "label": "连词与从句",
                            "leaf_categories": ["grammar.conjunction"],
                        },
                        {
                            "id": "grammar.word_order",
                            "label": "语序",
                            "leaf_categories": ["grammar.word_order"],
                        },
                        {
                            "id": "grammar.nonfinite",
                            "label": "非谓语动词",
                            "leaf_categories": ["grammar.nonfinite"],
                        },
                    ],
                },
                {
                    "id": "grammar.other",
                    "label": "其他语法",
                    "leaf_categories": ["grammar.other"],
                },
            ],
        },
        {
            "id": "lexis",
            "label": "词汇",
            "children": [
                {
                    "id": "lexis.word_choice",
                    "label": "选词",
                    "leaf_categories": ["lexis.word_choice"],
                },
                {
                    "id": "lexis.collocation",
                    "label": "搭配",
                    "leaf_categories": ["lexis.collocation"],
                },
                {
                    "id": "lexis.register",
                    "label": "语域",
                    "leaf_categories": ["lexis.register"],
                },
                {
                    "id": "lexis.semantic_prosody",
                    "label": "语义韵",
                    "leaf_categories": ["lexis.semantic_prosody"],
                },
                {
                    "id": "lexis.derivation",
                    "label": "构词",
                    "leaf_categories": ["lexis.derivation"],
                },
            ],
        },
        {
            "id": "discourse",
            "label": "篇章",
            "children": [
                {
                    "id": "discourse.cohesion",
                    "label": "衔接",
                    "leaf_categories": ["discourse.cohesion"],
                },
                {
                    "id": "discourse.information_structure",
                    "label": "信息结构",
                    "leaf_categories": ["discourse.information_structure"],
                },
                {
                    "id": "discourse.reference",
                    "label": "指代照应",
                    "leaf_categories": ["discourse.reference"],
                },
            ],
        },
        {
            "id": "mechanics",
            "label": "书写规范",
            "children": [
                {
                    "id": "mechanics.spelling",
                    "label": "拼写",
                    "leaf_categories": ["mechanics.spelling"],
                },
                {
                    "id": "mechanics.punctuation",
                    "label": "标点",
                    "leaf_categories": ["mechanics.punctuation"],
                },
                {
                    "id": "mechanics.capitalization",
                    "label": "大小写",
                    "leaf_categories": ["mechanics.capitalization"],
                },
            ],
        },
    ],
}


def iter_nodes(node: SyllabusNode = SYLLABUS_TREE) -> Iterator[SyllabusNode]:
    """Yield every node in preorder."""
    yield node
    for child in node.get("children", []):
        yield from iter_nodes(child)


def iter_leaves(node: SyllabusNode = SYLLABUS_TREE) -> Iterator[SyllabusNode]:
    """Yield leaf nodes that carry category mappings."""
    children = node.get("children", [])
    if not children:
        yield node
        return

    for child in children:
        yield from iter_leaves(child)


def category_to_leaf_id() -> dict[str, str]:
    """Build a reverse index from correction category to syllabus leaf id."""
    mapping: dict[str, str] = {}
    for leaf in iter_leaves():
        for category in leaf.get("leaf_categories", []):
            mapping[category] = leaf["id"]
    return mapping


def validate_syllabus_categories(allowed_categories: Iterable[str]) -> None:
    """Ensure each allowed correction category maps to exactly one leaf node."""
    allowed = set(allowed_categories)
    seen: list[str] = []
    missing_leaf_categories: list[str] = []

    for leaf in iter_leaves():
        categories = leaf.get("leaf_categories", [])
        if not categories:
            missing_leaf_categories.append(leaf["id"])
        seen.extend(categories)

    counts = Counter(seen)
    duplicates = sorted(category for category, count in counts.items() if count > 1)
    unknown = sorted(set(seen) - allowed)
    missing = sorted(allowed - set(seen))

    if missing_leaf_categories or duplicates or unknown or missing:
        problems = []
        if missing_leaf_categories:
            problems.append(f"leaf nodes without leaf_categories: {missing_leaf_categories}")
        if duplicates:
            problems.append(f"duplicated categories: {duplicates}")
        if unknown:
            problems.append(f"unknown categories: {unknown}")
        if missing:
            problems.append(f"missing categories: {missing}")
        raise ValueError("Invalid grammar syllabus: " + "; ".join(problems))
