'use client';

/* 수집함 — 검색줄 + 카드 격자.
   원본은 desktop/src/features/inbox/InboxWorkspace.tsx. */

import { Heart, MoreHorizontal, Search, Trash2 } from './icons';

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
