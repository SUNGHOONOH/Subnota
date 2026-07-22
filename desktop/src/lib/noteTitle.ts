// 노트 "제목"은 별도 DB 컬럼이 아니라 content 첫 줄이다(사이드바/그래프의
// 기존 파생 규칙과 동일). split/join은 서로 역연산이어야 제목 입력과 본문
// 에디터가 타이핑 중에 서로의 값을 흔들지 않는다.
export const splitNoteContent = (content: string) => {
  const newlineIndex = content.indexOf('\n');
  if (newlineIndex < 0) {
    return { body: '', title: content };
  }
  return {
    body: content.slice(newlineIndex + 1),
    title: content.slice(0, newlineIndex),
  };
};

export const joinNoteContent = (title: string, body: string) => {
  const singleLineTitle = title.replace(/\n/g, ' ');
  if (!singleLineTitle && !body) {
    return '';
  }
  return `${singleLineTitle}\n${body}`;
};
