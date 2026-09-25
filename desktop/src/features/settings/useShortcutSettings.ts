import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import {
  type AppShortcutSettings,
  DEFAULT_SHORTCUT_SETTINGS,
  type ShortcutSettings,
  loadAppShortcutSettings,
  loadShortcutSettings,
  matchesKeyboardShortcut,
  normalizeShortcutSettings,
  saveAppShortcutSettings,
  saveShortcutSettings,
} from '../../lib/shortcutSettings';

interface UseShortcutSettingsOptions {
  setGlobalSearchOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
}

export const useShortcutSettings = ({
  setGlobalSearchOpen,
  setSettingsOpen,
}: UseShortcutSettingsOptions) => {
  const [shortcuts, setShortcuts] = useState(loadShortcutSettings);
  const [appShortcuts, setAppShortcuts] = useState(loadAppShortcutSettings);

  useEffect(() => {
    void window.electronAPI?.setGlobalShortcuts?.(shortcuts).then((result) => {
      if (!result) return;
      setShortcuts(saveShortcutSettings(result.settings));
    });
  }, []);

  useEffect(
    () =>
      window.electronAPI?.onShortcutSettingsChanged?.((nextSettings) => {
        setShortcuts(saveShortcutSettings(nextSettings));
      }),
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!matchesKeyboardShortcut(event, shortcuts.openSearch)) return;
      event.preventDefault();
      setGlobalSearchOpen(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts.openSearch]);

  useEffect(
    () =>
      window.electronAPI?.onOpenSettings?.(() => {
        setSettingsOpen(true);
      }),
    [],
  );

  const applyShortcutSettings = async (nextSettings: ShortcutSettings) => {
    const normalized = normalizeShortcutSettings(nextSettings);
    const result = await window.electronAPI?.setGlobalShortcuts?.(normalized);
    const accepted = saveShortcutSettings(result?.settings ?? normalized);

    setShortcuts(accepted);
    return result?.registered ?? { capture: true, toggle: true };
  };

  const applyAppShortcutSettings = async (
    nextSettings: AppShortcutSettings,
  ) => {
    const accepted = saveAppShortcutSettings(nextSettings);
    setAppShortcuts(accepted);
    return accepted;
  };

  return {
    appShortcuts,
    applyAppShortcutSettings,
    applyShortcutSettings,
    resetShortcutSettings: () => applyShortcutSettings(DEFAULT_SHORTCUT_SETTINGS),
    shortcuts,
  };
};
