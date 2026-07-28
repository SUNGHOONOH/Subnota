import { useHotkeys } from '@mantine/hooks';
import {
  AppShortcutSettings,
  DEFAULT_APP_SHORTCUT_SETTINGS,
  toMantineHotkey,
} from '../lib/shortcutSettings';

export interface AppHotkeyHandlers {
  createMemo: () => void;
  openAmbientDetail: () => void;
  openAmbientList: () => void;
  createSplitPane: () => void;
  focusNextPane: () => void;
  focusPreviousPane: () => void;
  openCalendar: () => void;
  openInbox: () => void;
  openMemos: () => void;
  openSettings: () => void;
}

export const APP_HOTKEYS = [
  { accelerator: 'mod+N', label: '새 메모 생성' },
  { accelerator: 'mod+,', label: '설정 열기' },
  { accelerator: 'mod+1', label: '메모 보기' },
  { accelerator: 'mod+2', label: '캘린더 보기' },
  { accelerator: 'mod+3', label: 'Inbox 보기' },
  { accelerator: 'mod+Alt+ArrowLeft', label: '이전 분할 패널 포커스' },
  { accelerator: 'mod+Alt+ArrowRight', label: '다음 분할 패널 포커스' },
  { accelerator: 'mod+\\', label: '새 분할 패널' },
  { accelerator: 'mod+Enter', label: '연결된 문장 미리보기' },
  { accelerator: 'mod+Shift+Enter', label: '연결된 문장 목록' },
] as const;

export const useAppHotkeys = (
  handlers: AppHotkeyHandlers,
  shortcuts: AppShortcutSettings = DEFAULT_APP_SHORTCUT_SETTINGS,
) => {
  useHotkeys(
    [
      [toMantineHotkey(shortcuts.createMemo), handlers.createMemo],
      [toMantineHotkey(shortcuts.openSettings), handlers.openSettings],
      [toMantineHotkey(shortcuts.openMemos), handlers.openMemos],
      [toMantineHotkey(shortcuts.openCalendar), handlers.openCalendar],
      [toMantineHotkey(shortcuts.openInbox), handlers.openInbox],
      [toMantineHotkey(shortcuts.focusPreviousPane), handlers.focusPreviousPane],
      [toMantineHotkey(shortcuts.focusNextPane), handlers.focusNextPane],
      [toMantineHotkey(shortcuts.createSplitPane), handlers.createSplitPane],
      [toMantineHotkey(shortcuts.openAmbientDetail), handlers.openAmbientDetail],
      [toMantineHotkey(shortcuts.openAmbientList), handlers.openAmbientList],
    ],
    Object.values(shortcuts),
    true,
  );
};
