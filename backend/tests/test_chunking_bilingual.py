from app.features.memo.chunking import split_sentences


def test_keeps_english_abbreviations_and_mixed_language_boundaries() -> None:
    text = "Dr. Kim joined the meeting. 한국어 문장입니다. Next Friday at 3 PM works."

    assert [chunk.text for chunk in split_sentences(text)] == [
        "Dr. Kim joined the meeting.",
        "한국어 문장입니다.",
        "Next Friday at 3 PM works.",
    ]


def test_does_not_split_an_english_domain_name() -> None:
    text = "Read example.com first. Then publish the release."

    assert [chunk.text for chunk in split_sentences(text)] == [
        "Read example.com first.",
        "Then publish the release.",
    ]


def test_pysbd_keeps_abbreviations_decimals_and_versions_together() -> None:
    text = "Dr. Kim reviewed version 1.2.3. It passed in the U.S."

    assert [chunk.text for chunk in split_sentences(text)] == [
        "Dr. Kim reviewed version 1.2.3.",
        "It passed in the U.S.",
    ]


def test_pysbd_keeps_quoted_sentence_boundary_and_source_offsets() -> None:
    text = 'She said, "Ship it." Then left.'

    chunks = split_sentences(text)

    assert [chunk.text for chunk in chunks] == ['She said, "Ship it."', "Then left."]
    assert [(chunk.start, chunk.end) for chunk in chunks] == [(0, 20), (21, 31)]
    assert [text[chunk.start : chunk.end] for chunk in chunks] == [
        'She said, "Ship it."',
        "Then left.",
    ]


def test_mixed_language_uses_pysbd_without_changing_kiwi_korean_boundaries() -> None:
    text = "첫 문장입니다. English sentence. 둘째 문장입니다. Next one."

    chunks = split_sentences(text)

    assert [chunk.text for chunk in chunks] == [
        "첫 문장입니다.",
        "English sentence.",
        "둘째 문장입니다.",
        "Next one.",
    ]
    assert [text[chunk.start : chunk.end] for chunk in chunks] == [chunk.text for chunk in chunks]


def test_inline_markdown_and_code_blocks_are_not_split_internally() -> None:
    text = "Use **bold text.** Then continue.\n```python\nprint('Hi.')\n```\nNext."

    chunks = split_sentences(text)

    assert [chunk.text for chunk in chunks] == [
        "Use bold text.",
        "Then continue.",
        "print('Hi.')",
        "Next.",
    ]
    assert text[chunks[0].start : chunks[0].end] == "Use **bold text.**"
    assert text[chunks[2].start : chunks[2].end].startswith("```python")
