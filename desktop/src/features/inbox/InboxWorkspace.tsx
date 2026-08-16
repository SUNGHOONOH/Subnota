import { FormEvent, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Pagination,
  SegmentedControl,
  Text,
  TextInput,
} from '@mantine/core';
import { Heart, MoreHorizontal, Search, Trash2 } from '@/components/icons';

import { InboxSession } from '../../services/backend/inboxService';
import { faviconUrlFor } from '../../lib/favicon';
import { normalizeStringArray } from '../../lib/viewCrashGuards';
import InboxCardSkeleton from './InboxCardSkeleton';
import EmptyState from '../../components/EmptyState';
import { localize, useUiLanguage } from '../../lib/uiLanguage';

interface InboxWorkspaceProps {
  inboxItems: InboxSession[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  onOpenDetail: (item: InboxSession) => void;
  onSaveUrl: (url: string) => Promise<unknown>;
  onToggleLike: (id: string, liked: boolean) => void;
}

type InboxFilter = 'all' | 'liked';

const PAGE_SIZE = 6;
const CARD_KEYWORD_LIMIT = 4;

const getInboxKeywords = (item: InboxSession) =>
  normalizeStringArray(item.keywords);

const formatDuration = (duration: string | null) => {
  if (!duration) {
    return null;
  }

  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const matchesQuery = (item: InboxSession, query: string) => {
  const haystack = [
    item.title,
    item.channelTitle,
    item.domain,
    item.summaryOneLiner,
    item.summary,
    ...getInboxKeywords(item),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
};

const InboxWorkspace = ({
  inboxItems,
  isLoading,
  onDelete,
  onOpenDetail,
  onSaveUrl,
  onToggleLike,
}: InboxWorkspaceProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const shouldReduceMotion = useReducedMotion();
  const [draft, setDraft] = useState('');
  const [isSaving, setSaving] = useState(false);
  const [isNewOpen, setNewOpen] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const url = draft.trim();
    if (!url) {
      return;
    }

    setSaving(true);
    try {
      await onSaveUrl(url);
      setDraft('');
      setNewOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = inboxItems.filter(
    item =>
      (filter !== 'liked' || item.liked) &&
      (!normalizedQuery || matchesQuery(item, normalizedQuery)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="inbox-workspace">
      {/* 노션 웹클리퍼식 상단 바 — [검색 / ⋯ / 전체·좋아요]. 링크 저장은
          부가 기능이라 ⋯ 메뉴 안으로. */}
      <div className="inbox-list-header">
        <Group className="inbox-toolbar" gap={6} wrap="nowrap">
          <TextInput
            className="inbox-search-input"
            leftSection={<Search size={13} />}
            onChange={event => {
              setQuery(event.currentTarget.value);
              setPage(1);
            }}
            placeholder={t('검색', 'Search')}
            size="xs"
            value={query}
          />
          <Menu
            onChange={setNewOpen}
            opened={isNewOpen}
            position="bottom-end"
            shadow="md"
            width={300}
          >
            <Menu.Target>
              {/* 토글은 Menu.Target이 처리한다(제어형 onChange) — 수동 onClick을
                  더하면 이중 토글로 메뉴가 열리지 않는다. */}
              <ActionIcon
                aria-label={t('더보기', 'More')}
                color="gray"
                size={28}
                title={t('더보기', 'More')}
                variant="subtle"
              >
                <MoreHorizontal size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{t('링크 저장', 'Save link')}</Menu.Label>
              <form className="inbox-new-form" onSubmit={submit}>
                <Group gap={8} wrap="nowrap">
                  <TextInput
                    autoFocus
                    onChange={event => setDraft(event.currentTarget.value)}
                    placeholder={t('링크 붙여넣기', 'Paste a link')}
                    size="xs"
                    style={{ flex: 1 }}
                    type="url"
                    value={draft}
                  />
                  <Button
                    className="inbox-menu-save-button"
                    disabled={!draft.trim()}
                    loading={isSaving}
                    size="xs"
                    type="submit"
                  >
                    {t('링크 저장', 'Save link')}
                  </Button>
                </Group>
              </form>
            </Menu.Dropdown>
          </Menu>
          {inboxItems.length > 0 && (
            <SegmentedControl
              className="inbox-filter"
              data={[
                { label: t('전체', 'All'), value: 'all' },
                { label: t('좋아요', 'Liked'), value: 'liked' },
              ]}
              onChange={value => {
                setFilter(value as InboxFilter);
                setPage(1);
              }}
              size="xs"
              value={filter}
            />
          )}
        </Group>
      </div>

      <section className="inbox-grid">
        {/* 카드를 지우면 뒤 카드들이 순간이동해 격자가 다시 짜였다.
            layout="position"이 그 자리를 메우는 과정을 보여 준다 — 크기까지
            보간하면 고정 높이 카드 안의 썸네일이 늘어난다.
            AnimatePresence는 map 바깥에 둔다(docs/design.md). */}
        <AnimatePresence initial={false}>
        {paged.map(item => {
          const keywords = getInboxKeywords(item);
          const duration = formatDuration(item.duration);
          const oneLiner = item.summaryOneLiner ?? item.summary;
          const excerpt = item.thumbnailUrl ? null : item.summary ?? item.summaryOneLiner;
          const favicon = faviconUrlFor(item.domain);
          return (
            <Card
              className="inbox-card"
              component={motion.article}
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96 }
              }
              key={item.id}
              layout={shouldReduceMotion ? false : 'position'}
              padding="sm"
              radius="sm"
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.18, ease: 'easeOut' }
              }
              withBorder
            >
              <Card.Section>
                <div className={item.thumbnailUrl ? 'inbox-thumbnail' : 'inbox-thumbnail empty'}>
                  {item.thumbnailUrl ? (
                    <img
                      alt=""
                      referrerPolicy="no-referrer"
                      src={item.thumbnailUrl}
                    />
                  ) : excerpt ? (
                    <div className="inbox-thumbnail-text">{excerpt}</div>
                  ) : null}
                  {duration && <span className="inbox-duration">{duration}</span>}
                </div>
              </Card.Section>

              <div className="inbox-card-content">
                <div className="inbox-card-title">
                  <Text fw={600} fz="sm" lineClamp={2}>
                    {item.title ?? item.originalUrl ?? t('제목을 가져오는 중', 'Fetching title')}
                  </Text>
                </div>

                <div className="inbox-card-source">
                  {(item.channelTitle || item.domain) && (
                    <Group align="center" gap={4} wrap="nowrap">
                      {favicon && (
                        <img
                          alt=""
                          className="inbox-domain-favicon"
                          onError={event => {
                            event.currentTarget.style.display = 'none';
                          }}
                          referrerPolicy="no-referrer"
                          src={favicon}
                        />
                      )}
                      <Text c="dimmed" fz="xs" truncate>
                        {item.channelTitle ?? item.domain}
                      </Text>
                    </Group>
                  )}
                </div>

                <div className="inbox-card-summary">
                  {oneLiner && oneLiner !== excerpt && (
                    <Text fz="xs" lineClamp={2}>
                      {oneLiner}
                    </Text>
                  )}
                </div>

                {/* 웹 요약 패널(SourceDetailPane)과 같은 중성 칩. 같은 키워드가
                    화면마다 다른 색이면 같은 데이터로 보이지 않는다. */}
                <Group className="inbox-card-keywords" gap={4}>
                  {keywords.slice(0, CARD_KEYWORD_LIMIT).map(keyword => (
                    <Badge key={keyword} radius="sm" size="xs" variant="default">
                      {keyword}
                    </Badge>
                  ))}
                  {keywords.length > CARD_KEYWORD_LIMIT && (
                    <Badge radius="sm" size="xs" variant="default">
                      +{keywords.length - CARD_KEYWORD_LIMIT}
                    </Badge>
                  )}
                </Group>
              </div>

              {/* 삭제는 동작이라 hover에만, 좋아요는 상태라 눌린 것만 항상 보인다
                  — 목록에서 좋아요한 항목을 구분하려면 그래야 한다. */}
              <Group className="inbox-card-actions" gap={4} wrap="nowrap">
                <ActionIcon
                  aria-label={item.liked ? t('좋아요 취소', 'Unlike') : t('좋아요', 'Like')}
                  className={item.liked ? 'inbox-like liked' : 'inbox-like'}
                  onClick={() => onToggleLike(item.id, !item.liked)}
                  radius="sm"
                  variant="default"
                >
                  <Heart fill={item.liked ? 'currentColor' : 'none'} size={14} />
                </ActionIcon>
                <ActionIcon
                  aria-label={t('삭제', 'Delete')}
                  className="inbox-delete"
                  onClick={() => onDelete(item.id)}
                  radius="sm"
                  title={t('삭제', 'Delete')}
                  variant="default"
                >
                  <Trash2 size={14} />
                </ActionIcon>
              </Group>

              {/* 카드 전체를 덮는 열기 버튼. "자세히" 버튼 없이도 키보드와
                  스크린 리더가 카드에 닿게 하는 가장 단순한 방법이고, 내용에
                  버튼을 중첩시키지 않아 좋아요·삭제가 stopPropagation 없이
                  독립적으로 동작한다(z-index로 이 버튼보다 위에 둔다).

                  반드시 Card.Section 뒤에 와야 한다 — Mantine은 썸네일을
                  카드 끝까지 흘리는 음수 margin을 `:first-child`로 건다.
                  앞에 두면 썸네일 위에 흰 여백이 생긴다. */}
              <button
                aria-label={`${item.title ?? item.originalUrl ?? t('저장한 링크', 'Saved link')} ${t('자세히 보기', 'View details')}`}
                className="inbox-card-open"
                onClick={() => onOpenDetail(item)}
                type="button"
              />
            </Card>
          );
        })}
        </AnimatePresence>

        {/* 카드가 하나라도 있으면 그대로 두고 뒤에서 갱신한다. 자리표시자는
            보여 줄 것이 정말 아무것도 없을 때만 — 필터·검색은 `isLoading`을
            건드리지 않으므로 여기로 오지 않는다. */}
        {isLoading && inboxItems.length === 0 && (
          <InboxCardSkeleton count={PAGE_SIZE} />
        )}

        {!isLoading && inboxItems.length === 0 && (
          <EmptyState
            body={t(
              'Quick Subnota로 현재 페이지를 저장하거나 링크를 붙여넣어 보세요.',
              'Save the current page with Quick Subnota, or paste a link.',
            )}
            className="inbox-empty"
            title={t('저장한 링크가 여기 모입니다', 'Your saved links appear here')}
            tone="start"
          />
        )}

        {!isLoading && inboxItems.length > 0 && filtered.length === 0 && (
          <EmptyState
            body={
              normalizedQuery
                ? t(
                    '다른 키워드를 써 보거나 검색을 지워 전체를 보세요.',
                    'Try another keyword or clear the search to see all links.',
                  )
                : t('카드의 하트를 누르면 여기 모입니다.', 'Links you like appear here.')
            }
            className="inbox-empty"
            title={
              normalizedQuery
                ? language === 'en'
                  ? `No links match “${query.trim()}”`
                  : `‘${query.trim()}’와 맞는 링크가 없습니다`
                : t('좋아요한 링크가 없습니다', 'No liked links')
            }
            tone="result"
          />
        )}
      </section>

      {pageCount > 1 && (
        <Group justify="center" mt="md">
          <Pagination onChange={setPage} size="sm" total={pageCount} value={current} />
        </Group>
      )}
    </div>
  );
};

export default InboxWorkspace;
