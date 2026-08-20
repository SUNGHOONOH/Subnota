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

/* 웹에서 보고 있던 페이지를 주워 담는 장면. Quick Subnota를 직접 입력창으로
   보여주지 않고, 현재 페이지 저장 → 요약이라는 실제 클리핑 흐름만 남긴다. */
export function WebClipPreview({
  pressing = false,
  status,
}: {
  pressing?: boolean;
  status?: string;
}) {
  return (
    <div aria-label="현재 페이지 저장 미리보기" className="web-clip-preview">
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
        <span className="web-clip-preview__eyebrow">현재 보고 있는 페이지</span>
        <strong>회의 전에 30분을 쓰면 회의가 절반이 된다</strong>
        <span className="web-clip-preview__meta">영상 · 14:22</span>
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
          현재 페이지 저장
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
  return (
    <article className={hovered ? 'inbox-card hovered' : 'inbox-card'}>
      <div className={item.excerpt ? 'inbox-thumbnail empty' : 'inbox-thumbnail'}>
        {item.excerpt && <div className="inbox-thumbnail-text">{item.excerpt}</div>}
        {item.duration && <span className="inbox-duration">{item.duration}</span>}
      </div>
      <div className="inbox-card-content">
        <div className="inbox-card-title">{item.title}</div>
        <div className="inbox-card-source">
          <span className="inbox-domain-favicon" style={{ background: '#e9e7e1' }} />
          {item.source}
        </div>
        <div className="inbox-card-summary">{item.summary}</div>
        <div className="inbox-card-keywords">
          {item.keywords.map((keyword) => (
            <span className="inbox-keyword" key={keyword}>
              {keyword}
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
  return (
    <div className="inbox-workspace">
      <div className="inbox-list-header">
        <div className="inbox-search-input">
          <Search size={13} />
          검색
        </div>
        <span className="split-action-btn">
          <MoreHorizontal size={16} />
        </span>
        <div className="inbox-filter">
          <span className="active">전체</span>
          <span>좋아요</span>
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
