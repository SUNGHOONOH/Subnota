import { useEffect, useState } from 'react';
import { Modal } from '@mantine/core';
import { localize, useUiLanguage } from '../../lib/uiLanguage';

/**
 * 검색 모델(약 570MB) 다운로드를 시작하는 명시적 관문.
 *
 * 왜 숨기지 않는가: 예전에는 첫 색인이 돌면서 조용히 내려받았다. 사용자는
 * 메모를 쓰다가 이유도 모른 채 570MB를 받게 되고, 얼마나 걸리는지도 알 수
 * 없었다. 로컬 퍼스트 앱 구축 회고들이 공통으로 지적하는 지점이라
 * (모델 다운로드는 온보딩의 명시적 단계로 다뤄야 한다) 관문으로 끌어올렸다.
 *
 * 왜 "나중에" 버튼이 없는가: 연관 문장 검색은 이 파일 없이는 아예 동작하지
 * 않아 미루기 선택지가 의미가 없다. 다만 닫기(X·Esc)는 남긴다 — 네트워크가
 * 없거나 지금 받을 수 없는 상황에서 앱 전체가 잠기면 안 되고, 메모 작성과
 * 캘린더는 모델과 무관하게 동작해야 한다(로컬 퍼스트 불변식).
 */

const MODEL_SIZE_LABEL = '약 570MB';

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
  // 공간이 모자라면 받기 전에 알린다 — 570MB를 받다 실패하는 것보다 낫다.
  const [shortfallMb, setShortfallMb] = useState<number | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    void window.electronAPI?.localEmbedDiskSpace?.().then(space => {
      if (space?.freeBytes === null || space?.freeBytes === undefined) return;
      const missing = space.requiredBytes - space.freeBytes;
      setShortfallMb(missing > 0 ? Math.ceil(missing / 1_000_000) : null);
    });
  }, [isOpen]);

  return (
    <Modal centered onClose={onClose} opened={isOpen} size="sm" title={null} withCloseButton>
      <div className="embedding-gate">
        <h2 className="embedding-gate-title">{t('연관 문장 검색 준비', 'Prepare related-passage search')}</h2>
        <p className="embedding-gate-body">
          {t(
            `검색에 필요한 파일을 한 번 내려받습니다. ${MODEL_SIZE_LABEL}, 기기에만 저장됩니다.`,
            `Download the ${MODEL_SIZE_LABEL} file needed for search once. It stays on this device.`,
          )}
        </p>
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
          disabled={shortfallMb !== null}
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
