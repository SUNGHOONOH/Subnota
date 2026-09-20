// 청크 원문(`chunk_text`)은 손대지 않는다 — 에디터에서 문장 위치를 찾는 텍스트 포함
// 검색의 기준이고, `start_index`/`end_index` 도 원문 오프셋이다. 화면에 그릴 때와
// 임베딩할 때만 이 함수를 통과시킨다.
//
// 에디터가 하이라이트를 마크다운 본문에 raw HTML 로 직렬화해서 이런 청크가 남는다:
//   `## <mark data-color="var(--tt-color-highlight-green)">다른 앱 아이디어</mark>`
// 70자 중 55자가 태그라 뜻이 묻히고, 목록에도 태그가 그대로 보인다.

// 여는 꺾쇠 다음에 글자가 와야 태그로 본다. `<[^>]+>` 로 하면
// "3 < 5 그리고 7 > 2" 의 가운데가 태그로 잡혀 본문이 지워진다.
const TAG = /<\/?[a-zA-Z][^>]*>/g;
// 태그를 먼저 떼고 나서 푼다 — 순서가 반대면 `&lt;b&gt;` 가 태그로 되살아나 지워진다.
const ENTITY = /&(nbsp|amp|lt|gt|quot|#39);/g;
const ENTITY_TEXT: Record<string, string> = {
  '#39': "'",
  amp: '&',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};
const HEADING = /^#{1,6}\s*/gm;
const BULLET = /^[-*+]\s+/gm;

export const normalizeChunkText = (text: string): string =>
  text
    .replace(TAG, ' ')
    .replace(ENTITY, (_match, name: string) => ENTITY_TEXT[name] ?? ' ')
    .replace(HEADING, '')
    .replace(BULLET, '')
    .replace(/\s+/g, ' ')
    .trim();

// 색인에서 뺄 청크. `&nbsp;`, `1.`, `교통`, `ㅇㅇㅇ` 처럼 내용이 없는 것들이
// 코퍼스 한가운데에 놓여 아무 질의에나 1등으로 올라온다.
const CONTENT_WORD = /[가-힣]{2,}|[A-Za-z]{3,}/g;
const MIN_CONTENT_WORDS = 2;

export const hasSearchableContent = (text: string): boolean =>
  (normalizeChunkText(text).match(CONTENT_WORD) ?? []).length >= MIN_CONTENT_WORDS;
