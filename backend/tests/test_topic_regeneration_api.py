import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.dependencies.auth import require_user_id
from app.api.routes import topics
from app.features.topics.discovery import TopicDiscoveryResponse
from app.main import app


def test_full_regeneration_is_authenticated_and_user_scoped() -> None:
    captured = {}
    original_run = topics.run_topic_discovery

    def fake_run(request):
        captured["request"] = request
        return TopicDiscoveryResponse(
            status="ok",
            user_id=request.user_id,
            memo_count=0,
            cluster_count=0,
            model="test-model",
            clustering_method="leiden",
            clusters=[],
        )

    topics.run_topic_discovery = fake_run
    app.dependency_overrides[require_user_id] = lambda: "authenticated-user"
    try:
        response = TestClient(app).post(
            "/topic-discovery/regenerate",
            json={"user_id": "attacker-controlled-user"},
        )
    finally:
        app.dependency_overrides.clear()
        topics.run_topic_discovery = original_run

    assert response.status_code == 200
    request = captured["request"]
    assert request.user_id == "authenticated-user"
    assert request.force is True
    assert request.persist is True
    assert request.preserve_existing_identity is False


def test_full_regeneration_rejects_missing_bearer_token() -> None:
    response = TestClient(app).post("/topic-discovery/regenerate")
    assert response.status_code == 401
