from functools import lru_cache
import re
from typing import Any

from kiwipiepy import Kiwi
from pydantic import BaseModel, Field

from app.core import constants
from app.features.topics.discovery import encode_texts


class MemoChunkRequest(BaseModel):
    text: str = Field(max_length=constants.MEMO_CHUNK_SPLIT_MAX_CHARS)
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


ABBREVIATIONS = {
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "etc", "eg", "ie", "ca",
    "co", "corp", "inc", "ltd", "st", "ave", "rd", "jan", "feb", "mar", "apr",
    "jun", "jul", "aug", "sep", "oct", "nov", "dec", "vol", "ed", "pp", "al"
}

LINK_RE = re.compile(r'\[(.*?)\]\((.*?)\)')
IMAGE_RE = re.compile(r'!\[(.*?)\]\((.*?)\)')
STRONG_RE = re.compile(r'\*\*(.*?)\*\*|__(.*?)__')
EM_RE = re.compile(r'\*(.*?)\*|_(.*?)_')
STRIKE_RE = re.compile(r'~~(.*?)~~')
SPOILER_RE = re.compile(r'\|\|(.*?)\|\|')
INLINE_CODE_RE = re.compile(r'`(.*?)`')
CODE_BLOCK_RE = re.compile(r'```[a-zA-Z]*\n?(.*?)\n?```', re.DOTALL)
BLOCK_MATH_RE = re.compile(r'\$\$\n?(.*?)\n?\$\$', re.DOTALL)
INLINE_MATH_RE = re.compile(r'\$(.*?)\$')

HEADER_RE = re.compile(r'^#+\s+', re.MULTILINE)
BLOCKQUOTE_RE = re.compile(r'^>\s?', re.MULTILINE)
LIST_RE = re.compile(r'^\s*([-*+]|(?:\d+\.))\s+', re.MULTILINE)
TASK_LIST_RE = re.compile(r'^\[([ xX])\]\s*', re.MULTILINE)

def clean_enriched_markdown(text: str) -> str:
    # 1. Clean block prefixes
    text = HEADER_RE.sub("", text)
    text = BLOCKQUOTE_RE.sub("", text)
    text = LIST_RE.sub("", text)
    text = TASK_LIST_RE.sub("", text)
    
    # 2. Clean inline markdown links, images, math, bold, italic, strikethrough, spoiler, code
    # CODE_BLOCK_RE and BLOCK_MATH_RE must run before their inline counterparts.
    text = CODE_BLOCK_RE.sub(r'\1', text)
    text = BLOCK_MATH_RE.sub(r'\1', text)
    text = IMAGE_RE.sub(r'\1', text)
    text = LINK_RE.sub(r'\1', text)
    text = STRONG_RE.sub(lambda m: m.group(1) or m.group(2) or '', text)
    text = EM_RE.sub(lambda m: m.group(1) or m.group(2) or '', text)
    text = STRIKE_RE.sub(r'\1', text)
    text = SPOILER_RE.sub(r'\1', text)
    text = INLINE_CODE_RE.sub(r'\1', text)
    text = INLINE_MATH_RE.sub(r'\1', text)
    
    return text.strip()

def split_english_sentences(text: str) -> list[tuple[str, int, int]]:
    # Capture the punctuation AND any trailing quotes/parentheses/markdown tags immediately following it
    candidates = list(re.finditer(r'([.!?])(["\')\]}*`~]*)(\s+|$)', text))
    sentences = []
    start = 0
    
    for match in candidates:
        punc = match.group(1)
        trailing_symbols = match.group(2)
        end = match.end()
        
        if punc == '.':
            preceding_part = text[start:match.start()]
            words = re.findall(r'\b[a-zA-Z]+\b', preceding_part)
            if words:
                last_word = words[-1].lower()
                if last_word in ABBREVIATIONS or len(last_word) == 1:
                    continue
        
        next_part = text[end:]
        next_words = re.findall(r'\S+', next_part)
        if next_words:
            first_next_char = next_words[0][0]
            if first_next_char.islower():
                continue
                
        # Split point is after the punctuation and trailing symbols
        split_end = match.end(1) + len(trailing_symbols)
        sent_text = text[start:split_end].strip()
        if sent_text:
            sentences.append((sent_text, start, split_end))
        start = match.end()
        
    last_text = text[start:].strip()
    if last_text:
        sentences.append((last_text, start, len(text)))
        
    return sentences

def split_sentences(text: str) -> list[MemoChunk]:
    kiwi = get_kiwi()
    sentences: list[MemoChunk] = []

    # 1. Segment by code blocks and math blocks to shield them from splitting
    segments: list[tuple[str, int, int, bool]] = []
    start = 0
    for match in re.finditer(r'(```.*?```|\$\$.*?\$\$)', text, re.DOTALL):
        if text[start:match.start()]:
            segments.append((text[start:match.start()], start, match.start(), False))
        segments.append((match.group(0), match.start(), match.end(), True))
        start = match.end()
    if text[start:]:
        segments.append((text[start:], start, len(text), False))

    for seg_text, seg_start, seg_end, is_code in segments:
        if is_code:
            # Code blocks are treated as a single unbroken sentence chunk
            sentence_text = clean_enriched_markdown(seg_text)
            if sentence_text:
                index = len(sentences)
                sentences.append(
                    MemoChunk(
                        id=build_chunk_id("sentence", index, seg_start, seg_end),
                        index=index,
                        text=sentence_text,
                        start=seg_start,
                        end=seg_end,
                        sentence_indices=[index],
                    )
                )
            continue

        # 2. For non-code segments, split by newlines first to preserve structural boundaries
        line_start_pos = 0
        lines: list[tuple[str, int, int]] = []
        for match in re.finditer(r'\n', seg_text):
            line_end_pos = match.start()
            line_text = seg_text[line_start_pos:line_end_pos]
            lines.append((line_text, line_start_pos, line_end_pos))
            line_start_pos = match.end()
        lines.append((seg_text[line_start_pos:], line_start_pos, len(seg_text)))

        for line_text, line_start, line_end in lines:
            if not line_text.strip():
                continue

            # 3. Run Kiwi on each line segment
            raw_sentences: Any = kiwi.split_into_sents(line_text)

            for raw_sentence in raw_sentences:
                kiwi_start = int(raw_sentence.start)
                kiwi_end = int(raw_sentence.end)
                segment_text = line_text[kiwi_start:kiwi_end]

                # 4. Refine each Kiwi segment for English/mixed sentence boundaries
                refined_sentences = split_english_sentences(segment_text)
                for sub_text, sub_start, sub_end in refined_sentences:
                    actual_start = seg_start + line_start + kiwi_start + sub_start
                    actual_end = seg_start + line_start + kiwi_start + sub_end
                    
                    # 5. Clean rich markdown syntax from the sentence text
                    sentence_text = clean_enriched_markdown(sub_text)

                    if not sentence_text:
                        continue

                    index = len(sentences)
                    sentences.append(
                        MemoChunk(
                            id=build_chunk_id("sentence", index, actual_start, actual_end),
                            index=index,
                            text=sentence_text,
                            start=actual_start,
                            end=actual_end,
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
