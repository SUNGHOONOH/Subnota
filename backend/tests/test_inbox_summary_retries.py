from app.features.inbox import summary


def test_summary_client_allows_two_automatic_retries(monkeypatch) -> None:
    received = {}

    class FakeClient:
        def __init__(self, **kwargs):
            received.update(kwargs)

    monkeypatch.setattr(summary.genai, "Client", FakeClient)
    monkeypatch.setattr(summary.settings, "gemini_api_key", "test-key")

    summary._create_genai_client()

    options = received["http_options"].retry_options
    assert options.attempts == 3  # One initial call plus two retries.
