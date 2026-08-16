'use client';

/* Quick Subnota — 떠 있는 빠른 기록 패널.
   원본은 desktop/src/features/mini/MiniComposer.tsx 와 MiniComposer.scss. */

import { ExternalLink, SubnotaMark, X } from './icons';

export function MiniComposer({
  text,
  caret = false,
  status,
  recent,
  showCaptureButton = true,
  pressing = false,
}: {
  text: string;
  caret?: boolean;
  status?: string;
  recent?: { source: string; text: string }[];
  /* macOS만 현재 페이지 저장을 내보낸다. Windows에서는 이 버튼이 빠진다. */
  showCaptureButton?: boolean;
  /* 저장 버튼이 눌리는 순간. 앱과 같은 0.96 누름 축소를 쓴다. */
  pressing?: boolean;
}) {
  return (
    <div className="mini-composer">
      <header className="mini-composer__header">
        <span className="mini-composer__brand">
          <SubnotaMark className="mini-composer__mark" size={15} />
          <span className="mini-composer__title">Quick Subnota</span>
        </span>
        <div className="mini-composer__header-actions">
          <ExternalLink size={15} />
          <X size={15} />
        </div>
      </header>
      <div className={text ? 'mini-composer__input' : 'mini-composer__input placeholder'}>
        {text || '떠오른 생각을 적어보세요…'}
        {caret && <span className="editor-caret" />}
      </div>
      <section aria-label="최근 링크" className="mini-composer__recent">
        {/* 두 저장 동작은 최근 링크 머리글과 같은 줄, 오른쪽 끝에 선다. */}
        <div className="mini-composer__recent-head">
          {recent && recent.length > 0 && (
            <div className="mini-composer__recent-title">최근 링크</div>
          )}
          <div className="mini-composer__actions">
            {showCaptureButton && (
              <span
                className="mini-composer__secondary"
                style={pressing ? { transform: 'scale(0.96)' } : undefined}
              >
                현재 페이지 저장
              </span>
            )}
            <span className="mini-composer__save">메모 저장</span>
          </div>
        </div>
        {recent?.map((item) => (
          <div className="mini-composer__recent-item" key={item.text}>
            <span className="mini-composer__recent-source">{item.source}</span>
            <span className="mini-composer__recent-text">{item.text}</span>
          </div>
        ))}
        <p className="mini-composer__status">{status}</p>
      </section>
    </div>
  );
}
