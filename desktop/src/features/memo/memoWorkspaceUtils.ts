import { localize } from '../../lib/uiLanguage';
import type {
  MemoFolderMembership,
  MemoRow,
} from '../../types';

// 접어둔 상태가 앱을 껐다 켜면 풀리면 접는 의미가 없다. 섹션 제목이 곧 키다.
export const COLLAPSED_SECTIONS_KEY = 'subnota.sidebar.collapsedSections';

export const readCollapsedSections = () => {
  try {
    const raw = window.localStorage?.getItem(COLLAPSED_SECTIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((title): title is string => typeof title === 'string')
        : [],
    );
  } catch {
    return new Set<string>();
  }
};

export const getMemoTitle = (memo: MemoRow, language: 'en' | 'ko') => {
  const title = memo.content
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  if (!title) {
    return localize(language, '새 메모', 'New note');
  }

  return title.length > 22 ? `${title.slice(0, 22).trimEnd()}...` : title;
};

export const getMemoPreview = (memo: MemoRow, language: 'en' | 'ko') => {
  const lines = memo.content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const preview =
    lines[1] ?? lines[0] ?? localize(language, '내용 없음', 'No content');

  return preview.length > 38 ? `${preview.slice(0, 38).trimEnd()}...` : preview;
};

export const getFolderMemoRows = ({
  folderId,
  memberships,
  memos,
}: {
  folderId: string;
  memberships: MemoFolderMembership[];
  memos: MemoRow[];
}) => {
  const memoById = new Map(memos.map(memo => [memo.id, memo]));

  return memberships
    .filter(membership => membership.folderId === folderId)
    .map(membership => {
      const memo = memoById.get(membership.memoId);

      return memo ? { memo, membership } : null;
    })
    .filter((item): item is { memo: MemoRow; membership: MemoFolderMembership } =>
      Boolean(item),
    )
    .sort((a, b) => b.memo.updated_at.localeCompare(a.memo.updated_at));
};
