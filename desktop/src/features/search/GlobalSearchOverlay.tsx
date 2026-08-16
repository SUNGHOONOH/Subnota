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
import EmptyState from '../../components/EmptyState';
import { getUiDateLocale, localize, useUiLanguage } from '../../lib/uiLanguage';

interface GlobalSearchOverlayProps {
  isOpen: boolean;
  items: GlobalSearchItem[];
  onClose: () => void;
  onSelect: (item: GlobalSearchItem) => void;
}

const KIND_LABELS: Record<GlobalSearchKind, { en: string; ko: string }> = {
  calendar: { en: 'Calendar', ko: '캘린더' },
  inbox: { en: 'Inbox', ko: '링크 저장함' },
  memo: { en: 'Memo', ko: '메모' },
  schedule: { en: 'Schedule suggestion', ko: '일정 후보' },
  topic: { en: 'Topics', ko: 'Topics' },
};

const ResultIcon = ({ kind }: { kind: GlobalSearchKind }) => {
  if (kind === 'topic') return <Topics size={17} />;
  if (kind === 'inbox') return <Inbox size={17} />;
  if (kind === 'calendar' || kind === 'schedule') {
    return <CalendarDays size={17} />;
  }
  return <NotebookText size={17} />;
};

const formatRelativeDate = (timestamp: number, language: 'en' | 'ko') => {
  if (!timestamp) return '';
  const locale = getUiDateLocale(language);
  const elapsed = Date.now() - timestamp;
  if (elapsed < 0) {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
    }).format(timestamp);
  }
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return localize(language, '방금 전', 'Just now');
  if (minutes < 60) return localize(language, `${minutes}분 전`, `${minutes}m ago`);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return localize(language, `${hours}시간 전`, `${hours}h ago`);
  const days = Math.floor(hours / 24);
  if (days < 7) return localize(language, `${days}일 전`, `${days}d ago`);
  return new Intl.DateTimeFormat(locale, {
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
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
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
            aria-label={t('전역 검색', 'Global search')}
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
                aria-label={t('전역 검색어', 'Global search query')}
                onChange={event => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                  setHoveredIndex(null);
                  setKeyboardNavigating(false);
                }}
                placeholder={t('메모, Topics, 수집함, 일정 검색', 'Search memos, Topics, Inbox, and schedules')}
                ref={inputRef}
                value={query}
              />
              <button aria-label={t('검색 닫기', 'Close search')} onClick={onClose} type="button">
                <X size={18} />
              </button>
            </div>

            <div className="global-search-section-label">
              {query.trim() ? t('검색 결과', 'Search results') : t('최근 항목', 'Recent items')}
              <span>{results.length}</span>
            </div>
            <div
              aria-label={query.trim() ? t('검색 결과', 'Search results') : t('최근 항목', 'Recent items')}
              className="global-search-results"
              id="global-search-results"
              onMouseLeave={() => setHoveredIndex(null)}
              role="listbox"
            >
              {results.length === 0 ? (
                <EmptyState
                  className="global-search-empty"
                  title={t('일치하는 항목이 없습니다', 'No matching items')}
                  tone="result"
                />
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
                      {formatRelativeDate(item.timestamp, language) || localize(
                        language,
                        KIND_LABELS[item.kind].ko,
                        KIND_LABELS[item.kind].en,
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
            <footer className="global-search-footer">
              <span>{t('↑↓ 이동', '↑↓ move')}</span>
              <span>{t('↵ 열기', '↵ open')}</span>
              <span>{t('esc 닫기', 'esc close')}</span>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalSearchOverlay;
