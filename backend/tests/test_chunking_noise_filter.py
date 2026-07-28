"""Runnable check for the meaningless-chunk filter.
`python tests/test_chunking_noise_filter.py`

구분선/빈 체크박스처럼 글자·숫자가 없는 조각은 임베딩해도 의미 없는 벡터가
되어 검색 결과에 무작위로 섞인다. 반대로 '리팩토링'처럼 짧지만 의미 있는
조각은 반드시 살아남아야 한다 — 길이 기준으로 거르면 안 되는 이유다.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.features.memo.chunking import (
    build_network_chunks,
    is_meaningful_chunk,
    split_sentences,
)


def chunks_of(text: str) -> list[str]:
    return [chunk.text for chunk in build_network_chunks(split_sentences(text), text)]


def run_checks() -> None:
    # 판정 함수 자체
    for noise in ["─────────", "---", "***", "- [ ]", "| --- | --- |", "   ", "..."]:
        assert not is_meaningful_chunk(noise), f"노이즈로 판정돼야 함: {noise!r}"
    for real in ["리팩토링", "각 기능:", "TODO", "2026", "회의", "- B: 굵게"]:
        assert is_meaningful_chunk(real), f"의미 있음으로 판정돼야 함: {real!r}"

    # 구분선이 섞인 메모: 구분선만 빠지고 본문은 남는다.
    text = "부산 여행 계획\n─────────────\n자갈치 회 먹기"
    result = chunks_of(text)
    assert not any("───" in chunk for chunk in result), f"구분선이 남았다: {result}"
    assert any("부산 여행 계획" in chunk for chunk in result), result
    assert any("자갈치" in chunk for chunk in result), result

    # 짧아도 의미 있으면 살아남는다 (길이 기준 필터였다면 사라졌을 것).
    assert chunks_of("리팩토링") == ["리팩토링"]

    # 노이즈만 있는 메모는 청크가 하나도 안 나온다.
    assert chunks_of("─────\n---\n***") == []

    # 청크 index는 노이즈를 건너뛰어도 연속이어야 한다 (memo_chunks의 chunk_index).
    indexed = build_network_chunks(split_sentences(text), text)
    assert [chunk.index for chunk in indexed] == list(range(len(indexed))), [
        chunk.index for chunk in indexed
    ]

    print(f"OK — 노이즈 필터 정상 ({len(indexed)}개 청크)")


if __name__ == "__main__":
    run_checks()
