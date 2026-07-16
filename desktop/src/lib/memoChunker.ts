export interface MemoChunk {
  id: string;
  index: number;
  text: string;
  start: number;
  end: number;
}

export interface ChunkWindow {
  center: MemoChunk | null;
  chunks: MemoChunk[];
}

export interface ChunkMemoOptions {
  minChunkLength?: number;
}

const DEFAULT_MIN_CHUNK_LENGTH = 2;

// Boundary *candidates* only — isFalseBoundary() rejects the ambiguous ones.
// Branches: line breaks · terminal punctuation (with trailing closing quotes/
// brackets) · Korean note-style endings without punctuation (음슴체/개조식:
// 해야 함, 할 것, 확인함, 정리됨, 것임, 했음, 했다, 가야지, 없슴) · emoticon
// runs (ㅋㅋ/ㅠㅠ) that end a clause in casual writing.
const BOUNDARY_REGEX =
  /\r?\n+|[.!?。！？…]+["'”’」』》)\]]*(?=\s|$)|(?:해야\s*함|할\s*것|함|됨|[것중거정]임|[음슴다]|야지|[ㅋㅎㅠㅜ]{2,})(?=\s|$)/g;

// Borrowed from the backend splitter's abbreviation list.
const ENGLISH_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'eg', 'ie', 'ca',
  'co', 'corp', 'inc', 'ltd', 'st', 'ave', 'rd', 'jan', 'feb', 'mar', 'apr',
  'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'vol', 'ed', 'pp', 'al',
]);

// 음슴체 '~음'이 붙는 형용사 어간 화이트리스트 (좋음/없음/같음…). 과거형
// (했음/었음)은 종성 ㅆ 검사로 잡히므로 여기 없어도 된다.
const UM_STEM_CHARS = /[좋없있같맞많적높낮늦길짧]/;

// 받침이 ㅆ인 음절 (했/었/갔/왔…): 뒤에 '음'·'다'가 오면 문장 종결로 본다.
const hasSsangSiotFinal = (char: string): boolean => {
  if (!char) {
    return false;
  }
  const offset = char.charCodeAt(0) - 0xac00;
  return offset >= 0 && offset < 11172 && offset % 28 === 20;
};

