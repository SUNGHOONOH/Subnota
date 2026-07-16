import { FormEvent, useState } from 'react';
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
import { Heart, MoreHorizontal, RefreshCw, Search } from '@/components/icons';

import { InboxSession } from '../../services/backend/inboxService';
import { faviconUrlFor } from '../../lib/favicon';

interface InboxWorkspaceProps {
  inboxItems: InboxSession[];
  isLoading: boolean;
  onOpenDetail: (item: InboxSession) => void;
  onRefresh: () => void;
  onSaveUrl: (url: string) => Promise<void>;
  onToggleLike: (id: string, liked: boolean) => void;
}

type InboxFilter = 'all' | 'liked';

const PAGE_SIZE = 6;
const CARD_KEYWORD_LIMIT = 4;

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
    ...item.keywords,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
};

const InboxWorkspace = ({
  inboxItems,
  isLoading,
  onOpenDetail,
  onRefresh,
  onSaveUrl,
  onToggleLike,
}: InboxWorkspaceProps) => {
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
      {/* 노션 웹클리퍼식 상단 바 — [검색 / ⋯ / 전체·좋아요]. 링크 저장과
          새로고침은 부가 기능이라 ⋯ 메뉴 안으로. */}
      <div className="inbox-list-header">
        <strong>최근 수집함</strong>
        <Group gap={8} wrap="nowrap">
          <TextInput
            className="inbox-search-input"
            leftSection={<Search size={13} />}
            onChange={event => {
              setQuery(event.currentTarget.value);
              setPage(1);
            }}
            placeholder="검색"
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
                aria-label="더보기"
                color="gray"
                size="md"
                title="더보기"
                variant="subtle"
              >
                <MoreHorizontal size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>새 링크 저장</Menu.Label>
              <form className="inbox-new-form" onSubmit={submit}>
                <Group gap={8} wrap="nowrap">
                  <TextInput
                    autoFocus
                    onChange={event => setDraft(event.currentTarget.value)}
                    placeholder="링크 붙여넣기"
                    size="xs"
                    style={{ flex: 1 }}
                    type="url"
                    value={draft}
                  />
                  <Button
                    disabled={!draft.trim()}
                    loading={isSaving}
                    size="xs"
                    type="submit"
                  >
                    저장
                  </Button>
                </Group>
              </form>
              <Menu.Divider />
              <Menu.Item
                disabled={isLoading}
                leftSection={<RefreshCw size={13} />}
                onClick={onRefresh}
              >
                새로고침
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          {inboxItems.length > 0 && (
            <SegmentedControl
              data={[
                { label: '전체', value: 'all' },
                { label: '좋아요', value: 'liked' },
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
        {paged.map(item => {
          const duration = formatDuration(item.duration);
          const oneLiner = item.summaryOneLiner ?? item.summary;
          const excerpt = item.thumbnailUrl ? null : item.summary ?? item.summaryOneLiner;
          const favicon = faviconUrlFor(item.domain);
          return (
            <Card className="inbox-card" key={item.id} padding="md" radius="md" withBorder>
              <Card.Section>
                <div className={item.thumbnailUrl ? 'inbox-thumbnail' : 'inbox-thumbnail empty'}>
                  {item.thumbnailUrl ? (
                    <img alt="" src={item.thumbnailUrl} />
                  ) : excerpt ? (
                    <div className="inbox-thumbnail-text">{excerpt}</div>
                  ) : null}
                  {duration && <span className="inbox-duration">{duration}</span>}
                </div>
              </Card.Section>

              <Text fw={500} fz="lg" lineClamp={2} mt="md">
                {item.title ?? item.originalUrl ?? '제목을 가져오는 중'}
              </Text>
              {(item.channelTitle || item.domain) && (
                <Group align="center" gap={5} mt={2} wrap="nowrap">
                  {favicon && (
                    <img
                      alt=""
                      className="inbox-domain-favicon"
                      onError={event => {
                        event.currentTarget.style.display = 'none';
                      }}
                      src={favicon}
                    />
                  )}
                  <Text c="dimmed" fz="xs" truncate>
                    {item.channelTitle ?? item.domain}
                  </Text>
                </Group>
              )}
              {oneLiner && oneLiner !== excerpt && (
                <Text fz="sm" lineClamp={2} mt="xs">
                  {oneLiner}
                </Text>
              )}
              {item.keywords.length > 0 && (
                <Group gap={7} mt="sm">
                  {item.keywords.slice(0, CARD_KEYWORD_LIMIT).map(keyword => (
                    <Badge key={keyword} size="sm" variant="light">
                      {keyword}
                    </Badge>
                  ))}
                  {item.keywords.length > CARD_KEYWORD_LIMIT && (
                    <Badge color="gray" size="sm" variant="light">
                      +{item.keywords.length - CARD_KEYWORD_LIMIT}
                    </Badge>
                  )}
                </Group>
              )}
              <Group gap="xs" mt="md" wrap="nowrap">
                <Button
                  onClick={() => onOpenDetail(item)}
                  radius="md"
                  size="sm"
                  style={{ flex: 1 }}
                >
                  자세히
                </Button>
                <ActionIcon
                  aria-label={item.liked ? '좋아요 취소' : '좋아요'}
                  className="inbox-like"
                  onClick={() => onToggleLike(item.id, !item.liked)}
                  radius="md"
                  size={36}
                  variant="default"
                >
                  <Heart fill={item.liked ? 'currentColor' : 'none'} size={18} />
                </ActionIcon>
              </Group>
            </Card>
          );
        })}

        {!isLoading && inboxItems.length === 0 && (
          <div className="empty-panel">
            <strong>아쉽게도 아직 아무것도 없네요.</strong>
            <p style={{ fontSize: '12px' }}>Mini Subnota를 통해 수집해오거나 링크를 직접 붙여넣어보세요.</p>
          </div>
        )}

        {!isLoading && inboxItems.length > 0 && filtered.length === 0 && (
          <div className="empty-panel">
            <strong>
              {normalizedQuery ? '검색 결과가 없습니다.' : '좋아요한 항목이 없습니다.'}
            </strong>
            <p style={{ fontSize: '12px' }}>
              {normalizedQuery
                ? '다른 키워드로 검색해보세요.'
                : '카드의 하트를 눌러 좋아요를 표시해보세요.'}
            </p>
          </div>
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
