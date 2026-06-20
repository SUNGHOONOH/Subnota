export const DEFAULT_MEMO_CATEGORY = 'Ideas';
export const MINI_SUBNOTA_CATEGORY = 'MiniSubnota';

export const getMemoCategory = (category?: string | null) =>
  category ?? DEFAULT_MEMO_CATEGORY;

export const isMiniSubnotaCategory = (category?: string | null) =>
  category === MINI_SUBNOTA_CATEGORY;

export const splitMemoCategories = <T extends { category?: string | null }>(
  memos: T[],
) => {
  const miniMemos = memos.filter(memo => isMiniSubnotaCategory(memo.category));
  const normalMemos = memos.filter(memo => !isMiniSubnotaCategory(memo.category));

  return { miniMemos, normalMemos };
};
