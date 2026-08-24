'use client';

/* 수집함 — 검색줄 + 카드 격자.
   원본은 desktop/src/features/inbox/InboxWorkspace.tsx. */

import {
  ExternalLink,
  Heart,
  MoreHorizontal,
  Search,
  SubnotaMark,
  Trash2,
} from './icons';
import { useText } from '../lib/i18n';

export interface InboxItem {
  id: string;
  title: string;
  source: string;
  summary?: string;
  keywords: string[];
  duration?: string;
  liked?: boolean;
  /* 썸네일이 없으면 요약 발췌가 그 자리를 대신한다. */
  excerpt?: string;
  loading?: boolean;
}

const INBOX_TEXT_EN: Record<string, string> = {
  '검색 결과를 목록으로 던져 주는 대신, 사용자가 지금 하고 있는 일 옆에 필요한 것만 조용히 놓아 두는 방식에 관하여.': 'A different approach to search: quietly place only what the user needs beside the work at hand.',
  '검색을 별도 화면이 아니라 작업 흐름 안에 두는 사례들을 정리한 글.': 'Examples of keeping search inside the work flow instead of sending it to a separate screen.',
  '맥락 안에서 검색하기 — 결과 목록을 넘어서': 'Searching in context — beyond the results list',
  '회의를 짧게 만드는 것보다 회의 전에 무엇을 정리해 두는지가 더 큰 차이를 만든다는 이야기.': 'A story about how preparing before a meeting makes a bigger difference than making the meeting shorter.',
  '회의 전 준비 문서 하나가 회의 시간을 절반으로 줄인 팀의 기록.': 'A record of a team that cut meeting time in half with one prep document.',
  '회의 전에 30분을 쓰면 회의가 절반이 된다': 'How 30 minutes before the meeting cuts it in half',
  검색: 'Search',
  전체: 'All',
  좋아요: 'Liked',
};

const localizeInboxText = (value: string, translate: ReturnType<typeof useText>) =>
  translate(value, INBOX_TEXT_EN[value] ?? value);

/* 웹에서 보고 있던 페이지를 주워 담는 장면. Quick Subnota를 직접 입력창으로
   보여주지 않고, 현재 페이지 저장 → 요약이라는 실제 클리핑 흐름만 남긴다. */
export function WebClipPreview({
  pressing = false,
  status,
}: {
  pressing?: boolean;
  status?: string;
}) {
  const translate = useText();

  return (
    <div aria-label={translate('현재 페이지 저장 미리보기', 'Save current page preview')} className="web-clip-preview">
      <div className="web-clip-preview__browser">
        <span aria-hidden="true" className="web-clip-preview__dots">
          <i />
          <i />
          <i />
        </span>
        <span className="web-clip-preview__domain">youtube.com</span>
        <ExternalLink size={12} />
      </div>
      <div className="web-clip-preview__content">
        <span className="web-clip-preview__eyebrow">{translate('현재 보고 있는 페이지', 'Current page')}</span>
        <strong>{translate('회의 전에 30분을 쓰면 회의가 절반이 된다', 'How 30 minutes before the meeting cuts it in half')}</strong>
        <span className="web-clip-preview__meta">{translate('영상 · 14:22', 'Video · 14:22')}</span>
      </div>
      <div className="web-clip-preview__footer">
        <span className="web-clip-preview__brand">
          <SubnotaMark size={14} />
          Subnota
        </span>
        <span
          className={
            pressing
              ? 'web-clip-preview__action web-clip-preview__action--pressed'
              : 'web-clip-preview__action'
          }
        >
          {translate('현재 페이지 저장', 'Save current page')}
        </span>
      </div>
      <p className="web-clip-preview__status">{status}</p>
    </div>
  );
}

export function InboxCard({
  item,
  hovered = false,
}: {
  item: InboxItem;
  hovered?: boolean;
}) {
  const translate = useText();
  const isYouTube = item.source === 'YouTube';

  return (
    <article className={hovered ? 'inbox-card hovered' : 'inbox-card'}>
      <div
        className={
          isYouTube
            ? 'inbox-thumbnail inbox-thumbnail-youtube'
            : item.excerpt
              ? 'inbox-thumbnail empty'
              : 'inbox-thumbnail'
        }
      >
        {isYouTube ? (
          <svg aria-hidden="true" className="inbox-youtube-mark" viewBox="0 0 68 48">
            <rect fill="#ff0000" height="48" rx="11" width="68" />
            <path d="M27 14.5 45 24 27 33.5V14.5Z" fill="#fff" />
          </svg>
        ) : item.excerpt ? (
          <div className="inbox-thumbnail-text">{item.excerpt && localizeInboxText(item.excerpt, translate)}</div>
        ) : null}
        {item.duration && <span className="inbox-duration">{item.duration}</span>}
      </div>
      <div className="inbox-card-content">
        <div className="inbox-card-title">{localizeInboxText(item.title, translate)}</div>
        <div className="inbox-card-source">
          <span className="inbox-domain-favicon" style={{ background: '#e9e7e1' }} />
          {item.source}
        </div>
        <div className="inbox-card-summary">{item.summary && localizeInboxText(item.summary, translate)}</div>
        <div className="inbox-card-keywords">
          {item.keywords.map((keyword) => (
            <span className="inbox-keyword" key={keyword}>
              {localizeInboxText(keyword, translate)}
            </span>
          ))}
        </div>
      </div>
      {/* 삭제는 동작이라 hover에만, 좋아요는 상태라 눌린 것만 항상 보인다.
          장식용 화면이라 실제 button 을 두지 않는다 — 이름 없는 버튼이 탭
          순서에 카드 수만큼 끼어든다. */}
      <div className="inbox-card-actions">
        <span className={item.liked ? 'liked' : undefined}>
          <Heart size={14} />
        </span>
        <span>
          <Trash2 size={14} />
        </span>
      </div>
    </article>
  );
}

/* 자리표시자는 들어올 데이터 수만큼만 그린다. 화면 높이에 맞추면 오지 않을
   행까지 약속하게 되어 로딩이 끝나면 격자가 줄어든다. */
export function InboxCardSkeleton() {
  return (
    <article className="inbox-card">
      <div className="inbox-thumbnail empty" />
      <div className="inbox-card-content">
        <span className="inbox-skeleton-line" style={{ width: '86%' }} />
        <span className="inbox-skeleton-line" style={{ width: '54%' }} />
        <span className="inbox-skeleton-line" style={{ width: '72%' }} />
      </div>
    </article>
  );
}

export function InboxWorkspace({
  items,
  hoveredId,
  skeletonCount = 0,
}: {
  items: InboxItem[];
  hoveredId?: string;
  skeletonCount?: number;
}) {
  const translate = useText();

  return (
    <div className="inbox-workspace">
      <div className="inbox-list-header">
        <div className="inbox-search-input">
          <Search size={13} />
          {translate('검색', 'Search')}
        </div>
        <span className="split-action-btn">
          <MoreHorizontal size={16} />
        </span>
        <div className="inbox-filter">
          <span className="active">{translate('전체', 'All')}</span>
          <span>{translate('좋아요', 'Liked')}</span>
        </div>
      </div>
      <div className="inbox-grid">
        {items.map((item) => (
          <InboxCard hovered={item.id === hoveredId} item={item} key={item.id} />
        ))}
        {Array.from({ length: skeletonCount }, (_, index) => (
          <InboxCardSkeleton key={`skeleton-${index}`} />
        ))}
      </div>
    </div>
  );
}
