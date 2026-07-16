import { useState } from 'react';
import { Anchor, Badge, Group, SegmentedControl } from '@mantine/core';

import { InboxSession } from '../../../services/backend/inboxService';
import { faviconUrlFor } from '../../../lib/favicon';

const KEYWORD_LIMIT = 5;

// 웹 요약 탭 본문 — 수집함 카드의 "자세히"와 Topics/Network 링크 노드 클릭이
// 공유하는 리더 스타일 단일 컬럼. [요약/상세] 토글은 항상 노출하고, 없는
// 쪽을 고르면 준비 중 안내를 보여준다.
const SourceDetailPane = ({ item }: { item: InboxSession }) => {
  const summaryText = item.summaryOneLiner ?? item.summary;
  const detailText = item.summaryDetail;
  const [view, setView] = useState<'summary' | 'detail'>(
    summaryText ? 'summary' : 'detail',
  );

  const sourceUrl = item.canonicalUrl ?? item.originalUrl;
  const origin = item.channelTitle ?? item.domain;
  const favicon = faviconUrlFor(item.domain);

  return (
    <article className="source-reader">
      {(favicon || origin) && (
        <div className="source-reader-meta">
          {favicon && (
            <img
              alt=""
              className="source-reader-favicon"
              onError={event => {
                event.currentTarget.style.display = 'none';
              }}
              src={favicon}
            />
          )}
          {origin && <span>{origin}</span>}
        </div>
      )}
      <h2 className="source-reader-title">
        {item.title ?? sourceUrl ?? '수집한 링크'}
      </h2>
      {sourceUrl && (
        <Anchor
          className="source-reader-url"
          href={sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          {sourceUrl}
        </Anchor>
      )}
      {item.keywords.length > 0 && (
        <Group className="source-reader-keywords" gap={6}>
          {item.keywords.slice(0, KEYWORD_LIMIT).map(keyword => (
            <Badge
              className="source-reader-keyword"
              key={keyword}
              radius="sm"
              size="sm"
              variant="default"
            >
              {keyword}
            </Badge>
          ))}
          {item.keywords.length > KEYWORD_LIMIT && (
            <Badge
              className="source-reader-keyword"
              radius="sm"
              size="sm"
              variant="default"
            >
              +{item.keywords.length - KEYWORD_LIMIT}
            </Badge>
          )}
        </Group>
      )}
      {item.thumbnailUrl && (
        <img alt="" className="source-reader-thumbnail" src={item.thumbnailUrl} />
      )}
      <SegmentedControl
        className="source-reader-toggle"
        data={[
          { label: '요약', value: 'summary' },
          { label: '상세', value: 'detail' },
        ]}
        onChange={value => setView(value as 'summary' | 'detail')}
        size="xs"
        value={view}
      />
      <div className="source-reader-body">
        {view === 'summary' ? (
          summaryText ? (
            <p>{summaryText}</p>
          ) : (
            <p className="source-reader-pending">요약을 준비하고 있습니다.</p>
          )
        ) : detailText ? (
          <pre>{detailText}</pre>
        ) : (
          <p className="source-reader-pending">상세 요약을 준비하고 있습니다.</p>
        )}
      </div>
    </article>
  );
};

export default SourceDetailPane;
