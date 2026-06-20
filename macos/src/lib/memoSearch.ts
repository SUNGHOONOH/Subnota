import MiniSearch from 'minisearch';

import { getMemoCategory } from './memoCategory';
import { MemoRow } from '../types';

// Builds the in-memory search index for the sidebar memo search. Documents are
// pre-mapped to plain objects (id/content/category) so MiniSearch reads the id
// from the real `id` field — passing a custom `extractField` here is a trap,
// because MiniSearch also uses it to read the idField and would otherwise
// collide ids across memos.
export const buildMemoSearchIndex = (memos: MemoRow[]) => {
  const index = new MiniSearch({
    fields: ['content', 'category'],
    idField: 'id',
  });

  index.addAll(
    memos.map(memo => ({
      category: getMemoCategory(memo.category),
      content: memo.content,
      id: memo.id,
    })),
  );

  return index;
};
