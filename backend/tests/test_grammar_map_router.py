from fastapi.testclient import TestClient

from app.main import app
from app.routers import grammar_map
from app.schemas.text import PracticeHistoryRecord


client = TestClient(app)


def make_record() -> PracticeHistoryRecord:
    return PracticeHistoryRecord(
        id="history-1",
        timestamp="2026-05-01T12:00:00",
        text_title="Article Practice",
        text_content="Source sentence.",
        chinese_translation="原句。",
        user_input="This is a mistake.",
        ai_evaluation={
            "score": 80,
            "corrections": [
                {
                    "original": "mistake",
                    "suggestion": "correction",
                    "reason": "测试原因",
                    "category": "grammar.article",
                    "severity": "major",
                    "source": "L1_transfer",
                }
            ],
            "overall_feedback": "测试反馈",
            "is_acceptable": False,
        },
        score=80,
    )


def test_get_grammar_map_route(monkeypatch):
    monkeypatch.setattr(grammar_map, "practice_history", [make_record()])
    monkeypatch.setattr(grammar_map, "texts_storage", {})

    response = client.get("/api/grammar-map")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["total_practices"] == 1
    assert payload["data"]["total_errors"] == 1
    assert payload["data"]["tree"]["id"] == "root"


def test_get_node_examples_route(monkeypatch):
    monkeypatch.setattr(grammar_map, "practice_history", [make_record()])

    response = client.get("/api/grammar-map/nodes/grammar.article/examples?severity=major")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["total"] == 1
    assert payload["data"]["examples"][0]["history_id"] == "history-1"


def test_get_node_examples_rejects_invalid_severity():
    response = client.get("/api/grammar-map/nodes/grammar.article/examples?severity=bad")

    assert response.status_code == 400
