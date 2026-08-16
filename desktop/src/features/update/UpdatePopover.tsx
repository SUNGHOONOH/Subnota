import { motion } from 'framer-motion';
import { Download, X } from '@/components/icons';
import SubnotaSpinner from '../../components/SubnotaSpinner';
import { localize, useUiLanguage } from '../../lib/uiLanguage';

export type UpdatePopoverStatus =
  | 'available'
  | 'downloading'
  | 'installing'
  | 'error';

interface UpdatePopoverProps {
  errorMessage?: string;
  onDismiss: () => void;
  onOpenSettings: () => void;
  onStartUpdate: () => void;
  status: UpdatePopoverStatus;
  version: string;
}

const UpdatePopover = ({
  errorMessage,
  onDismiss,
  onOpenSettings,
  onStartUpdate,
  status,
  version,
}: UpdatePopoverProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const statusCopy: Record<UpdatePopoverStatus, { detail: string; title: string }> = {
    available: {
      detail: t('새로운 기능과 개선 사항을 준비했습니다.', 'New features and improvements are ready.'),
      title: t('새 버전이 준비되었습니다', 'A new version is ready'),
    },
    downloading: {
      detail: t('완료되면 작업 내용을 저장한 뒤 새 버전으로 다시 시작합니다.', 'When it is ready, your work will be saved before restarting with the new version.'),
      title: t('업데이트를 다운로드하고 있습니다', 'Downloading the update'),
    },
    installing: {
      detail: t('작업 내용을 안전하게 저장한 뒤 곧 다시 시작합니다.', 'Your work will be saved safely before restarting shortly.'),
      title: t('새 버전을 적용하고 있습니다', 'Applying the new version'),
    },
    error: {
      detail: t('잠시 후 다시 시도해주세요.', 'Try again shortly.'),
      title: t('업데이트를 준비하지 못했습니다', 'Could not prepare the update'),
    },
  };
  const copy = statusCopy[status];
  const isWorking = status === 'downloading' || status === 'installing';
  const actionLabel = status === 'error' ? t('다시 시도', 'Try again') : t('업데이트', 'Update');

  return (
    <motion.aside
      animate={{ opacity: 1, scale: 1, x: 0 }}
      aria-label={t('Subnota 업데이트', 'Subnota update')}
      aria-live="polite"
      className="update-popover"
      exit={{ opacity: 0, scale: 0.98, x: -6 }}
      initial={{ opacity: 0, scale: 0.98, x: -6 }}
      id="subnota-update-popover"
      role="dialog"
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="update-popover-heading">
        <div>
          <p className="update-popover-kicker">SUBNOTA UPDATE</p>
          <h2>{copy.title}</h2>
        </div>
        <button
          aria-label={t('업데이트 알림 닫기', 'Dismiss update notice')}
          className="update-popover-close"
          onClick={onDismiss}
          type="button"
        >
          <X size={16} />
        </button>
      </div>

      <p className="update-popover-version">{t(`버전 ${version}`, `Version ${version}`)}</p>
      <p className="update-popover-detail">
        {status === 'error' && errorMessage ? errorMessage : copy.detail}
      </p>

      {isWorking ? (
        <div className="update-popover-working" role="status">
          <SubnotaSpinner size={15} />
          {status === 'downloading' ? t('다운로드 중…', 'Downloading…') : t('재시작 준비 중…', 'Preparing restart…')}
        </div>
      ) : (
        <div className="update-popover-actions">
          <button className="update-popover-action" onClick={onStartUpdate} type="button">
            <Download size={16} />
            {actionLabel}
          </button>
          <button
            className="update-popover-settings-action"
            onClick={onOpenSettings}
            type="button"
          >
            {t('설정 열기', 'Open settings')}
          </button>
        </div>
      )}
    </motion.aside>
  );
};

export default UpdatePopover;
