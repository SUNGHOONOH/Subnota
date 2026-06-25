import { useHotkeys } from '@mantine/hooks';

export interface AppHotkeyHandlers {
  createMemo: () => void;
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
] as const;

export const useAppHotkeys = (handlers: AppHotkeyHandlers) => {
  useHotkeys(
    [
      ['mod+N', handlers.createMemo],
      ['mod+,', handlers.openSettings],
      ['mod+1', handlers.openMemos],
      ['mod+2', handlers.openCalendar],
      ['mod+3', handlers.openInbox],
      ['mod+Alt+ArrowLeft', handlers.focusPreviousPane],
      ['mod+Alt+ArrowRight', handlers.focusNextPane],
      ['mod+\\', handlers.createSplitPane],
    ],
    [],
    true,
  );
};
