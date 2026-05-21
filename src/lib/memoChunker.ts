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

const BOUNDARY_REGEX =
  /\r?\n+|[.!?。！？]+(?:\s+|$)|(?:해야\s*함|해야함|할\s*것|할것|함|됨|임|음)(?=\s|$)/g;

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

  const startIndex = Math.max(0, center.index - radius);
  const endIndex = Math.min(chunks.length, center.index + radius + 1);

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
