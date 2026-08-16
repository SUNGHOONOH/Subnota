'use client';

/* 앱 사이드 패널 — 미리보기와 일정 저장함.
   원본은 desktop/src/features/preview/PreviewPanel.tsx 와
   desktop/src/features/schedule/ScheduleInboxWorkspace.tsx.

   스플릿 패널과 구분되는 신호는 넷이다: 헤어라인 테두리, 왼쪽으로 지는 그림자,
   탭 스트립 없음, 캐럿 없음. 그중 탭 스트립이 없다는 것이 가장 강한 신호다. */

import type { ReactNode } from 'react';
import { PanelRightClose, X } from './icons';

export function PreviewPanel({
  title,
  metadata,
  similarity,
  body,
  highlight,
}: {
  title: string;
  metadata: string;
  similarity?: string;
  /* 본문. highlight 문자열이 들어 있으면 그 부분만 표시가 남는다. */
  body: string;
  highlight?: string;
}) {
  const [before, after] = highlight
    ? (() => {
        const index = body.indexOf(highlight);
        return index === -1
          ? [body, '']
          : [body.slice(0, index), body.slice(index + highlight.length)];
      })()
    : [body, ''];

  return (
    <aside aria-label="미리보기" className="preview-panel">
      <header className="preview-panel-header">
        <div className="preview-panel-heading">
          <span className="preview-panel-title">{title}</span>
          <span className="preview-panel-metadata">
            <span className="preview-panel-metadata-text">{metadata}</span>
            {similarity && (
              <span className="preview-panel-similarity">{similarity}</span>
            )}
          </span>
        </div>
        <div className="preview-panel-actions">
          <span className="preview-action-btn">
            <PanelRightClose size={16} />
          </span>
          <span className="preview-action-btn">
            <X size={16} />
          </span>
        </div>
      </header>
      {/* 읽으라고 있는 표면이라 글자를 흐리게 하지 않는다. */}
      <div className="preview-panel-body">
        <p className="preview-body">
          {before}
          {highlight && <mark className="preview-highlight">{highlight}</mark>}
          {after}
        </p>
      </div>
    </aside>
  );
}

export interface ScheduleCandidate {
  id: string;
  meta: string;
  text: string;
  dragging?: boolean;
}

export function ScheduleInboxPanel({
  items,
  footer,
}: {
  items: ScheduleCandidate[];
  footer?: ReactNode;
}) {
  return (
    <aside aria-label="일정 저장함" className="schedule-inbox-panel">
      <header className="schedule-inbox-panel-header">
        <span className="schedule-inbox-panel-title">일정 저장함</span>
        <div className="preview-panel-actions">
          <span className="preview-action-btn">
            <X size={16} />
          </span>
        </div>
      </header>
      <div className="schedule-approve-list">
        {items.map((item) => (
          <div
            className={
              item.dragging
                ? 'schedule-approve-row dragging'
                : 'schedule-approve-row'
            }
            key={item.id}
          >
            <span className="schedule-approve-meta">{item.meta}</span>
            <span className="schedule-approve-text">{item.text}</span>
          </div>
        ))}
      </div>
      {footer}
    </aside>
  );
}