const isFalseBoundary = (text: string, match: RegExpExecArray): boolean => {
  const matched = match[0];

  if (/^\r?\n/.test(matched)) {
    return false;
  }

  const prevChar = text[match.index - 1] ?? '';
  const after = text.slice(match.index + matched.length).trimStart();

  if (/^[.!?。！？…]/.test(matched)) {
    // 영문 소문자로 이어지면 문장 중간 (backend splitter와 동일한 규칙).
    if (/^[a-z]/.test(after)) {
      return true;
    }
    if (matched.includes('.')) {
      const word = /([A-Za-z]+)$/.exec(text.slice(0, match.index))?.[1];
      if (word && (word.length === 1 || ENGLISH_ABBREVIATIONS.has(word.toLowerCase()))) {
        return true;
      }
    }
    // 닫는 따옴표 뒤 인용 연속: 그는 "좋다." 라고 말했다.
    if (/["'”’」』》)\]]/.test(matched) && /^(이?라[고며면]|하[고며]|라는)/.test(after)) {
      return true;
    }
    return false;
  }

  if (matched === '음' || matched === '슴') {
    return !(hasSsangSiotFinal(prevChar) || UM_STEM_CHARS.test(prevChar));
  }
  if (matched === '다') {
    // ㅆ받침 과거형(했다/었다)만 인정하되 "갔다 왔다"류 보조 연결은 제외.
    return !hasSsangSiotFinal(prevChar) || /^[오온왔와]/.test(after);
  }
  if (matched === '함') {
    // 명사 오탐: 포함/명함/결함.
    return prevChar === '포' || prevChar === '명' || prevChar === '결';
  }
  if (matched.includes('것')) {
    // "~할 것 같다"는 종결이 아니다.
    return after.startsWith('같');
  }
  return false;
};

export const chunkMemoText = (
  text: string,
  options: ChunkMemoOptions = {},
): MemoChunk[] => {
  const minChunkLength = options.minChunkLength ?? DEFAULT_MIN_CHUNK_LENGTH;
  const chunks: MemoChunk[] = [];
  let chunkStart = 0;
  let match: RegExpExecArray | null;

  BOUNDARY_REGEX.lastIndex = 0;

  while ((match = BOUNDARY_REGEX.exec(text)) !== null) {
    if (isFalseBoundary(text, match)) {
      continue;
    }
    const matchedText = match[0];
    const isLineBreak = /^\r?\n+$/.test(matchedText);
    const rawEnd = isLineBreak ? match.index : match.index + matchedText.length;

    appendChunk(chunks, text, chunkStart, rawEnd, minChunkLength);
    chunkStart = match.index + matchedText.length;
  }

  appendChunk(chunks, text, chunkStart, text.length, minChunkLength);

  return chunks.map((chunk, index) => ({
    ...chunk,
    id: buildChunkId(chunk, index),
    index,
  }));
};

export const findChunkAtCursor = (
  chunks: MemoChunk[],
  cursorIndex: number,
): MemoChunk | null => {
  if (chunks.length === 0) {
    return null;
  }

  const cursor = Math.max(0, cursorIndex);
  const containingChunk = chunks.find(
    chunk => cursor >= chunk.start && cursor <= chunk.end,
  );

  if (containingChunk) {
    return containingChunk;
  }

  return chunks.reduce<MemoChunk>((nearest, chunk) => {
    return distanceToChunk(cursor, chunk) < distanceToChunk(cursor, nearest)
      ? chunk
      : nearest;
  }, chunks[0]);
};

export const getCursorChunkWindow = (
  text: string,
  cursorIndex: number,
  radius = 1,
): ChunkWindow => {
  const chunks = chunkMemoText(text);
  const center = findChunkAtCursor(chunks, cursorIndex);

  if (!center) {
    return { center: null, chunks: [] };
  }

  // 줄바꿈은 블록 경계: 윈도우는 커서가 있는 줄 안에서만 확장한다.
  let startIndex = center.index;
  while (
    startIndex > 0 &&
    center.index - startIndex < radius &&
    !hasLineBreakBetween(text, chunks[startIndex - 1], chunks[startIndex])
  ) {
    startIndex -= 1;
  }

  let endIndex = center.index + 1;
  while (
    endIndex < chunks.length &&
    endIndex - center.index - 1 < radius &&
    !hasLineBreakBetween(text, chunks[endIndex - 1], chunks[endIndex])
  ) {
    endIndex += 1;
  }

  return {
    center,
    chunks: chunks.slice(startIndex, endIndex),
  };
};

export const getCursorContextText = (
  text: string,
  cursorIndex: number,
  radius = 1,
): string => {
  return getCursorChunkWindow(text, cursorIndex, radius)
    .chunks.map(chunk => chunk.text)
    .join('\n')
    .trim();
};

const hasLineBreakBetween = (
  text: string,
  left: MemoChunk,
  right: MemoChunk,
): boolean => {
  return text.slice(left.end, right.start).includes('\n');
};

const appendChunk = (
  chunks: MemoChunk[],
  sourceText: string,
  rawStart: number,
  rawEnd: number,
  minChunkLength: number,
) => {
  const { start, end } = trimRange(sourceText, rawStart, rawEnd);
  const chunkText = sourceText.slice(start, end);

  if (chunkText.length < minChunkLength) {
    return;
  }

  chunks.push({
    id: '',
    index: chunks.length,
    text: chunkText,
    start,
    end,
  });
};

const trimRange = (text: string, start: number, end: number) => {
  let nextStart = Math.max(0, start);
  let nextEnd = Math.min(text.length, Math.max(start, end));

  while (nextStart < nextEnd && /\s/.test(text[nextStart])) {
    nextStart += 1;
  }

  while (nextEnd > nextStart && /\s/.test(text[nextEnd - 1])) {
    nextEnd -= 1;
  }

  return { start: nextStart, end: nextEnd };
};

const distanceToChunk = (cursorIndex: number, chunk: MemoChunk) => {
  if (cursorIndex >= chunk.start && cursorIndex <= chunk.end) {
    return 0;
  }

  return Math.min(
    Math.abs(cursorIndex - chunk.start),
    Math.abs(cursorIndex - chunk.end),
  );
};

const buildChunkId = (chunk: MemoChunk, index: number) => {
  return `chunk-${index}-${chunk.start}-${chunk.end}`;
};
