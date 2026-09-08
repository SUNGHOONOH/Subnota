import type { ComponentProps } from 'react';

import EmbeddingModelGate from '../search/EmbeddingModelGate';
import GlobalSearchOverlay from '../search/GlobalSearchOverlay';
import LocalIndexProgress from '../search/LocalIndexProgress';
import TrayHintModal from '../onboarding/TrayHintModal';
import MonthlyReportModal from '../report/MonthlyReportModal';
import SettingsModal from '../settings/SettingsModal';
import type { LocalMemoIndexProgress } from '../../services/local/localMemoIndexer';

type Translate = (korean: string, english: string) => string;

interface AppOverlayClusterProps {
  embeddingGateProps: ComponentProps<typeof EmbeddingModelGate>;
  globalSearchProps: ComponentProps<typeof GlobalSearchOverlay>;
  hasManualAmbientSearchNotice: boolean;
  localIndexProgress: LocalMemoIndexProgress | null;
  onDismissLocalIndexProgress: () => void;
  onRetryLocalIndexProgress: () => void;
  reportProps: ComponentProps<typeof MonthlyReportModal>;
  settingsProps: ComponentProps<typeof SettingsModal>;
  trayHintProps: ComponentProps<typeof TrayHintModal>;
  translate: Translate;
}

const AppOverlayCluster = ({
  embeddingGateProps,
  globalSearchProps,
  hasManualAmbientSearchNotice,
  localIndexProgress,
  onDismissLocalIndexProgress,
  onRetryLocalIndexProgress,
  reportProps,
  settingsProps,
  trayHintProps,
  translate: t,
}: AppOverlayClusterProps) => (
  <>
    <GlobalSearchOverlay {...globalSearchProps} />
    {hasManualAmbientSearchNotice ? (
      <div
        aria-live="polite"
        className="local-index-progress searching manual-ambient-search-progress"
        role="status"
      >
        <span>
          <strong>
            {t('유사한 문장을 검색 중입니다', 'Searching for similar passages')}
          </strong>
        </span>
      </div>
    ) : localIndexProgress ? (
      <LocalIndexProgress
        onDismiss={onDismissLocalIndexProgress}
        onRetry={onRetryLocalIndexProgress}
        progress={localIndexProgress}
      />
    ) : null}
    <TrayHintModal {...trayHintProps} />
    <EmbeddingModelGate {...embeddingGateProps} />
    <MonthlyReportModal {...reportProps} />
    <SettingsModal {...settingsProps} />
  </>
);

export default AppOverlayCluster;
