const CATEGORY_KEYWORDS = {
  Work: ['회의', '미팅', '프로젝트', '마감', '업무', 'task', 'work'],
  Life: ['운동', '약속', '병원', '식사', 'home', 'life'],
  Todo: ['할 일', '할일', '해야', 'todo', 'to do'],
  Misc: ['잡다', '잡다구리', '기타', 'misc'],
  Ideas: ['아이디어', '생각', '실험', '노트', 'idea'],
};

export type MemoCategory = keyof typeof CATEGORY_KEYWORDS;

export const categorizeMemo = (content: string): MemoCategory => {
  const normalized = content.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      return category as MemoCategory;
    }
  }

  return 'Ideas';
};
