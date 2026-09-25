from functools import lru_cache
import re
from typing import Any

from kiwipiepy import Kiwi
from pydantic import BaseModel, Field
from pysbd import Segmenter

class MemoChunk(BaseModel):
    id: str
    index: int
    text: str
    start: int
    end: int
    sentence_indices: list[int] = Field(default_factory=list)


@lru_cache
def get_kiwi() -> Kiwi:
    return Kiwi()


@lru_cache
def get_english_segmenter() -> Segmenter:
    """Return the non-destructive English splitter used after Kiwi.

    ``char_span=True`` is important here: sentence chunks are persisted with
    offsets into the original memo, so reconstructing offsets from returned
    sentence strings would be unsafe around repeated text or whitespace.
    """
    return Segmenter(language="en", clean=False, char_span=True)


LATIN_RE = re.compile(r"[A-Za-z]")

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
    if not text.strip():
        return []

    # pySBD is only responsible for lines that contain Latin text. Korean-only
    # segments continue to come from Kiwi unchanged in ``split_sentences``.
    if not LATIN_RE.search(text):
        return [(text.strip(), 0, len(text.rstrip()))]

    # pySBD intentionally does not parse Markdown. Mask inline constructs while
    # keeping their character count so its returned spans still index ``text``.
    masked_text = mask_inline_markdown(text)
    sentences: list[tuple[str, int, int]] = []
    for span in get_english_segmenter().segment(masked_text):
        start = int(span.start)
        end = int(span.end)
        # pySBD keeps the whitespace separating sentences in the preceding
        # span. Existing chunk offsets end at the sentence content, not there.
        while end > start and text[end - 1].isspace():
            end -= 1
        if end <= start or not text[start:end].strip():
            continue
        sentences.append((text[start:end].strip(), start, end))

    return sentences


def mask_inline_markdown(text: str) -> str:
    """Mask inline Markdown spans without changing source offsets.

    Fenced code and block math are already isolated before this function is
    called. Inline code, links, emphasis, spoilers, and inline math can contain
    periods that must not become English sentence boundaries.
    """
    spans: list[tuple[int, int, bool]] = []
    for pattern, preserve_terminal_punctuation in (
        (IMAGE_RE, False),
        (LINK_RE, False),
        (STRONG_RE, True),
        (EM_RE, True),
        (STRIKE_RE, True),
        (SPOILER_RE, True),
        (INLINE_CODE_RE, False),
        (INLINE_MATH_RE, False),
    ):
        for match in pattern.finditer(text):
            spans.append((match.start(), match.end(), preserve_terminal_punctuation))

    masked = list(text)
    occupied_until = -1
    for start, end, preserve_terminal_punctuation in sorted(spans):
        if start < occupied_until:
            continue
        terminal_punctuation = -1
        if preserve_terminal_punctuation:
            terminal_punctuation = end - 1
            while terminal_punctuation >= start and text[terminal_punctuation] in "*_~|":
                terminal_punctuation -= 1
            if terminal_punctuation < start or text[terminal_punctuation] not in ".!?":
                terminal_punctuation = -1
        for index in range(start, end):
            if masked[index] not in "\r\n":
                if index == terminal_punctuation:
                    masked[index] = text[index]
                elif text[index] in "*_~|":
                    # A closing emphasis marker must not touch a preserved
                    # terminal period, otherwise pySBD treats it as a word.
                    masked[index] = " "
                else:
                    masked[index] = "x"
        occupied_until = end
    return "".join(masked)


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

                # 4. Refine only English/mixed segments. Korean-only segments
                # remain exactly as Kiwi returned them.
                refined_sentences = (
                    split_english_sentences(segment_text)
                    if LATIN_RE.search(segment_text)
                    else [(segment_text.strip(), 0, len(segment_text.rstrip()))]
                )
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


def build_chunk_id(prefix: str, index: int, start: int, end: int) -> str:
    return f"{prefix}-{index}-{start}-{end}"
