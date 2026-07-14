import { MemoRow } from '../types';

// Sidebar list sections. Pinned memos surface in a fixed top section, ordered
// by when they were pinned (the pinnedIds array order) so the section is
// stable; everything else keeps the existing date grouping untouched.
export const getSections = (memos: MemoRow[], pinnedIds: string[] = []) => {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pinnedSet = new Set(pinnedIds);
  const pinnedSection = {
    data: pinnedIds
      .map(id => memos.find(memo => memo.id === id))
      .filter((memo): memo is MemoRow => Boolean(memo)),
    title: '고정됨',
  };

  const sections = [
    pinnedSection,
    { data: [] as MemoRow[], title: '최근 메모' },
    { data: [] as MemoRow[], title: '오늘' },
    { data: [] as MemoRow[], title: '이전 7일' },
    { data: [] as MemoRow[], title: '이전 30일' },
    { data: [] as MemoRow[], title: '오래된 메모' },
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
      sections[2].data.push(memo);
    } else if (ageDays <= 7) {
      sections[3].data.push(memo);
    } else if (ageDays <= 30) {
      sections[4].data.push(memo);
    } else {
      sections[5].data.push(memo);
    }
  });

  return sections.filter(section => section.data.length > 0);
};
