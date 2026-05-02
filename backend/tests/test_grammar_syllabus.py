from app.data.grammar_syllabus import iter_leaves, validate_syllabus_categories
from app.routers.texts import ALLOWED_CATEGORIES


def test_syllabus_covers_all_categories():
    validate_syllabus_categories(ALLOWED_CATEGORIES)


def test_every_leaf_has_categories():
    assert all(leaf.get("leaf_categories") for leaf in iter_leaves())
