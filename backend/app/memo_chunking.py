from functools import lru_cache
from typing import Any

from kiwipiepy import Kiwi
from pydantic import BaseModel, Field

from app import constants
from app.topic_discovery import encode_texts


class MemoChunkRequest(BaseModel):
    text: str
    cursor_index: int | None = None
    include_embeddings: bool = False


class MemoChunk(BaseModel):
    id: str
    index: int
    text: str
    start: int
    end: int
    sentence_indices: list[int] = Field(default_factory=list)


class MemoChunkResponse(BaseModel):
    sentence_chunks: list[MemoChunk]
    network_chunks: list[MemoChunk]
    cursor_sentence_chunk: MemoChunk | None = None
    cursor_network_chunk: MemoChunk | None = None
    embeddings: list[list[float]] | None = None
    embedding_model: str | None = None


@lru_cache
def get_kiwi() -> Kiwi:
    return Kiwi()


def split_memo_chunks(request: MemoChunkRequest) -> MemoChunkResponse:
    sentence_chunks = split_sentences(request.text)
    network_chunks = build_network_chunks(sentence_chunks)
    cursor_sentence_chunk = find_chunk_at_cursor(sentence_chunks, request.cursor_index)
    cursor_network_chunk = find_chunk_at_cursor(network_chunks, request.cursor_index)
    embeddings = None

    if request.include_embeddings and network_chunks:
        vectors = encode_texts([chunk.text for chunk in network_chunks])
        embeddings = [[float(value) for value in row] for row in vectors]

    return MemoChunkResponse(
        sentence_chunks=sentence_chunks,
        network_chunks=network_chunks,
        cursor_sentence_chunk=cursor_sentence_chunk,
        cursor_network_chunk=cursor_network_chunk,
        embeddings=embeddings,
        embedding_model=constants.EMBEDDING_MODEL if embeddings is not None else None,
    )


def split_sentences(text: str) -> list[MemoChunk]:
    kiwi = get_kiwi()
    sentences: list[MemoChunk] = []

    raw_sentences: Any = kiwi.split_into_sents(text)

    for sentence in raw_sentences:
        start = int(sentence.start)
        end = int(sentence.end)
        sentence_text = text[start:end].strip()

        if not sentence_text:
            continue

        index = len(sentences)
        sentences.append(
            MemoChunk(
                id=build_chunk_id("sentence", index, start, end),
                index=index,
                text=sentence_text,
                start=start,
                end=end,
                sentence_indices=[index],
            )
        )

    return sentences


def build_network_chunks(sentence_chunks: list[MemoChunk]) -> list[MemoChunk]:
    chunks: list[MemoChunk] = []
    pending: list[MemoChunk] = []

    for sentence in sentence_chunks:
        pending.append(sentence)
        if should_flush_network_chunk(pending):
            append_network_chunk(chunks, pending)
            pending = []

    if pending:
        append_network_chunk(chunks, pending)

    return chunks


def should_flush_network_chunk(sentences: list[MemoChunk]) -> bool:
    text_length = sum(len(sentence.text) for sentence in sentences)

    return (
        len(sentences) >= constants.CHUNK_MAX_SENTENCES
        or text_length >= constants.CHUNK_TARGET_CHARS
    )


def append_network_chunk(chunks: list[MemoChunk], sentences: list[MemoChunk]) -> None:
    if not sentences:
        return

    start = sentences[0].start
    end = sentences[-1].end
    text = "\n".join(sentence.text for sentence in sentences).strip()

    if len(text) < constants.CHUNK_MIN_CHARS and chunks:
        previous = chunks[-1]
        merged_text = f"{previous.text}\n{text}".strip()
        chunks[-1] = previous.model_copy(
            update={
                "text": merged_text,
                "end": end,
                "sentence_indices": previous.sentence_indices
                + [index for sentence in sentences for index in sentence.sentence_indices],
            }
        )
        return

    index = len(chunks)
    chunks.append(
        MemoChunk(
            id=build_chunk_id("network", index, start, end),
            index=index,
            text=text,
            start=start,
            end=end,
            sentence_indices=[
                index for sentence in sentences for index in sentence.sentence_indices
            ],
        )
    )


def find_chunk_at_cursor(
    chunks: list[MemoChunk],
    cursor_index: int | None,
) -> MemoChunk | None:
    if not chunks or cursor_index is None:
        return None

    cursor = max(0, cursor_index)
    containing_chunk = next(
        (chunk for chunk in chunks if chunk.start <= cursor <= chunk.end),
        None,
    )

    if containing_chunk:
        return containing_chunk

    return min(chunks, key=lambda chunk: distance_to_chunk(cursor, chunk))


def distance_to_chunk(cursor_index: int, chunk: MemoChunk) -> int:
    if chunk.start <= cursor_index <= chunk.end:
        return 0

    return min(abs(cursor_index - chunk.start), abs(cursor_index - chunk.end))


def build_chunk_id(prefix: str, index: int, start: int, end: int) -> str:
    return f"{prefix}-{index}-{start}-{end}"
