/**
 * 미리보기 패널 — 쓰던 자리를 잃지 않고 참조를 확인하는 읽기 전용 표면.
 *
 * 왜 탭이 아닌가: ambient 추천이나 Topics 그래프처럼 "원본과 비교하려고"
 * 여는 경우, 새 탭으로 열면 보고 있던 것이 화면에서 사라진다. VS Code가
 * Go to Definition과 Peek을 나눈 것과 같은 구분이다.
 *
 * 왜 split 패널이 아닌가: 패널이 이미 2개면 3번째가 생겨 셋 다 좁아진다.
 * 이 패널은 앱 사이드 패널 슬롯(`.app-shell`의 마지막 grid 컬럼)에
 * 렌더링되므로 split 패널 개수와 무관하게 앱의 맨오른쪽에 선다.
 *
 * 읽기 전용인 이유: "미리보기"라는 성격을 분명히 하고, 편집·자동저장
 * 경로를 하나 더 만들지 않기 위해서다. 편집하려면 `새 탭으로 열기`로
 * 승격한다.
 */
import { useEffect, useRef } from 'react';

import type { MemoRow } from '../../types';
import type { InboxSession } from '../../services/backend/inboxService';
import type { NetworkSearchResult } from '../../services/backend/networkService';
import { PanelRightClose } from '../../components/icons';
import TooltipIconButton from '../../components/TooltipIconButton';
import SourceDetailPane from '../memo/components/SourceDetailPane';
import { formatRelativeDay } from '../../lib/relativeDay';
import { findPreviewHighlight } from '../../lib/previewHighlight';
import EmptyState from '../../components/EmptyState';
import { localize, useUiLanguage } from '../../lib/uiLanguage';

export interface PreviewPanelState {
  /**
   * 목록을 불러오지 못했을 때의 문구. ⌘⏎는 "패널을 열어 달라"는 요청이라
   * 실패도 패널 안에서 답해야 한다 — 편집기로 시선을 되돌리면 사용자는
   * 열리지 않은 패널을 기다리게 된다.
   */
  error?: string;
  isAmbientList?: boolean;
  mode: 'detail' | 'list';
  promotionTooltip?: string;
  result: NetworkSearchResult | null;
  results: NetworkSearchResult[];
  showMoreResults?: boolean;
}

interface PreviewPanelProps {
  inboxItems: InboxSession[];
  memos: MemoRow[];
  onClose: () => void;
  onCollapse?: () => void;
  onPromote: (result: NetworkSearchResult) => void;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  onRetryInboxSummary: (item: InboxSession) => Promise<void>;
  onRetry?: () => void;
  onSelectResult: (result: NetworkSearchResult) => void;
  onShowMoreResults?: () => void;
  onShowList: () => void;
  state: PreviewPanelState;
}

const resultTitle = (
  result: NetworkSearchResult,
  memos: MemoRow[],
  language: 'en' | 'ko',
): string => {
  if (result.sourceKind === 'inbox') {
    return (
      result.title ?? result.sourceLabel ?? localize(language, '저장한 링크', 'Saved link')
    );
  }
  const memo = result.memoId
    ? memos.find(candidate => candidate.id === result.memoId)
    : null;
  const firstLine = (memo?.content ?? result.memoContent ?? '')
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);
  return firstLine || localize(language, '제목 없는 노트', 'Untitled note');
};

const isSameDay = (left: number, right: number) => {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
};

const resultMetadata = (
  result: NetworkSearchResult,
  inboxItems: InboxSession[],
  language: 'en' | 'ko',
) => {
  if (result.sourceKind === 'inbox') {
    const item = inboxItems.find(candidate => candidate.id === result.inboxSessionId);
    const source =
      item?.channelTitle ??
      item?.domain ??
      result.sourceLabel ??
      localize(language, '저장한 링크', 'Saved link');
    const savedAt = result.createdAt ?? (item?.createdAt ? Date.parse(item.createdAt) : null);
    const saved = formatRelativeDay(savedAt, undefined, language);
    return [source, saved && localize(language, `저장 ${saved}`, `Saved ${saved}`)]
      .filter(Boolean)
      .join(' · ');
  }

  const createdAt = result.memoCreatedAt ?? result.createdAt;
  const updatedAt = result.memoUpdatedAt;
  const created = formatRelativeDay(createdAt, undefined, language);
  const updated =
    updatedAt != null && (createdAt == null || !isSameDay(createdAt, updatedAt))
      ? formatRelativeDay(updatedAt, undefined, language)
      : '';
  return [
    localize(language, '메모', 'Note'),
    created && localize(language, `작성 ${created}`, `Created ${created}`),
    updated && localize(language, `수정 ${updated}`, `Updated ${updated}`),
  ]
    .filter(Boolean)
    .join(' · ');
};

