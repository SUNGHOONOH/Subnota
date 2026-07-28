/**
 * 미리보기 본문에서 강조할 청크의 위치.
 *
 * startIndex/endIndex는 **색인 시점의 본문** 기준이라, 그 뒤 메모를 편집하면
 * 어긋난다. 어긋난 인덱스를 그대로 잘라 쓰면 엉뚱한 구간이 강조되므로
 * 반드시 실제 텍스트와 대조해야 한다.
 */
export interface PreviewHighlightRange {
  end: number;
  start: number;
}

export const findPreviewHighlight = (
  content: string,
  chunkText: string,
  startIndex: number,
  endIndex: number,
): PreviewHighlightRange | null => {
  if (!chunkText) {
    return null;
  }

  if (
    startIndex >= 0 &&
    endIndex > startIndex &&
    endIndex <= content.length &&
    content.slice(startIndex, endIndex) === chunkText
  ) {
    return { end: endIndex, start: startIndex };
  }

  // 인덱스가 어긋났으면 텍스트로 다시 찾는다. 그래도 없으면 강조하지 않는다 —
  // 잘못된 구간을 강조하는 것보다 강조가 없는 편이 낫다.
  const found = content.indexOf(chunkText);
  return found >= 0 ? { end: found + chunkText.length, start: found } : null;
};
