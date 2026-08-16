import { useHotkeys } from '@mantine/hooks';
import {
  AppShortcutSettings,
  DEFAULT_APP_SHORTCUT_SETTINGS,
  toMantineHotkey,
} from '../lib/shortcutSettings';

export interface AppHotkeyHandlers {
  createMemo: () => void;
  createTab: () => void;
  closeActiveTab: () => void;
  focusPreviousTab: () => void;
  focusNextTab: () => void;
  openAmbientDetail: () => void;
  openAmbientList: () => void;
  createSplitPane: () => void;
  focusNextPane: () => void;
  focusPreviousPane: () => void;
  openCalendar: () => void;
  openInbox: () => void;
  openTopics: () => void;
  openMemos: () => void;
  openSettings: () => void;
  toggleSidebar: () => void;
}

export const APP_HOTKEYS = [
  { accelerator: 'mod+N', label: '새 메모 생성' },
  { accelerator: 'mod+T', label: '새 탭 생성' },
  { accelerator: 'mod+W', label: '현재 탭 닫기' },
  { accelerator: 'ctrl+shift+Tab', label: '이전 탭으로 이동' },
  { accelerator: 'ctrl+Tab', label: '다음 탭으로 이동' },
  { accelerator: 'mod+,', label: '설정 열기' },
  { accelerator: 'mod+1', label: '메모 보기' },
  { accelerator: 'mod+2', label: '캘린더 보기' },
  { accelerator: 'mod+3', label: '링크 저장함 보기' },
  { accelerator: 'mod+4', label: 'Topics 보기' },
  { accelerator: 'mod+alt+S', label: '사이드바 열기/닫기' },
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
      [toMantineHotkey(shortcuts.createTab), handlers.createTab],
      [toMantineHotkey(shortcuts.closeActiveTab), handlers.closeActiveTab],
      [toMantineHotkey(shortcuts.focusPreviousTab), handlers.focusPreviousTab],
      [toMantineHotkey(shortcuts.focusNextTab), handlers.focusNextTab],
      // Electron의 기본 메뉴도 같은 조합으로 설정을 연다. 이 키는 메뉴와
      // 충돌하지 않도록 고정하고 설정 화면에서는 재할당하지 않는다.
      [
        toMantineHotkey(DEFAULT_APP_SHORTCUT_SETTINGS.openSettings),
        handlers.openSettings,
      ],
      [toMantineHotkey(shortcuts.openMemos), handlers.openMemos],
      [toMantineHotkey(shortcuts.openCalendar), handlers.openCalendar],
      [toMantineHotkey(shortcuts.openInbox), handlers.openInbox],
      [toMantineHotkey(shortcuts.openTopics), handlers.openTopics],
      [toMantineHotkey(shortcuts.toggleSidebar), handlers.toggleSidebar],
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
