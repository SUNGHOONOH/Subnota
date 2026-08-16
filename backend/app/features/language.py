"""Small, deterministic language hints for content-generated labels and summaries.

This is intentionally not a general language detector.  The backend only needs
to choose between the existing Korean output and an English output prompt.  A
memo containing both scripts keeps the Korean path so mixed notes do not cause
an unexpected language change.
"""

import re
from typing import Literal


ContentLanguage = Literal["ko", "en"]

HANGUL_RE = re.compile(r"[가-힣]")
LATIN_RE = re.compile(r"[A-Za-z]")


def detect_content_language(text: str | None) -> ContentLanguage:
    """Return ``en`` only for clearly Latin-script content.

    Korean/mixed/undetermined input deliberately falls back to Korean.  This
    preserves the existing behavior for short notes, proper nouns, numbers,
    and mixed-language notes instead of making a low-confidence language guess.
    """

    value = text or ""
    if LATIN_RE.search(value) and not HANGUL_RE.search(value):
        return "en"
    return "ko"
