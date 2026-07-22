"""Runnable check for line-block network chunking.
`python tests/test_chunking_line_blocks.py`

Line breaks are block boundaries (Obsidian-style): sentences written on the
same line group up to CHUNK_MAX_SENTENCES/CHUNK_TARGET_CHARS, but chunks never
span or merge across lines.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.features.memo.chunking import build_network_chunks, split_sentences


def run_checks() -> None:
    # Same line → sentences group into one chunk.
    same_line = "국밥집은 아침에 간다. 밀면은 점심에 먹는다. 회는 저녁에 먹는다."
    chunks = build_network_chunks(split_sentences(same_line), same_line)
    assert len(chunks) == 1, chunks
    assert chunks[0].text.count("\n") == 2

    # Separate lines → one chunk per line, even when each line is short.
    per_line = "부산 여행 준비물 목록\n국밥집은 아침에 간다. 밀면은 점심에 먹는다.\n지도 앱 미리 받아두기"
    chunks = build_network_chunks(split_sentences(per_line), per_line)
    assert [chunk.text for chunk in chunks] == [
        "부산 여행 준비물 목록",
        "국밥집은 아침에 간다.\n밀면은 점심에 먹는다.",
        "지도 앱 미리 받아두기",
    ], chunks

    # Short lines must not merge into the previous line's chunk.
    short_lines = "오늘 한 일 정리해 보면 생각보다 많이 했다.\n우유 사기"
    chunks = build_network_chunks(split_sentences(short_lines), short_lines)
    assert len(chunks) == 2, chunks
    assert chunks[1].text == "우유 사기"

    # Without source text (legacy callers) grouping is length-based as before.
    chunks = build_network_chunks(split_sentences(per_line))
    assert len(chunks) == 1, chunks

    print("test_chunking_line_blocks: all checks passed")


if __name__ == "__main__":
    run_checks()
