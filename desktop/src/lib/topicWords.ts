const CONTENT_WORD = /^(?:[가-힣]{2,}|[A-Za-z]{3,})$/;
const HANGUL = /[가-힣]/;
const STOP_EN = new Set(
  'the and for with that this from are was were you your but not have has had will can all our its his her they them their she him who what when where which how why then than there here into onto about just also very more most some any each every one two out off over under after before while been being would could should may might must shall does did done doing get got'.split(' '),
);
const GENERIC = new Set(
  '독서 정리 여행 시간 방법 선택 자동차 기타 음식 사진 스마트폰 운동 기능 영화 이동 건강 공부 시계 활용 book food time man study learning love sun'.split(' '),
);

export const topicPrompt = (text: string) =>
  HANGUL.test(text)
    ? `${text} 관련 단어: <mask>, <mask>, <mask>.`
    : `${text} Related words: <mask>, <mask>, <mask>.`;

export const eligibleTopicTokenIds = (tokens: string[], specialIds: number[]) => {
  const special = new Set(specialIds);
  return tokens.flatMap((token, id) =>
    !special.has(id) && CONTENT_WORD.test(token) && !STOP_EN.has(token.toLowerCase())
      ? [id]
      : [],
  );
};

/** Logits are [1, sequence, vocabulary]; use the best softmax probability
 * across the three mask positions, as in the measured Python harness. */
export const rankTopicWords = (
  logits: ArrayLike<number>,
  vocabularySize: number,
  maskPositions: number[],
  tokens: string[],
  eligibleIds: number[],
): string[] => {
  if (maskPositions.length !== 3 || tokens.length !== vocabularySize) {
    throw new Error('Invalid A.X mask or vocabulary.');
  }
  const rowStats = maskPositions.map(position => {
    const start = position * vocabularySize;
    if (start < 0 || start + vocabularySize > logits.length) {
      throw new Error('Invalid A.X logits shape.');
    }
    let maximum = -Infinity;
    for (let id = 0; id < vocabularySize; id += 1) {
      maximum = Math.max(maximum, logits[start + id]);
    }
    let denominator = 0;
    for (let id = 0; id < vocabularySize; id += 1) {
      denominator += Math.exp(logits[start + id] - maximum);
    }
    return { denominator, maximum, start };
  });

  return eligibleIds
    .map(id => ({
      id,
      weight: Math.max(
        ...rowStats.map(row =>
          Math.exp(logits[row.start + id] - row.maximum) / row.denominator,
        ),
      ),
    }))
    .filter(item => Number.isFinite(item.weight) && item.weight > 0)
    .sort((left, right) => right.weight - left.weight || left.id - right.id)
    .slice(0, 16)
    .map(item => tokens[item.id])
    .filter(token => !GENERIC.has(token.toLowerCase()))
    .slice(0, 8);
};
