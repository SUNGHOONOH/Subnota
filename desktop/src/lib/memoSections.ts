import { MemoRow } from '../types';

// Sidebar list sections. Pinned memos surface in a fixed top section, ordered
// by when they were pinned (the pinnedIds array order) so the section is
// stable; everything else keeps the existing date grouping untouched.
export const MINI_SECTION_TITLE = 'Quick 노트';

export const getSections = (
  memos: MemoRow[],
  pinnedIds: string[] = [],
  miniMemos: MemoRow[] = [],
  language: 'en' | 'ko' = 'ko',
) => {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pinnedSet = new Set(pinnedIds);
  // 고정은 종류를 가리지 않으므로 미니 메모도 후보에 넣는다.
  const pinnedSection = {
    data: pinnedIds
      .map(
        id =>
          memos.find(memo => memo.id === id) ??
          miniMemos.find(memo => memo.id === id),
      )
      .filter((memo): memo is MemoRow => Boolean(memo)),
    title: language === 'en' ? 'Pinned' : '고정됨',
  };

  const sections = [
    pinnedSection,
    { data: [] as MemoRow[], title: language === 'en' ? 'Recent notes' : '최근 메모' },
    {
      data: miniMemos.filter(memo => !pinnedSet.has(memo.id)),
      title: language === 'en' ? 'Quick notes' : MINI_SECTION_TITLE,
    },
    { data: [] as MemoRow[], title: language === 'en' ? 'Today' : '오늘' },
    { data: [] as MemoRow[], title: language === 'en' ? 'Previous 7 days' : '이전 7일' },
    { data: [] as MemoRow[], title: language === 'en' ? 'Previous 30 days' : '이전 30일' },
    { data: [] as MemoRow[], title: language === 'en' ? 'Older notes' : '오래된 메모' },
  ];

  memos.forEach(memo => {
    if (pinnedSet.has(memo.id)) {
      return;
    }

    const updatedAt = new Date(memo.updated_at).getTime();
    const ageDays = Math.floor((now - updatedAt) / 86400000);

    if (sections[1].data.length < 3) {
      sections[1].data.push(memo);
      return;
    }

    if (updatedAt >= today.getTime()) {
      sections[3].data.push(memo);
    } else if (ageDays <= 7) {
      sections[4].data.push(memo);
    } else if (ageDays <= 30) {
      sections[5].data.push(memo);
    } else {
      sections[6].data.push(memo);
    }
  });

  return sections.filter(section => section.data.length > 0);
};
