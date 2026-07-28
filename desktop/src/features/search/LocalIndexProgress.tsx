import type { LocalMemoIndexProgress } from '../../services/local/localMemoIndexer';

const megabytes = (bytes: number) => Math.round(bytes / 1_000_000);

export const isEmptyLocalIndexCompletion = (
  progress: LocalMemoIndexProgress,
) => progress.stage === 'complete' && progress.totalChunks === 0;

const progressLabel = (progress: LocalMemoIndexProgress) => {
  if (progress.stage === 'preparing') return '메모를 확인하는 중';
  if (progress.stage === 'downloading') {
    return progress.totalBytes > 0
      ? `모델 받는 중 · ${megabytes(progress.downloadedBytes)} / ${megabytes(progress.totalBytes)}MB`
      : '로컬 검색 모델을 받는 중';
  }
  if (progress.stage === 'loading') return '로컬 검색 모델을 여는 중';
  if (progress.stage === 'indexing') {
    return `${progress.completedChunks} / ${progress.totalChunks}개 문장`;
  }
  if (progress.stage === 'failed') return '다음 저장 때 다시 준비합니다';
  return '로컬 검색 준비 완료';
};

const LocalIndexProgress = ({
  progress,
}: {
  progress: LocalMemoIndexProgress;
}) => {
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
      title={progress.stage === 'failed' ? progress.error : undefined}
    >
      <span className="local-index-progress-dot" aria-hidden="true" />
      <span>
        <strong>
          {progress.stage === 'failed'
            ? '로컬 검색 준비 지연'
            : '로컬 검색'}
        </strong>
        <small>{progressLabel(progress)}</small>
      </span>
      {(isDownloading || hasChunkProgress) && (
        <progress max={max} value={value} />
      )}
    </div>
  );
};

export default LocalIndexProgress;