const PreviewPanel = ({
  inboxItems,
  memos,
  onClose,
  onCollapse,
  onPromote,
  onResizeStart,
  onRetryInboxSummary,
  onRetry,
  onSelectResult,
  onShowMoreResults,
  onShowList,
  state,
}: PreviewPanelProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
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

  const {
    error,
    isAmbientList = false,
    mode,
    promotionTooltip,
    result,
    results,
    showMoreResults,
  } =
    state;
  // Ambient의 top-1 상세는 목록을 아직 불러오지 않았으므로 되돌아갈 곳이
  // 없다. 목록에서 선택한 항목은 결과가 하나여도 목록으로 돌아갈 수 있다.
  // 웹 요약(저장한 링크)은 읽는 화면 자체가 목적이라 목록 버튼을 두지 않는다.
  const canGoBackToList =
    isAmbientList &&
    mode === 'detail' &&
    results.length > 0 &&
    !showMoreResults &&
    result?.sourceKind !== 'inbox';

  const renderDetail = () => {
    if (!result) {
      return <EmptyState title={t('표시할 내용이 없습니다', 'Nothing to display')} />;
    }

    if (result.sourceKind === 'inbox') {
      const item = inboxItems.find(
        candidate => candidate.id === result.inboxSessionId,
      );
      // 그래프에는 노드가 남아 있는데 원본이 사라진 경우다. 불러오다 실패한
      // 것이 아니라 가리킬 대상이 없는 것이라 다시 시도할 거리가 없다.
      return item ? (
        <SourceDetailPane item={item} onRetrySummary={onRetryInboxSummary} />
      ) : (
        <EmptyState
          body={t(
            '이 기기에 아직 동기화되지 않았을 수도 있습니다.',
            'It may not have synced to this device yet.',
          )}
          title={t('삭제된 링크입니다', 'This link was deleted')}
        />
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
          <span className="preview-list-meta">{resultMetadata(item, inboxItems, language)}</span>
          <strong className="preview-list-text">{item.chunkText}</strong>
        </button>
      ))}
    </div>
  );

  return (
    <aside aria-label={t('미리보기', 'Preview')} className="preview-panel">
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
            title={t('목록으로', 'Back to list')}
            type="button"
          >
            ‹ {t('목록', 'List')}
          </button>
        ) : (
          <div className="preview-panel-heading">
            <span className="preview-panel-title">
              {error
                ? t('연결된 문장', 'Related sentences')
                : mode === 'list'
                  ? language === 'en'
                    ? `${results.length} related sentences`
                    : `연결된 문장 ${results.length}개`
                  : result
                    ? resultTitle(result, memos, language)
                    : t('미리보기', 'Preview')}
            </span>
            {mode === 'detail' && result && (
              <span className="preview-panel-metadata">
                <span className="preview-panel-metadata-text">
                  {resultMetadata(result, inboxItems, language)}
                </span>
                {result.similarity > 0 && (
                  <span className="preview-panel-similarity">
                    {t('유사도', 'Similarity')} {Math.round(result.similarity * 100)}%
                  </span>
                )}
              </span>
            )}
          </div>
        )}
        <div className="preview-panel-actions">
          {mode === 'detail' && showMoreResults && onShowMoreResults && (
            <button
              className="preview-more-results-btn preview-more-results-header"
              onClick={onShowMoreResults}
              type="button"
            >
              {t('결과 더보기', 'More results')}
            </button>
          )}
          {onCollapse && (
            <TooltipIconButton
              aria-label={t('사이드 패널 접기', 'Collapse side panel')}
              className="preview-action-btn side-panel-collapse-action"
              onClick={onCollapse}
              tooltip={t('사이드 패널 접기', 'Collapse side panel')}
            >
              <PanelRightClose size={16} />
            </TooltipIconButton>
          )}
          {mode === 'detail' && result && (
            <TooltipIconButton
              aria-label={promotionTooltip ?? t('새 탭으로 열기', 'Open in a new tab')}
              className="preview-action-btn"
              onClick={() => onPromote(result)}
              tooltip={promotionTooltip ?? t('새 탭으로 열기', 'Open in a new tab')}
            >
              ⧉
            </TooltipIconButton>
          )}
          <TooltipIconButton
            aria-label={t('미리보기 닫기', 'Close preview')}
            className="preview-action-btn"
            onClick={onClose}
            tooltip={t('닫기 (Esc)', 'Close (Esc)')}
          >
            ✕
          </TooltipIconButton>
        </div>
      </header>
      <div className="preview-panel-body">
        {error ? (
          <div className="preview-error">
            <p>{error}</p>
            {onRetry && (
              <button onClick={onRetry} type="button">
                {t('다시 시도', 'Try again')}
              </button>
            )}
          </div>
        ) : mode === 'list' ? (
          renderList()
        ) : (
          renderDetail()
        )}
      </div>
    </aside>
  );
};

export default PreviewPanel;
