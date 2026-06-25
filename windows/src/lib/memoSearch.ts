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

export const syncMemoSearchIndex = (
  index: ReturnType<typeof buildMemoSearchIndex>,
  indexedVersions: Map<string, string>,
  memos: MemoRow[],
) => {
  const nextVersions = new Map(
    memos.map(memo => [
      memo.id,
      `${getMemoCategory(memo.category)}\u0000${memo.content_hash ?? memo.content}`,
    ]),
  );

  for (const id of indexedVersions.keys()) {
    if (!nextVersions.has(id)) index.discard(id);
  }
  for (const memo of memos) {
    const document = {
      category: getMemoCategory(memo.category),
      content: memo.content,
      id: memo.id,
    };
    if (!indexedVersions.has(memo.id)) index.add(document);
    else if (indexedVersions.get(memo.id) !== nextVersions.get(memo.id)) index.replace(document);
  }

  indexedVersions.clear();
  nextVersions.forEach((version, id) => indexedVersions.set(id, version));
  return index;
};
