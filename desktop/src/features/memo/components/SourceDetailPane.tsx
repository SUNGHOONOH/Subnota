import { useState } from 'react';
import {
  Anchor,
  Badge,
  Group,
  SegmentedControl,
  Skeleton,
  VisuallyHidden,
} from '@mantine/core';

import { InboxSession } from '../../../services/backend/inboxService';
import { faviconUrlFor } from '../../../lib/favicon';
import EmptyState from '../../../components/EmptyState';
import { localize, useUiLanguage } from '../../../lib/uiLanguage';

const KEYWORD_LIMIT = 5;
const BODY_SKELETON_LINES = ['96%', '91%', '98%', '64%'];

// 본문 자리표시자는 `summaryStatus === 'pending'`일 때만 쓴다. "요약이 아직
// 없다"와 "요약을 만드는 중이다"는 다른 상태고, 가짜 로딩을 만들어 둘을
// 뭉개면 영영 오지 않을 요약을 기다리게 된다.
const SummaryBodySkeleton = () => (
  <div aria-hidden="true" className="source-reader-skeleton">
    {BODY_SKELETON_LINES.map((width, index) => (
      <Skeleton
        className="subnota-skeleton"
        height={11}
        key={index}
        radius="sm"
        width={width}
      />
    ))}
  </div>
);

// 웹 요약 탭 본문 — 수집함 카드의 "자세히"와 Topics/Network 링크 노드 클릭이
// 공유하는 리더 스타일 단일 컬럼. [요약/상세] 토글은 항상 노출한다.
interface SourceDetailPaneProps {
  item: InboxSession;
  onRetrySummary?: (item: InboxSession) => Promise<void>;
}

const SourceDetailPane = ({ item, onRetrySummary }: SourceDetailPaneProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const summaryText = item.summaryOneLiner ?? item.summary;
  const detailText = item.summaryDetail;
  const [view, setView] = useState<'summary' | 'detail'>(
    summaryText ? 'summary' : 'detail',
  );
  const [isRetrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  const isSummaryPending = item.summaryStatus === 'pending';
  const isSummaryFailed = item.summaryStatus === 'failed';

  const sourceUrl = item.canonicalUrl ?? item.originalUrl;
  const origin = item.channelTitle ?? item.domain;
  const favicon = faviconUrlFor(item.domain);

  const retrySummary = async () => {
    if (!onRetrySummary || isRetrying) return;

    setRetrying(true);
    setRetryFailed(false);
    try {
      await onRetrySummary(item);
    } catch {
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  };

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
              referrerPolicy="no-referrer"
              src={favicon}
            />
          )}
          {origin && <span>{origin}</span>}
        </div>
      )}
      <h2 className="source-reader-title">
        {item.title ?? sourceUrl ?? t('수집한 링크', 'Saved link')}
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
        <img
          alt=""
          className="source-reader-thumbnail"
          referrerPolicy="no-referrer"
          src={item.thumbnailUrl}
        />
      )}
      <SegmentedControl
        className="source-reader-toggle"
        data={[
          { label: t('요약', 'Summary'), value: 'summary' },
          { label: t('상세', 'Details'), value: 'detail' },
        ]}
        onChange={value => setView(value as 'summary' | 'detail')}
        size="xs"
        value={view}
      />
      <div className="source-reader-body">
        {view === 'summary' && summaryText && <p>{summaryText}</p>}
        {view === 'detail' && detailText && <pre>{detailText}</pre>}
        {!(view === 'summary' ? summaryText : detailText) &&
          (isSummaryPending ? (
            <>
              <SummaryBodySkeleton />
              <VisuallyHidden role="status">
                {t('요약을 만드는 중', 'Creating summary')}
              </VisuallyHidden>
            </>
          ) : isSummaryFailed ? (
            <div className="source-reader-failed" role="status">
              <EmptyState
                body={
                  retryFailed
                    ? t('잠시 뒤 다시 시도해 주세요.', 'Please try again shortly.')
                    : t('원본 링크는 그대로 보관되어 있습니다.', 'The original link is still saved.')
                }
                className="source-reader-failed-empty"
                title={
                  retryFailed
                    ? t('요약을 다시 만들지 못했습니다', 'Could not create the summary again')
                    : t('요약을 만들지 못했습니다', 'Could not create the summary')
                }
                tone="result"
              />
              {onRetrySummary && (
                <button
                  className="source-reader-retry"
                  disabled={isRetrying}
                  onClick={() => void retrySummary()}
                  type="button"
                >
                  {isRetrying
                    ? t('요약 다시 만드는 중…', 'Creating summary again…')
                    : t('요약 다시 시도', 'Try summary again')}
                </button>
              )}
            </div>
          ) : (
            <p className="source-reader-pending">
              {view === 'summary'
                ? t('요약이 없습니다.', 'No summary is available.')
                : t('상세 요약이 없습니다.', 'No detailed summary is available.')}
            </p>
          ))}
      </div>
    </article>
  );
};

export default SourceDetailPane;
