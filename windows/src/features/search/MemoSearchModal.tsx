import { useEffect, useMemo, useRef } from 'react';
import MiniSearch from 'minisearch';
import { Search, X } from '@/components/icons';

import { getMemoCategory } from '../../lib/memoCategory';
import { MemoRow } from '../../types';

interface SearchDocument {
  category: string;
  content: string;
  createdAt: string;
  id: string;
  title: string;
  updatedAt: string;
}

interface MemoSearchModalProps {
  isOpen: boolean;
  memos: MemoRow[];
  onChangeQuery: (query: string) => void;
  onClose: () => void;
  onSelectMemo: (memo: MemoRow) => void;
  query: string;
}

const getMemoTitle = (content: string) => {
  const firstLine = content
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return '새 메모';
  }

  return firstLine.length > 40
    ? `${firstLine.slice(0, 40).trimEnd()}...`
    : firstLine;
};

const getSnippet = (content: string) => {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '내용 없음';
  }
  return normalized.length > 86
    ? `${normalized.slice(0, 86).trimEnd()}...`
    : normalized;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('ko-KR', {
    day: '2-digit',
    month: 'short',
  });
};

const MemoSearchModal = ({
  isOpen,
  memos,
  onChangeQuery,
  onClose,
  onSelectMemo,
  query,
}: MemoSearchModalProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const documents = useMemo<SearchDocument[]>(
    () =>
      memos.map(memo => ({
        category: getMemoCategory(memo.category),
        content: memo.content,
        createdAt: memo.created_at,
        id: memo.id,
        title: getMemoTitle(memo.content),
        updatedAt: memo.updated_at,
      })),
    [memos],
  );
  const index = useMemo(() => {
    const nextIndex = new MiniSearch<SearchDocument>({
      fields: ['title', 'content', 'category'],
      idField: 'id',
      storeFields: ['category', 'content', 'createdAt', 'title', 'updatedAt'],
    });
    nextIndex.addAll(documents);
    return nextIndex;
  }, [documents]);
  const trimmedQuery = query.trim();
  const results = useMemo(() => {
    if (!trimmedQuery) {
      return documents.slice(0, 10);
    }

    return index
      .search(trimmedQuery, {
        boost: { title: 2.2, category: 1.4 },
        fuzzy: trimmedQuery.length > 2 ? 0.2 : false,
        prefix: true,
      })
      .slice(0, 10)
      .map(result => ({
        category: String(result.category ?? ''),
        content: String(result.content ?? ''),
        createdAt: String(result.createdAt ?? ''),
        id: String(result.id),
        title: String(result.title ?? '새 메모'),
        updatedAt: String(result.updatedAt ?? ''),
      }));
  }, [documents, index, trimmedQuery]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-label="메모 검색"
        className="search-modal"
        role="dialog"
      >
        <div className="search-input-row">
          <Search size={18} />
          <input
            ref={inputRef}
            aria-label="메모 검색어"
            onChange={event => onChangeQuery(event.target.value)}
            placeholder="메모 검색"
            value={query}
          />
          <button aria-label="검색 닫기" className="icon-button" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>

        <div className="search-result-list">
          {results.length === 0 ? (
            <p className="search-empty">검색 결과가 없습니다.</p>
          ) : (
            results.map(result => {
              const memo = memos.find(item => item.id === result.id);
              return (
                <button
                  className="search-result-row"
                  key={result.id}
                  onClick={() => {
                    if (memo) {
                      onSelectMemo(memo);
                    }
                    onClose();
                  }}
                  type="button"
                >
                  <strong>{result.title}</strong>
                  <span>{getSnippet(result.content)}</span>
                  <em>
                    {result.category}
                    {formatDate(result.updatedAt) ? ` · ${formatDate(result.updatedAt)}` : ''}
                  </em>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

export default MemoSearchModal;
