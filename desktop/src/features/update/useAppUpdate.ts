import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import type { UiLanguage } from '../../lib/appSettings';
import { localize } from '../../lib/uiLanguage';
import type { UpdatePopoverStatus } from './UpdatePopover';

export type AvailableUpdate = { downloadUrl: string; version: string };
export type UpdateState =
  | { status: 'idle' }
  | { status: Exclude<UpdatePopoverStatus, 'error'>; update: AvailableUpdate }
  | { message: string; status: 'error'; update: AvailableUpdate };

// 앱을 며칠씩 켜 두는 사용자도 하루 안에는 새 버전을 알게 한다(Sparkle 기본값).
// 24시간 타이머 하나는 잠자기 동안 멈춰 며칠씩 밀릴 수 있어서, 한 시간마다
// 마지막 확인 시각만 비교하고 하루가 지났을 때만 GitHub에 묻는다.
const UPDATE_RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UPDATE_RECHECK_TICK_MS = 60 * 60 * 1000;

/** 이미 찾았거나 받는 중·적용 중이면 다시 묻지 않는다 — 진행 상태가 되돌아간다. */
export const shouldRecheckForUpdate = (
  status: UpdateState['status'],
  lastCheckedAt: number,
  now: number,
) => status === 'idle' && now - lastCheckedAt >= UPDATE_RECHECK_INTERVAL_MS;

interface UseAppUpdateOptions {
  autoCheckUpdates: boolean;
  isWindowsDistribution: boolean;
  language: UiLanguage;
  setUpdatePopoverOpen: Dispatch<SetStateAction<boolean>>;
  setUpdateState: Dispatch<SetStateAction<UpdateState>>;
  updateState: UpdateState;
}

export const useAppUpdate = ({
  autoCheckUpdates,
  isWindowsDistribution,
  language,
  setUpdatePopoverOpen,
  setUpdateState,
  updateState,
}: UseAppUpdateOptions) => {
  const t = (korean: string, english: string) =>
    localize(language, korean, english);

  const lastCheckedAtRef = useRef(0);
  const updateStatusRef = useRef(updateState.status);
  updateStatusRef.current = updateState.status;

  const checkForAvailableUpdate = useCallback(async () => {
    // 실패해도 시각을 남긴다 — 자동 확인은 조용히 넘어가고 다음 날 다시 묻는다.
    lastCheckedAtRef.current = Date.now();
    const update = await window.electronAPI?.checkForUpdate?.();
    if (!update) return null;

    setUpdateState({ status: 'available', update });
    setUpdatePopoverOpen(false);
    return update;
  }, []);

  useEffect(() => {
    if (!autoCheckUpdates) return;
    void checkForAvailableUpdate().catch(() => undefined);
    const timer = window.setInterval(() => {
      if (!shouldRecheckForUpdate(updateStatusRef.current, lastCheckedAtRef.current, Date.now())) return;
      void checkForAvailableUpdate().catch(() => undefined);
    }, UPDATE_RECHECK_TICK_MS);
    return () => window.clearInterval(timer);
  }, [autoCheckUpdates, checkForAvailableUpdate]);

  useEffect(() => {
    const unsubscribeDownloaded = window.electronAPI?.onUpdateDownloaded?.(
      (info) => {
        setUpdateState((current) => {
          const update =
            current.status === 'idle'
              ? {
                  downloadUrl: info.updateUrl,
                  version:
                    info.releaseName.replace(/^Subnota\s*/i, '') ||
                    info.releaseName,
                }
              : current.update;
          return { status: 'installing', update };
        });
        setUpdatePopoverOpen(true);
        void window.electronAPI.installUpdate().catch(() => {
          setUpdateState((current) =>
            current.status === 'idle'
              ? current
              : {
                  message: t(
                    '업데이트를 적용하지 못했습니다. 다시 시도해주세요.',
                    'Could not apply the update. Please try again.',
                  ),
                  status: 'error',
                  update: current.update,
                },
          );
        });
      },
    );
    const unsubscribeError = window.electronAPI?.onUpdateError?.((info) => {
      setUpdateState((current) =>
        current.status === 'idle'
          ? current
          : { message: info.message, status: 'error', update: current.update },
      );
      setUpdatePopoverOpen(true);
    });
    const unsubscribeNotAvailable = window.electronAPI?.onUpdateNotAvailable?.(
      () => {
        setUpdateState({ status: 'idle' });
        setUpdatePopoverOpen(false);
      },
    );

    return () => {
      unsubscribeDownloaded?.();
      unsubscribeError?.();
      unsubscribeNotAvailable?.();
    };
  }, []);

  const startAvailableUpdate = useCallback(async () => {
    if (updateState.status !== 'available' && updateState.status !== 'error')
      return;

    const update = updateState.update;
    setUpdateState({ status: 'downloading', update });
    setUpdatePopoverOpen(true);

    try {
      const started = await window.electronAPI?.downloadUpdate?.();
      if (started) return;
      setUpdateState({
        message: isWindowsDistribution
          ? t(
              '이 설치본에서는 자동 업데이트를 시작할 수 없습니다. 최신 Windows 설치 파일을 다시 설치해주세요.',
              'Automatic updates are unavailable in this installation. Please install the latest Windows installer.',
            )
          : t(
              '이 설치본에서는 자동 업데이트를 시작할 수 없습니다. 최신 DMG를 다시 설치해주세요.',
              'Automatic updates are unavailable in this installation. Please install the latest DMG.',
            ),
        status: 'error',
        update,
      });
    } catch {
      setUpdateState({
        message: t(
          '업데이트 다운로드를 시작하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해주세요.',
          'Could not start the update download. Check your network and try again.',
        ),
        status: 'error',
        update,
      });
    }
  }, [isWindowsDistribution, updateState]);

  return { checkForAvailableUpdate, startAvailableUpdate };
};
