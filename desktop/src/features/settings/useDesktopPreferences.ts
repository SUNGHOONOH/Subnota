import { useCallback, useEffect, useState } from 'react';

export interface DesktopPreferences {
  closeBehavior: 'quit' | 'tray';
  launchAtLogin: boolean;
}

export interface LocalStorageInfo {
  databasePath: string;
  size: number;
}

/**
 * Electron 데스크톱 설정과 로컬 DB 위치 표시를 한 lifecycle로 묶는다.
 * 설정 화면은 값을 보여 주고 요청만 전달하며, 초기 조회·저장소 선택 결과의
 * 화면 반영은 이 hook이 소유한다.
 */
export const useDesktopPreferences = () => {
  const [desktopPreferences, setDesktopPreferences] =
    useState<DesktopPreferences>({
      closeBehavior: 'tray',
      launchAtLogin: false,
    });
  const [storageInfo, setStorageInfo] = useState<LocalStorageInfo | null>(null);

  useEffect(() => {
    if (
      !window.electronAPI?.getDesktopPreferences ||
      !window.electronAPI?.getLocalStorageInfo
    ) {
      return;
    }
    void Promise.all([
      window.electronAPI.getDesktopPreferences(),
      window.electronAPI.getLocalStorageInfo(),
    ]).then(([preferences, info]) => {
      setDesktopPreferences(preferences);
      setStorageInfo(info);
    });
  }, []);

  const updateDesktopPreferences = useCallback(
    async (preferences: DesktopPreferences) => {
      setDesktopPreferences(
        await window.electronAPI.setDesktopPreferences(preferences),
      );
    },
    [],
  );

  const chooseLocalStorage = useCallback(async () => {
    const info = await window.electronAPI.chooseLocalStorage();
    if (info) setStorageInfo(info);
    return info;
  }, []);

  const openLocalStorage = useCallback(
    () => window.electronAPI.openLocalStorage(),
    [],
  );

  return {
    chooseLocalStorage,
    desktopPreferences,
    openLocalStorage,
    storageInfo,
    updateDesktopPreferences,
  };
};
