import { X } from '../../components/icons';
import { localize, useUiLanguage } from '../../lib/uiLanguage';
import type { LocalMemoIndexProgress } from '../../services/local/localMemoIndexer';

const megabytes = (bytes: number) => Math.round(bytes / 1_000_000);

export const isEmptyLocalIndexCompletion = (
  progress: LocalMemoIndexProgress,
) => progress.stage === 'complete' && progress.totalChunks === 0;

// 표시 여부는 "어느 단계인가"가 아니라 "누가 시켰는가"로 정한다.
export const shouldShowLocalIndexProgress = (
  progress: LocalMemoIndexProgress,
) => {
  // blur 정리와 자동 ambient 검색은 사용자가 요청한 적이 없다. 성공도
  // 실패도 조용히 지나간다 — 실패는 다음 요청에서 다시 드러난다.
  if (!progress.isVisible) return false;
  // 첫 준비(모델 받기 + 전체 색인)는 오래 걸린다. 완료와 실패까지 남겨
  // 사용자가 끝난 시점과 복구 시점을 알게 한다.
  if (progress.isInitialIndex) return true;
  // 버튼을 눌러 일어난 짧은 증분 색인. preparing은 할 일이 없을 때도
  // 발행돼 깜빡이고, complete는 검색 결과가 곧 대신 알려 준다.
  return progress.stage !== 'preparing' && progress.stage !== 'complete';
};

// 진행 중에는 이 문장 하나만 보여 준다. "색인", "모델", "청크", "로컬"은
// 전부 내부 용어라 사용자에게 아무것도 설명하지 못한다.
const headline = (
  progress: LocalMemoIndexProgress,
  language: 'en' | 'ko',
) => {
  if (progress.stage === 'failed') return localize(language, '준비하지 못했어요', 'Preparation failed');
  if (progress.stage === 'complete') return localize(language, '준비 완료!', 'Ready');
  if (progress.stage === 'downloading') return localize(language, '검색 준비 파일 받는 중', 'Downloading search files');
  if (progress.stage === 'loading') return localize(language, '검색 준비 중', 'Preparing search');
  if (progress.stage === 'indexing') return localize(language, '메모를 정리하는 중', 'Organizing memos');
  return localize(language, '메모를 확인하는 중', 'Checking memos');
};

// 둘째 줄은 숫자뿐이다. 실패에는 원인 문구를 두지 않는다 — 사용자가 할 수
// 있는 건 다시 시도뿐이고, 원인 문자열은 대부분 조치로 이어지지 않는다.
const progressDetail = (progress: LocalMemoIndexProgress, language: 'en' | 'ko') => {
  if (progress.stage === 'downloading' && progress.totalBytes > 0) {
    return `${megabytes(progress.downloadedBytes)} / ${megabytes(progress.totalBytes)}MB`;
  }
  if (progress.stage === 'indexing' && progress.totalChunks > 0) {
    return `${progress.completedChunks} / ${progress.totalChunks}`;
  }
  if (progress.stage === 'complete') return localize(language, '이제 연관 문장을 찾을 수 있어요', 'Related-passage search is ready');
  return '';
};

const LocalIndexProgress = ({
  onDismiss,
  onRetry,
  progress,
}: {
  onDismiss?: () => void;
  onRetry?: () => void;
  progress: LocalMemoIndexProgress;
}) => {
  const language = useUiLanguage();
  const isDownloading =
    progress.stage === 'downloading' && progress.totalBytes > 0;
  const hasChunkProgress =
    progress.stage === 'indexing' && progress.totalChunks > 0;
  const max = isDownloading ? progress.totalBytes : progress.totalChunks;
  const value = isDownloading
    ? progress.downloadedBytes
    : progress.completedChunks;

  return (
    <div
      aria-live="polite"
      className={`local-index-progress ${progress.stage}`}
      role="status"
    >
      <span>
        <strong>{headline(progress, language)}</strong>
        {progressDetail(progress, language) && <small>{progressDetail(progress, language)}</small>}
      </span>
      {(isDownloading || hasChunkProgress) && (
        <progress max={max} value={value} />
      )}
      {progress.stage === 'failed' && onRetry && (
        <button
          className="local-index-progress-action"
          onClick={onRetry}
          type="button"
        >
          {localize(language, '다시 시도', 'Try again')}
        </button>
      )}
      {progress.stage === 'complete' && onDismiss && (
        <button
          aria-label={localize(language, '닫기', 'Dismiss')}
          className="local-index-progress-close"
          onClick={onDismiss}
          type="button"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default LocalIndexProgress;
