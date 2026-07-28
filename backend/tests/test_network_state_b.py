"""Runnable regression checks for whole-memo State B search.
`python tests/test_network_state_b.py`
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.features.network import search


def run_checks() -> None:
    calls: dict[str, object] = {}
    originals = {
        "encode_texts": search.encode_texts,
        "fetch_cached_embedding": search.fetch_cached_embedding,
        "search_similar_inbox_embeddings": search.search_similar_inbox_embeddings,
        "search_similar_topic_memos": search.search_similar_topic_memos,
        "upsert_cached_embedding": search.upsert_cached_embedding,
    }
    search.fetch_cached_embedding = lambda _user_id, _query_hash: None
    search.encode_texts = lambda texts: calls.setdefault("encoded", texts) and [[1.0, 0.0]]
    search.upsert_cached_embedding = lambda *_args: None

    def search_memos(user_id, _embedding, exclude_memo_id, limit):
        calls["memo_search"] = (user_id, exclude_memo_id, limit)
        return [
            {
                "memo_id": "memo-2",
                "memo_content": "관련 메모 제목\n대표 내용",
                "memo_created_at": "2026-07-01T00:00:00+00:00",
                "memo_updated_at": "2026-07-02T00:00:00+00:00",
                "similarity": 0.82,
            }
        ]

    def search_inbox(user_id, _embedding, limit):
        calls["inbox_search"] = (user_id, limit)
        return [
            {
                "chunk_id": "inbox-vector-1",
                "chunk_text": "관련 링크 요약",
                "inbox_session_id": "inbox-1",
                "similarity": 0.73,
                "title": "관련 링크",
            }
        ]

    search.search_similar_topic_memos = search_memos
    search.search_similar_inbox_embeddings = search_inbox

    try:
        response = search.search_state_b(
            search.NetworkSearchRequest(
                query_text=" 현재 메모 제목\n\n현재 메모 전체 내용 ",
                user_id="user-1",
                memo_id="memo-1",
                limit=8,
                minimum_similarity=0.7,
            )
        )

        assert calls["encoded"] == ["현재 메모 제목 현재 메모 전체 내용"]
        assert calls["memo_search"] == ("user-1", "memo-1", 8)
        assert calls["inbox_search"] == ("user-1", 8)
        assert [item.source_kind for item in response.results] == ["memo", "inbox"]
        assert response.results[0].chunk_id == "memo-2"
        assert response.results[0].chunk_text == "관련 메모 제목"
        assert response.query_chunk is not None
        assert response.query_chunk.text == "현재 메모 제목 현재 메모 전체 내용"
    finally:
        for name, value in originals.items():
            setattr(search, name, value)

    print("test_network_state_b: all checks passed")


if __name__ == "__main__":
    run_checks()
