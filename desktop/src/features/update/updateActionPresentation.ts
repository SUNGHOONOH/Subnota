import type { UpdateState } from './useAppUpdate';

interface UpdateActionTranslator {
  (korean: string, english: string): string;
}

export interface UpdateActionPresentation {
  hasPendingUpdate: boolean;
  isWorking: boolean;
  label: string;
  tooltip: string;
}

export const getUpdateActionPresentation = (
  state: UpdateState,
  t: UpdateActionTranslator,
): UpdateActionPresentation => {
  const hasPendingUpdate = state.status !== 'idle';
  const isWorking =
    state.status === 'downloading' || state.status === 'installing';

  if (state.status === 'idle') {
    return { hasPendingUpdate, isWorking, label: '', tooltip: '' };
  }

  const label = isWorking
    ? t('업데이트 진행 중', 'Updating')
    : state.status === 'error'
      ? t('업데이트 다시 시도', 'Retry update')
      : t(
          `Subnota ${state.update.version} 업데이트 시작`,
          `Update Subnota ${state.update.version}`,
        );
  const tooltip = isWorking
    ? state.status === 'downloading'
      ? t('업데이트 다운로드 중', 'Downloading update')
      : t('새 버전 적용 준비 중', 'Preparing update')
    : state.status === 'error'
      ? t('업데이트 다시 시도', 'Retry update')
      : t(
          `Subnota ${state.update.version} 업데이트`,
          `Update Subnota ${state.update.version}`,
        );

  return { hasPendingUpdate, isWorking, label, tooltip };
};
