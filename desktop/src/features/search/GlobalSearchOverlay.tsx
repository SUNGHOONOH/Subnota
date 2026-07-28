import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import {
  CalendarDays,
  Inbox,
  NotebookText,
  Search,
  Topics,
  X,
} from '@/components/icons';
import {
  buildGlobalSearchCatalog,
  type GlobalSearchItem,
  type GlobalSearchKind,
} from '../../lib/globalSearch';

interface GlobalSearchOverlayProps {
  isOpen: boolean;
  items: GlobalSearchItem[];
  onClose: () => void;
  onSelect: (item: GlobalSearchItem) => void;
}

const KIND_LABELS: Record<GlobalSearchKind, string> = {
  calendar: '캘린더',
  inbox: '웹 수집함',
  memo: '메모',
  schedule: '일정 후보',
  topic: 'Topics',
};

const ResultIcon = ({ kind }: { kind: GlobalSearchKind }) => {
  if (kind === 'topic') return <Topics size={17} />;
  if (kind === 'inbox') return <Inbox size={17} />;
  if (kind === 'calendar' || kind === 'schedule') {
    return <CalendarDays size={17} />;
  }
  return <NotebookText size={17} />;
};

const formatRelativeDate = (timestamp: number) => {
  if (!timestamp) return '';
  const elapsed = Date.now() - timestamp;
  if (elapsed < 0) {
    return new Intl.DateTimeFormat('ko-KR', {
      day: 'numeric',
      month: 'short',
    }).format(timestamp);
  }
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Intl.DateTimeFormat('ko-KR', {
    day: 'numeric',
    month: 'short',
  }).format(timestamp);
};

const GlobalSearchOverlay = ({
  isOpen,
  items,
  onClose,
  onSelect,
}: GlobalSearchOverlayProps) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isKeyboardNavigating, setKeyboardNavigating] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const catalog = useMemo(() => buildGlobalSearchCatalog(items), [items]);
  const results = useMemo(() => catalog.search(query), [catalog, query]);

  useEffect(() => {
    if (!isOpen) return undefined;
    setQuery('');
    setActiveIndex(0);
    setHoveredIndex(null);
    setKeyboardNavigating(false);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(index => Math.min(index, Math.max(results.length - 1, 0)));
    setHoveredIndex(null);
  }, [results.length]);

  const focusedIndex =
    hoveredIndex ?? (isKeyboardNavigating ? activeIndex : null);

  const chooseResult = (item: GlobalSearchItem) => {
    onSelect(item);
    onClose();
  };

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          animate={{ opacity: 1 }}
          className="global-search-backdrop"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={event => {
            if (event.currentTarget === event.target) onClose();
          }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
        >
          <motion.section
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-label="전역 검색"
            aria-modal="true"
            className="global-search-dialog"
            exit={{ opacity: 0, scale: 0.99, y: -6 }}
            initial={{ opacity: 0, scale: 0.99, y: -8 }}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setHoveredIndex(null);
                setKeyboardNavigating(true);
                setActiveIndex(index =>
                  results.length ? (index + 1) % results.length : 0,
                );
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setHoveredIndex(null);
                setKeyboardNavigating(true);
                setActiveIndex(index =>
                  results.length
                    ? (index - 1 + results.length) % results.length
                    : 0,
                );
              } else if (
                event.key === 'Enter' &&
                results[focusedIndex ?? 0]
              ) {
                event.preventDefault();
                chooseResult(results[focusedIndex ?? 0]);
              }
            }}
            role="dialog"
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="global-search-input-row">
              <Search size={18} />
              <input
                aria-controls="global-search-results"
                aria-label="전역 검색어"
                onChange={event => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                  setHoveredIndex(null);
                  setKeyboardNavigating(false);
                }}
                placeholder="메모, Topics, 수집함, 일정 검색"
                ref={inputRef}
                value={query}
              />
              <button aria-label="검색 닫기" onClick={onClose} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="global-search-section-label">
              {query.trim() ? '검색 결과' : '최근 항목'}
              <span>{results.length}</span>
            </div>
            <div
              aria-label={query.trim() ? '검색 결과' : '최근 항목'}
              className="global-search-results"
              id="global-search-results"
              onMouseLeave={() => setHoveredIndex(null)}
              role="listbox"
            >
              {results.length === 0 ? (
                <p className="global-search-empty">일치하는 항목이 없습니다.</p>
              ) : (
                results.map((item, index) => (
                  <button
                    aria-selected={index === focusedIndex}
                    className={index === focusedIndex ? 'is-active' : undefined}
                    key={item.key}
                    onClick={() => chooseResult(item)}
                    onMouseEnter={() => {
                      setHoveredIndex(index);
                      setKeyboardNavigating(false);
                    }}
                    role="option"
                    type="button"
                  >
                    <span className="global-search-result-icon">
                      <ResultIcon kind={item.kind} />
                    </span>
                    <span className="global-search-result-copy">
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </span>
                    <span className="global-search-result-meta">
                      {formatRelativeDate(item.timestamp) || KIND_LABELS[item.kind]}
                    </span>
                  </button>
                ))
              )}
            </div>
            <footer className="global-search-footer">
              <span>↑↓ 이동</span>
              <span>↵ 열기</span>
              <span>esc 닫기</span>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalSearchOverlay;
