/**
 * 미리보기 패널 — 쓰던 자리를 잃지 않고 참조를 확인하는 읽기 전용 표면.
 *
 * 왜 탭이 아닌가: ambient 추천이나 Topics 그래프처럼 "원본과 비교하려고"
 * 여는 경우, 새 탭으로 열면 보고 있던 것이 화면에서 사라진다. VS Code가
 * Go to Definition과 Peek을 나눈 것과 같은 구분이다.
 *
 * 왜 split 패널이 아닌가: 패널이 이미 2개면 3번째가 생겨 셋 다 좁아진다.
 * 이 패널은 `.app-shell` grid의 세 번째 컬럼이라 패널 개수와 무관하다.
 *
 * 읽기 전용인 이유: "미리보기"라는 성격을 분명히 하고, 편집·자동저장
 * 경로를 하나 더 만들지 않기 위해서다. 편집하려면 `새 탭으로 열기`로
 * 승격한다.
 */
import { useEffect, useRef } from 'react';

import type { MemoRow } from '../../types';
import type { InboxSession } from '../../services/backend/inboxService';
import type { NetworkSearchResult } from '../../services/backend/networkService';
import SourceDetailPane from '../memo/components/SourceDetailPane';
import { formatRelativeDay } from '../../lib/relativeDay';
import { findPreviewHighlight } from '../../lib/previewHighlight';

export interface PreviewPanelState {
  mode: 'detail' | 'list';
  result: NetworkSearchResult | null;
  results: NetworkSearchResult[];
}

interface PreviewPanelProps {
  inboxItems: InboxSession[];
  memos: MemoRow[];
  onClose: () => void;
  onPromote: (result: NetworkSearchResult) => void;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onSelectResult: (result: NetworkSearchResult) => void;
  onShowList: () => void;
  state: PreviewPanelState;
}

const resultTitle = (result: NetworkSearchResult, memos: MemoRow[]): string => {
  if (result.sourceKind === 'inbox') {
    return result.title ?? result.sourceLabel ?? '저장한 링크';
  }
  const memo = result.memoId
    ? memos.find(candidate => candidate.id === result.memoId)
    : null;
  const firstLine = (memo?.content ?? result.memoContent ?? '')
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);
  return firstLine || '제목 없는 노트';
};

const PreviewPanel = ({
  inboxItems,
  memos,
  onClose,
  onPromote,
  onResizeStart,
  onSelectResult,
  onShowList,
  state,
}: PreviewPanelProps) => {
  const markRef = useRef<HTMLElement | null>(null);

  // Esc로 닫는다. 바깥 클릭으로는 닫지 않는다 — 미리보기를 띄워둔 채로
  // 계속 글을 쓸 수 있어야 참조 기능이 성립한다.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: 'center' });
  }, [state.result?.chunkId]);

  const { mode, result, results } = state;
  const canGoBackToList = mode === 'detail' && results.length > 0;

  const renderDetail = () => {
    if (!result) {
      return <p className="preview-empty">표시할 내용이 없습니다.</p>;
    }

    if (result.sourceKind === 'inbox') {
      const item = inboxItems.find(
        candidate => candidate.id === result.inboxSessionId,
      );
      return item ? (
        <SourceDetailPane item={item} />
      ) : (
        <p className="preview-empty">저장한 링크를 찾을 수 없습니다.</p>
      );
    }

    const memo = result.memoId
      ? memos.find(candidate => candidate.id === result.memoId)
      : null;
    const content = memo?.content ?? result.memoContent ?? result.chunkText;
    const range = findPreviewHighlight(
      content,
      result.chunkText,
      result.startIndex,
      result.endIndex,
    );

    if (!range) {
      return <p className="preview-body">{content}</p>;
    }

    return (
      <p className="preview-body">
        {content.slice(0, range.start)}
        <mark className="preview-highlight" ref={markRef}>
          {content.slice(range.start, range.end)}
        </mark>
        {content.slice(range.end)}
      </p>
    );
  };

  const renderList = () => (
    <div className="preview-list">
      {results.map(item => (
        <button
          className="preview-list-row"
          key={`${item.sourceKind}:${item.chunkId}`}
          onClick={() => onSelectResult(item)}
          type="button"
        >
          <span className="preview-list-meta">
            {formatRelativeDay(item.memoCreatedAt ?? item.createdAt)}
            {item.sourceKind === 'inbox' ? ' · 저장한 링크' : ''}
          </span>
          <strong className="preview-list-text">{item.chunkText}</strong>
        </button>
      ))}
    </div>
  );

  return (
    <aside aria-label="미리보기" className="preview-panel">
      <div
        aria-hidden="true"
        className="preview-resizer"
        onPointerDown={onResizeStart}
      />
      <header className="preview-panel-header">
        {canGoBackToList ? (
          <button
            className="preview-back-btn"
            onClick={onShowList}
            title="목록으로"
            type="button"
          >
            ‹ 목록
          </button>
        ) : (
          <span className="preview-panel-title">
            {mode === 'list'
              ? `연결된 문장 ${results.length}개`
              : result
                ? resultTitle(result, memos)
                : '미리보기'}
          </span>
        )}
        <div className="preview-panel-actions">
          {mode === 'detail' && result && (
            <button
              className="preview-action-btn"
              onClick={() => onPromote(result)}
              title="새 탭으로 열기"
              type="button"
            >
              ⧉
            </button>
          )}
          <button
            className="preview-action-btn"
            onClick={onClose}
            title="닫기 (Esc)"
            type="button"
          >
            ✕
          </button>
        </div>
      </header>
      <div className="preview-panel-body">
        {mode === 'list' ? renderList() : renderDetail()}
      </div>
    </aside>
  );
};

export default PreviewPanel;
