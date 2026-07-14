import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEMO_CATEGORY,
  MINI_SUBNOTA_CATEGORY,
  getMemoCategory,
  splitMemoCategories,
} from '../lib/memoCategory';

describe('memo category helpers', () => {
  it('defaults empty memo categories to Ideas', () => {
    expect(getMemoCategory()).toBe(DEFAULT_MEMO_CATEGORY);
    expect(getMemoCategory(null)).toBe(DEFAULT_MEMO_CATEGORY);
  });

  it('splits Mini Subnota memos from normal memos', () => {
    const { miniMemos, normalMemos } = splitMemoCategories([
      { category: DEFAULT_MEMO_CATEGORY, id: 'normal-1' },
      { category: MINI_SUBNOTA_CATEGORY, id: 'mini-1' },
      { category: null, id: 'normal-2' },
    ]);

    expect(miniMemos.map(memo => memo.id)).toEqual(['mini-1']);
    expect(normalMemos.map(memo => memo.id)).toEqual(['normal-1', 'normal-2']);
  });
});
