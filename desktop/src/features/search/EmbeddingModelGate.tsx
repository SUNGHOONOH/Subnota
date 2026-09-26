import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';
import { localize, useUiLanguage } from '../../lib/uiLanguage';

/**
 * 검색 모델(BGE-M3 + A.X)의 다운로드를 시작하는 명시적 관문.
 *
 * 왜 숨기지 않는가: 예전에는 첫 색인이 돌면서 조용히 내려받았다. 사용자는
 * 메모를 쓰다가 이유도 모른 채 수백 MB를 받게 되고, 얼마나 걸리는지도 알 수
 * 없었다. 로컬 퍼스트 앱 구축 회고들이 공통으로 지적하는 지점이라
 * (모델 다운로드는 온보딩의 명시적 단계로 다뤄야 한다) 관문으로 끌어올렸다.
 *
 * 업데이트로 검색 모델이 바뀌면 같은 관문이 "교체" 문구로 뜬다. 앱은 새 모델이
 * 없다고 보고 이 창을 열고, 옛 모델은 새 모델을 받아 검증한 뒤 지운다.
 *
 * 왜 "나중에" 버튼이 없는가: 연관 문장 검색은 이 파일 없이는 아예 동작하지
 * 않아 미루기 선택지가 의미가 없다. 다만 닫기(X·Esc)는 남긴다 — 네트워크가
 * 없거나 지금 받을 수 없는 상황에서 앱 전체가 잠기면 안 되고, 메모 작성과
 * 캘린더는 모델과 무관하게 동작해야 한다(로컬 퍼스트 불변식). 닫아도 수동
 * 검색을 누르면 다시 뜬다.
 */

type SizeStatus = { pendingDownloadBytes?: number; retiredModelBytes?: number } | null;

const megabytes = (bytes: number) => Math.round(bytes / 1_000_000);

export const embeddingGateCopy = (
  status: SizeStatus,
  t: (korean: string, english: string) => string,
) => {
  const pending = status?.pendingDownloadBytes ?? 0;
  const retired = status?.retiredModelBytes ?? 0;
  if (retired > 0 && pending > 0) {
    return {
      title: t('검색 모델 업데이트', 'Search model update'),
      body: t(
        `검색 모델이 새 버전으로 바뀌었어요. 새 모델(약 ${megabytes(pending)}MB)을 받고 메모를 다시 정리합니다. 기존 모델(약 ${megabytes(retired)}MB)은 지워집니다.`,
        `The search model has a new version. Download it (about ${megabytes(pending)}MB) and your notes will be re-indexed. The previous model (about ${megabytes(retired)}MB) will be removed.`,
      ),
    };
  }
  return {
    title: t('연관 문장 검색 준비', 'Prepare related-passage search'),
    body: pending > 0
      ? t(
          `검색에 필요한 모델 파일을 내려받습니다. 약 ${megabytes(pending)}MB, 기기에만 저장됩니다.`,
          `Download about ${megabytes(pending)}MB of model files needed for search. They stay on this device.`,
        )
      : t(
          '검색에 필요한 모델 파일을 내려받습니다. 기기에만 저장됩니다.',
          'Download the model files needed for search. They stay on this device.',
        ),
  };
};

interface EmbeddingModelGateProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
}

const EmbeddingModelGate = ({
  isOpen,
  onClose,
  onDownload,
}: EmbeddingModelGateProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  // 네트워크가 없으면 받을 수 없다. 로그인은 이미 온라인에서 끝났어도 그
  // 뒤에 끊길 수 있어서, 여는 시점뿐 아니라 열려 있는 동안에도 따라간다.
  const [isOffline, setOffline] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, [isOpen]);

  // 받을 크기와 교체 여부는 이미 있는 파일에 따라 달라서 열 때 묻는다.
  const [sizeStatus, setSizeStatus] = useState<SizeStatus>(null);
  // 공간이 모자라면 받기 전에 알린다 — 수백 MB를 받다 실패하는 것보다 낫다.
  const [shortfallMb, setShortfallMb] = useState<number | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    void window.electronAPI?.localEmbedStatus?.().then(status => setSizeStatus(status ?? null));
    void window.electronAPI?.localEmbedDiskSpace?.().then(space => {
      if (space?.freeBytes === null || space?.freeBytes === undefined) return;
      const missing = space.requiredBytes - space.freeBytes;
      setShortfallMb(missing > 0 ? Math.ceil(missing / 1_000_000) : null);
    });
  }, [isOpen]);
  const copy = embeddingGateCopy(sizeStatus, t);

  return (
    <Modal centered onClose={onClose} opened={isOpen} shadow="sm" size="sm" title={null} withCloseButton>
      <div className="embedding-gate">
        <h2 className="embedding-gate-title">{copy.title}</h2>
        <p className="embedding-gate-body">{copy.body}</p>
        {isOffline && (
          <p className="embedding-gate-warning">
            {t(
              '네트워크에 연결한 뒤 다시 시도해 주세요. 검색 파일은 처음 한 번만 받으면 됩니다.',
              'Connect to a network and try again. The search file is downloaded only once.',
            )}
          </p>
        )}
        {shortfallMb !== null && (
          <p className="embedding-gate-warning">
            {t(
              `저장 공간이 ${shortfallMb}MB 부족합니다. 공간을 확보한 뒤 다시 시도해 주세요.`,
              `You need ${shortfallMb}MB more storage. Free up space and try again.`,
            )}
          </p>
        )}
        <button
          className="embedding-gate-cta"
          disabled={isOffline || shortfallMb !== null}
          onClick={onDownload}
          type="button"
        >
          {t('다운로드', 'Download')}
        </button>
      </div>
    </Modal>
  );
};

export default EmbeddingModelGate;
