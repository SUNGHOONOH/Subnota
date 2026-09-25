import type { InboxSession } from '../../../services/backend/inboxService';
import type { NetworkSearchResult } from '../../../services/local/memoSearchTypes';
import { getSourceLabel } from '../memoSplitWorkspaceUtils';
import SourceDetailPane from './SourceDetailPane';

export interface SourcePaneBodyProps {
  inboxItems: InboxSession[];
  language: 'en' | 'ko';
  onRetryInboxSummary: (item: InboxSession) => Promise<void>;
  result?: NetworkSearchResult;
  t: (korean: string, english: string) => string;
}

const SourcePaneBody = ({
  inboxItems,
  language,
  onRetryInboxSummary,
  result,
  t,
}: SourcePaneBodyProps) => {
  if (!result) {
    return (
      <div className="empty-source">
        <h4>{t('출처가 없습니다', 'No source selected')}</h4>
        <p>
          {t(
            '추천 결과를 클릭하면 요약 텍스트를 볼 수 있습니다.',
            'Select a recommendation to view its summary.',
          )}
        </p>
      </div>
    );
  }

  // 저장된 수집 항목을 찾으면 전체 요약 상세(키워드/썸네일/요약·상세 토글)를
  // 보여준다. 못 찾으면(과거 세션의 탭, 메모 청크) 기존 축약 뷰로 폴백.
  const inboxItem = result.inboxSessionId
    ? inboxItems.find((candidate) => candidate.id === result.inboxSessionId)
    : null;
  if (inboxItem) {
    return (
      <SourceDetailPane
        item={inboxItem}
        onRetrySummary={onRetryInboxSummary}
      />
    );
  }

  return (
    <div className="source-pane-content">
      <span className="source-kind">{getSourceLabel(result, language)}</span>
      <h3 className="source-title">
        {result.title ?? result.sourceLabel ?? t('저장한 링크', 'Saved link')}
      </h3>
      {result.sourceUrl && (
        <a
          href={result.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="source-url-link"
        >
          {result.sourceUrl}
        </a>
      )}
      <div className="source-summary-card">
        <h5>{t('추천에 사용된 요약', 'Summary used for this recommendation')}</h5>
        <p>{result.chunkText || t('요약이 없습니다.', 'No summary is available.')}</p>
      </div>
    </div>
  );
};

export default SourcePaneBody;
