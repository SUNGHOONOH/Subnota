"""Runnable check for cursor→indexed-chunk resolution.
`python tests/test_network_resolve_chunk.py`

Reproduces the 2026-07-06 bug: stored chunk_text joins sentences with '\n'
while the editor's cursor paragraph joins them with spaces, so the old
verbatim-containment match never resolved multi-sentence chunks and every
query fell back to the live path (echoing the whole paragraph).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.features.network import search

# Mirrors the real indexed rows for the '부산 1박' memo (sentences joined by \n).
REFS = [
    {
        "id": "chunk-a",
        "chunk_text": (
            "부산 1박 미식 여행 확장안\n"
            "자갈치 회, 밀면, 돼지국밥을 하루 안에 다 넣으면 동선이 빡빡하다.\n"
            "첫날은 광안리 숙소에 짐을 두고 해변 산책, 저녁은 회센터 대신 작은 횟집을 고른다."
        ),
        "start_index": 0,
        "end_index": 102,
    },
    {
        "id": "chunk-b",
        "chunk_text": (
            "다음날 아침에 돼지국밥을 먹고, 점심은 밀면으로 가볍게 마무리하면 일정이 덜 피곤하다.\n"
            "핵심은 맛집 개수를 늘리는 것보다 이동 시간을 줄이는 것.\n"
            "만약 이틀 뒤 해야될 것이 더 생기면 여쭤보기"
        ),
        "start_index": 103,
        "end_index": 221,
    },
]


def run_checks() -> None:
    original_fetch = search.fetch_memo_chunk_refs
    search.fetch_memo_chunk_refs = lambda _user_id, _memo_id: REFS
    try:
        # Whole editor paragraph: sentences joined with spaces, no newlines.
        paragraph = (
            "부산 1박 미식 여행 확장안 자갈치 회, 밀면, 돼지국밥을 하루 안에 다 넣으면 "
            "동선이 빡빡하다. 첫날은 광안리 숙소에 짐을 두고 해변 산책, 저녁은 회센터 대신 "
            "작은 횟집을 고른다. 다음날 아침에 돼지국밥을 먹고, 점심은 밀면으로 가볍게 "
            "마무리하면 일정이 덜 피곤하다. 핵심은 맛집 개수를 늘리는 것보다 이동 시간을 "
            "줄이는 것."
        )
        resolved = search.resolve_indexed_chunk("u", "m", None, paragraph)
        assert resolved is not None, "paragraph query must resolve to a stored chunk"

        # Cursor-sentence window near the end of the memo → second chunk.
        window = (
            "다음날 아침에 돼지국밥을 먹고, 점심은 밀면으로 가볍게 마무리하면 일정이 덜 피곤하다.\n"
            "핵심은 맛집 개수를 늘리는 것보다 이동 시간을 줄이는 것."
        )
        resolved = search.resolve_indexed_chunk("u", "m", None, window)
        assert resolved is not None and resolved["id"] == "chunk-b", (
            "sentence window must resolve to the chunk containing it"
        )

        # Window at the start → first chunk.
        window = "부산 1박 미식 여행 확장안\n자갈치 회, 밀면, 돼지국밥을 하루 안에 다 넣으면 동선이 빡빡하다."
        resolved = search.resolve_indexed_chunk("u", "m", None, window)
        assert resolved is not None and resolved["id"] == "chunk-a"

        # Character offsets still win when provided.
        resolved = search.resolve_indexed_chunk("u", "m", 150, "무관한 텍스트")
        assert resolved is not None and resolved["id"] == "chunk-b"

        # Unrelated text resolves to nothing (falls back to the live path).
        resolved = search.resolve_indexed_chunk("u", "m", None, "전혀 관련 없는 다른 주제의 글입니다.")
        assert resolved is None
    finally:
        search.fetch_memo_chunk_refs = original_fetch

    print("test_network_resolve_chunk: all checks passed")


if __name__ == "__main__":
    run_checks()
