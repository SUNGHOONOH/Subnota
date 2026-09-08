import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Text,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { AppSettings, CloseBehavior } from '../../lib/appSettings';
import { localize } from '../../lib/uiLanguage';
import SettingsNav, { SETTINGS_SECTIONS } from './SettingsNav';
import SettingsHotkeysSection from './SettingsHotkeysSection';
import SettingsAboutSection from './SettingsAboutSection';
import SettingsAccountSection from './SettingsAccountSection';
import SettingsAppearanceSection from './SettingsAppearanceSection';
import SettingsBackupSection from './SettingsBackupSection';
import SettingsGeneralSection from './SettingsGeneralSection';
import SettingsSyncSection from './SettingsSyncSection';
import { SETTINGS_CSS } from './SettingsStyles';
import SettingsDeleteAccountDialog from './SettingsDeleteAccountDialog';
import {
  APP_SHORTCUT_LABELS,
  APP_SHORTCUT_RESERVED,
  AppShortcutSettings,
  DEFAULT_APP_SHORTCUT_SETTINGS,
  DEFAULT_SHORTCUT_SETTINGS,
  findShortcutConflictsForFields,
  formatHotkeyModifierHint,
  SHORTCUT_LABELS,
  ShortcutSettings,
  keyboardEventToAccelerator,
} from '../../lib/shortcutSettings';

interface ShortcutSaveResult {
  capture: boolean;
  toggle: boolean;
}

interface SettingsModalProps {
  appSettings: AppSettings;
  appShortcuts: AppShortcutSettings;
  desktopPreferences: {
    closeBehavior: CloseBehavior;
    launchAtLogin: boolean;
  };
  email?: string | null;
  failedSyncCount: number;
  inboxData: unknown[];
  isOnline: boolean;
  isOpen: boolean;
  isSignedIn: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingSyncCount: number;
  provider?: string | null;
  scheduleData: unknown[];
  shortcuts: ShortcutSettings;
  storageInfo: { databasePath: string; size: number } | null;
  onAppSettingsChange: (settings: AppSettings) => void;
  onBackup: () => Promise<string | null>;
  onCheckUpdates: () => Promise<string>;
  onChooseStorage: () => Promise<{ databasePath: string; size: number } | null>;
  onClose: () => void;
  onDesktopPreferencesChange: (preferences: {
    closeBehavior: CloseBehavior;
    launchAtLogin: boolean;
  }) => Promise<void>;
  onExportJson: (name: string, value: unknown) => Promise<string | null>;
  onOpenStorage: () => Promise<void>;
  onPasswordReset: () => Promise<void>;
  onResetShortcuts: () => Promise<ShortcutSaveResult | void>;
  onResetAppShortcuts: () => Promise<AppShortcutSettings | void>;
  onRestore: (file: File) => Promise<void>;
  onSaveShortcuts: (
    settings: ShortcutSettings,
  ) => Promise<ShortcutSaveResult | void>;
  onSaveAppShortcuts: (
    settings: AppShortcutSettings,
  ) => Promise<AppShortcutSettings | void>;
  onDeleteAccount: () => Promise<void>;
  onSignOut: () => void;
  onSync: () => void;
}

type EditableShortcutField = keyof ShortcutSettings | keyof AppShortcutSettings;

const isGlobalShortcutField = (
  field: EditableShortcutField,
): field is keyof ShortcutSettings => field in DEFAULT_SHORTCUT_SETTINGS;

const EDITABLE_SHORTCUTS: Array<{
  description: string;
  enDescription: string;
  enLabel: string;
  field: keyof ShortcutSettings;
  label: string;
}> = [
  {
    description: '어디서든 빠른 메모 패널을 엽니다.',
    enDescription: 'Opens the quick memo panel from anywhere.',
    enLabel: 'Open Quick Subnota',
    field: 'toggleMini',
    label: SHORTCUT_LABELS.toggleMini,
  },
  {
    description: '현재 브라우저 페이지를 링크 저장함으로 보냅니다.',
    enDescription: 'Saves the current browser page to Inbox.',
    enLabel: 'Save current page',
    field: 'capturePage',
    label: SHORTCUT_LABELS.capturePage,
  },
  {
    description: '앱 안에서 메모 검색을 엽니다.',
    enDescription: 'Opens memo search in the app.',
    enLabel: 'Search memos',
    field: 'openSearch',
    label: SHORTCUT_LABELS.openSearch,
  },
];

const EDITABLE_APP_SHORTCUTS: Array<{
  description: string;
  enDescription: string;
  enLabel: string;
  field: keyof AppShortcutSettings;
  label: string;
}> = [
  { description: '새 메모 초안을 엽니다.', enDescription: 'Opens a new memo draft.', enLabel: 'Create memo', field: 'createMemo', label: APP_SHORTCUT_LABELS.createMemo },
  { description: '현재 패널에 빈 새 탭을 엽니다.', enDescription: 'Opens an empty tab in the current pane.', enLabel: 'Create tab', field: 'createTab', label: APP_SHORTCUT_LABELS.createTab },
  { description: '현재 포커스된 탭을 닫습니다.', enDescription: 'Closes the focused tab.', enLabel: 'Close current tab', field: 'closeActiveTab', label: APP_SHORTCUT_LABELS.closeActiveTab },
  { description: '현재 패널의 이전 탭으로 이동합니다.', enDescription: 'Moves to the previous tab in the current pane.', enLabel: 'Previous tab', field: 'focusPreviousTab', label: APP_SHORTCUT_LABELS.focusPreviousTab },
  { description: '현재 패널의 다음 탭으로 이동합니다.', enDescription: 'Moves to the next tab in the current pane.', enLabel: 'Next tab', field: 'focusNextTab', label: APP_SHORTCUT_LABELS.focusNextTab },
  { description: '메모 사이드바를 열거나 접습니다.', enDescription: 'Opens or collapses the memo sidebar.', enLabel: 'Toggle sidebar', field: 'toggleSidebar', label: APP_SHORTCUT_LABELS.toggleSidebar },
  { description: '메모 탭으로 이동합니다.', enDescription: 'Moves to the memo tab.', enLabel: 'Open memos', field: 'openMemos', label: APP_SHORTCUT_LABELS.openMemos },
  { description: '캘린더 탭으로 이동합니다.', enDescription: 'Moves to the calendar tab.', enLabel: 'Open calendar', field: 'openCalendar', label: APP_SHORTCUT_LABELS.openCalendar },
  { description: '링크 저장함 탭으로 이동합니다.', enDescription: 'Moves to the Inbox tab.', enLabel: 'Open Inbox', field: 'openInbox', label: APP_SHORTCUT_LABELS.openInbox },
  { description: 'Topics 탭으로 이동합니다.', enDescription: 'Moves to the Topics tab.', enLabel: 'Open Topics', field: 'openTopics', label: APP_SHORTCUT_LABELS.openTopics },
  { description: '이전 분할 패널로 이동합니다.', enDescription: 'Moves to the previous split pane.', enLabel: 'Previous pane', field: 'focusPreviousPane', label: APP_SHORTCUT_LABELS.focusPreviousPane },
  { description: '다음 분할 패널로 이동합니다.', enDescription: 'Moves to the next split pane.', enLabel: 'Next pane', field: 'focusNextPane', label: APP_SHORTCUT_LABELS.focusNextPane },
  { description: '새 분할 패널을 엽니다.', enDescription: 'Opens a new split pane.', enLabel: 'Create split pane', field: 'createSplitPane', label: APP_SHORTCUT_LABELS.createSplitPane },
  { description: '추천된 문장을 미리보기 패널에서 엽니다.', enDescription: 'Opens the suggested passage in Preview.', enLabel: 'Open passage preview', field: 'openAmbientDetail', label: APP_SHORTCUT_LABELS.openAmbientDetail },
  { description: '연결된 문장 목록을 미리보기 패널에서 엽니다.', enDescription: 'Opens related passages in Preview.', enLabel: 'Open related passages', field: 'openAmbientList', label: APP_SHORTCUT_LABELS.openAmbientList },
];

const APP_SHORTCUT_SECTIONS: Array<{
  description?: string;
  enDescription?: string;
  enTitle: string;
  fields: Array<keyof AppShortcutSettings>;
  title: string;
}> = [
  {
    fields: [
      'createMemo',
      'createTab',
      'closeActiveTab',
      'focusPreviousTab',
      'focusNextTab',
      'toggleSidebar',
      'focusPreviousPane',
      'focusNextPane',
      'createSplitPane',
    ],
    enTitle: 'Notes & tabs',
    title: '노트 및 탭',
  },
  {
    enTitle: 'Navigate',
    fields: ['openMemos', 'openCalendar', 'openInbox', 'openTopics'],
    title: '화면 전환',
  },
  {
    description: '추천이 표시된 경우에만 동작합니다.',
    enDescription: 'Available when a suggestion is showing.',
    enTitle: 'Related passages',
    fields: ['openAmbientDetail', 'openAmbientList'],
    title: '연결된 문장',
  },
];

const PROVIDER_LABELS: Record<string, { en: string; ko: string }> = {
  email: { en: 'Subnota account', ko: 'Subnota 계정' },
  google: { en: 'Google', ko: 'Google' },
  kakao: { en: 'Kakao', ko: '카카오' },
};

const ENGLISH_RESERVED_SHORTCUT_LABELS: Record<string, string> = {
  '개발자 도구': 'Developer tools',
  '강력 새로고침': 'Hard reload',
  '다시 실행': 'Redo',
  '모두 선택': 'Select all',
  '붙여넣기': 'Paste',
  '복사': 'Copy',
  '새로고침': 'Reload',
  '서식 없이 붙여넣기': 'Paste without formatting',
  '설정 열기': 'Open settings',
  '실행 취소': 'Undo',
  '앱 종료': 'Quit app',
  '잘라내기': 'Cut',
  '창 닫기': 'Close window',
};

const providerLabelFor = (
  provider: string | null | undefined,
  language: AppSettings['uiLanguage'],
) => {
  const label = PROVIDER_LABELS[provider ?? 'email'];
  return label
    ? localize(language, label.ko, label.en)
    : provider ?? localize(language, 'Subnota 계정', 'Subnota account');
};

export default function SettingsModal(props: SettingsModalProps) {
  const t = (korean: string, english: string) =>
    localize(props.appSettings.uiLanguage, korean, english);
  const deleteWord = props.appSettings.uiLanguage === 'en' ? 'DELETE' : '삭제';
  const platformFeatures = window.electronAPI?.getPlatformFeatures?.();
  const editableShortcuts = platformFeatures?.captureShortcut === false
    ? EDITABLE_SHORTCUTS.filter(item => item.field !== 'capturePage')
    : EDITABLE_SHORTCUTS;
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [active, setActive] = useState(SETTINGS_SECTIONS[0].id);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: 'error' | 'success';
  } | null>(null);
  const [isWorking, setWorking] = useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingAccount, setDeletingAccount] = useState(false);
  const [shortcutDraft, setShortcutDraft] = useState(props.shortcuts);
  const [appShortcutDraft, setAppShortcutDraft] = useState(props.appShortcuts);
  const [recording, setRecording] = useState<EditableShortcutField | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  // 검색 모델 상태는 설정을 열 때 한 번 읽는다.
  const [embeddingStatus, setEmbeddingStatus] =
    useState<LocalEmbeddingStatusBridge | null>(null);
  useEffect(() => {
    if (!props.isOpen) return;
    void window.electronAPI
      ?.localEmbedStatus?.()
      .then(next => setEmbeddingStatus(next ?? null));
  }, [props.isOpen]);

  useEffect(() => {
    if (!props.isOpen || embeddingStatus?.state !== 'downloading') return;
    const interval = window.setInterval(() => {
      void window.electronAPI
        ?.localEmbedStatus?.()
        .then(next => setEmbeddingStatus(next ?? null));
    }, 500);
    return () => window.clearInterval(interval);
  }, [embeddingStatus?.state, props.isOpen]);
  const viewportRef = useRef<HTMLElement>(null);
  const shortcutValues = { ...appShortcutDraft, ...shortcutDraft };
  const shortcutLabels = Object.fromEntries(
    [...EDITABLE_APP_SHORTCUTS, ...EDITABLE_SHORTCUTS].map(item => [
      item.field,
      localize(props.appSettings.uiLanguage, item.label, item.enLabel),
    ]),
  ) as Record<EditableShortcutField, string>;
  const shortcutFields = [
    ...EDITABLE_APP_SHORTCUTS.map(item => item.field),
    ...editableShortcuts.map(item => item.field),
  ];
  const shortcutConflicts = findShortcutConflictsForFields(
    shortcutValues,
    {
      fields: shortcutFields,
      labels: shortcutLabels,
      reserved: APP_SHORTCUT_RESERVED.map(item => ({
        ...item,
        label:
          props.appSettings.uiLanguage === 'en'
            ? ENGLISH_RESERVED_SHORTCUT_LABELS[item.label] ?? item.label
            : item.label,
      })),
    },
  );
  const hasShortcutConflict = Object.keys(shortcutConflicts).length > 0;

  /* OAuth 계정에는 바꿀 비밀번호가 없다. 여기서 재설정을 보내면 비밀번호가
     없던 계정에 비밀번호를 만들어 주는 셈이고(두 번째 로그인 수단이 생긴다),
     로그아웃까지 되는데 사용자는 왜 나갔는지 알 수 없다.
     provider가 비어 있으면 이메일 계정으로 본다 — 바로 아래 "로그인 방식"
     행과 같은 판단이다. */
  const authProvider = props.provider ?? 'email';
  const isPasswordAccount = authProvider === 'email';
  const providerLabel = providerLabelFor(authProvider, props.appSettings.uiLanguage);

  useEffect(() => {
    if (props.isOpen) {
      setExpandedRow(null);
      setFeedback(null);
      setRecording(null);
      setRestoreFile(null);
      setDeleteDialogOpen(false);
      setDeleteConfirmation('');
      setDeleteError(null);
      setDeletingAccount(false);
      viewportRef.current?.scrollTo({ top: 0 });
    }
  }, [props.isOpen]);

  // 저장·복원·다른 창의 변경이 반영될 때만 draft를 맞춘다. 열림 초기화
  // 효과에 묶어 두면 저장 직후 탭이 첫 섹션으로 튀고 결과 메시지가 지워진다.
  useEffect(() => {
    setShortcutDraft(props.shortcuts);
    setAppShortcutDraft(props.appShortcuts);
  }, [props.appShortcuts, props.shortcuts]);

  // 녹화 중에는 OS 글로벌 단축키를 내려 둔다. 켜져 있으면 Alt+S 같은 조합이
  // 렌더러에 오기 전에 Mini 창을 띄우고, 포커스를 뺏겨 녹화가 취소된다.
  // isOpen도 함께 본다. 녹화 중에 모달을 닫으면 버튼만 언마운트되고 이
  // 효과는 살아 있어서, 조건이 recording뿐이면 글로벌 단축키가 내려간 채로
  // 남는다.
  useEffect(() => {
    if (!recording || !props.isOpen) {
      return;
    }
    void window.electronAPI?.suspendGlobalShortcuts?.(true);
    return () => {
      void window.electronAPI?.suspendGlobalShortcuts?.(false);
    };
  }, [props.isOpen, recording]);

  useEffect(() => {
    setExpandedRow(null);
    viewportRef.current?.scrollTo({ top: 0 });
  }, [active]);

  const selectNav = (id: string) => {
    setActive(id);
  };

  const run = async <T,>(
    action: () => Promise<T>,
    success: string | ((result: T) => string | null),
  ) => {
    setWorking(true);
    setFeedback(null);
    try {
      const result = await action();
      const message = typeof success === 'function' ? success(result) : success;
      if (message) {
        setFeedback({ message, tone: 'success' });
      }
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : t('요청을 완료하지 못했습니다.', 'Could not complete the request.'),
        tone: 'error',
      });
    } finally {
      setWorking(false);
    }
  };

  const openDeleteDialog = () => {
    if (!props.isSignedIn || !props.isOnline || isDeletingAccount) {
      return;
    }
    setDeleteConfirmation('');
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const submitDeleteAccount = async () => {
    if (deleteConfirmation.trim() !== deleteWord || isDeletingAccount) {
      return;
    }

    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await props.onDeleteAccount();
    } catch (error) {
      setDeletingAccount(false);
      setDeleteError(
        error instanceof Error &&
        error.name !== 'TypeError' &&
        error.message.trim()
          ? error.message
          : t(
              '계정 삭제를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
              'Could not delete your account. Please try again shortly.',
            ),
      );
    }
  };

  const updateAppSettings = (patch: Partial<AppSettings>) =>
    props.onAppSettingsChange({ ...props.appSettings, ...patch });

  const updateDesktopPreferences = (
    patch: Partial<SettingsModalProps['desktopPreferences']>,
  ) =>
    run(
      () =>
        props.onDesktopPreferencesChange({
          ...props.desktopPreferences,
          ...patch,
        }),
      t('일반 설정을 저장했습니다.', 'General settings saved.'),
    );

  const isDark =
    colorScheme === 'dark' ||
    document.documentElement.classList.contains('dark');

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setColorScheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    window.localStorage?.setItem('subnota.theme', next);
  };

  const captureShortcut =
    (field: EditableShortcutField) => (event: React.KeyboardEvent) => {
      event.preventDefault();
      // preventDefault는 기본 동작만 막는다. 전파를 끊지 않으면 window에 붙은
      // 앱 단축키 리스너가 녹화 중인 키를 그대로 실행한다.
      event.stopPropagation();
      if (event.key === 'Escape') {
        setRecording(null);
        return;
      }

      const accelerator = keyboardEventToAccelerator(event, {
        requireModifier: true,
      });
      if (!accelerator) {
        // 조합 키 단독(⌘만 누름)은 아직 입력 중이므로 조용히 넘긴다.
        if (!['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) {
          setFeedback({
            message: t(
              `${formatHotkeyModifierHint()} 중 하나를 함께 눌러 주세요.`,
              `Hold ${formatHotkeyModifierHint()} with another key.`,
            ),
            tone: 'error',
          });
        }
        return;
      }

      const candidate = { ...shortcutValues, [field]: accelerator };
      const conflict = findShortcutConflictsForFields(candidate, {
        fields: shortcutFields,
        labels: shortcutLabels,
        reserved: APP_SHORTCUT_RESERVED.map(item => ({
          ...item,
          label:
            props.appSettings.uiLanguage === 'en'
              ? ENGLISH_RESERVED_SHORTCUT_LABELS[item.label] ?? item.label
              : item.label,
        })),
      })[field];
      if (conflict) {
        setFeedback({
          message: t(
            `'${conflict}'에 이미 할당된 조합입니다. 다른 단축키를 선택해 주세요.`,
            `'${conflict}' is already assigned. Choose another shortcut.`,
          ),
          tone: 'error',
        });
        return;
      }

      setFeedback(null);
      if (isGlobalShortcutField(field)) {
        setShortcutDraft(current => ({ ...current, [field]: accelerator }));
      } else {
        setAppShortcutDraft(current => ({ ...current, [field]: accelerator }));
      }
      setRecording(null);
    };

  const restoreShortcut = (field: EditableShortcutField) => {
    setFeedback(null);
    if (isGlobalShortcutField(field)) {
      setShortcutDraft(current => ({ ...current, [field]: props.shortcuts[field] }));
      return;
    }
    setAppShortcutDraft(current => ({ ...current, [field]: props.appShortcuts[field] }));
  };

  const nav = (
    <SettingsNav
      active={active}
      language={props.appSettings.uiLanguage}
      onSelect={selectNav}
    />
  );

  const content = (
    <main className="settings-reference-main" ref={viewportRef}>
      <Title className="settings-reference-page-title" order={2}>
        {(() => {
          const section = SETTINGS_SECTIONS.find(item => item.id === active);
          return section
            ? localize(props.appSettings.uiLanguage, section.label, section.enLabel)
            : t('설정', 'Settings');
        })()}
      </Title>

      {active === 'general' && (
        <SettingsGeneralSection
          appSettings={props.appSettings}
          desktopPreferences={props.desktopPreferences}
          expandedRow={expandedRow}
          onAppSettingsChange={updateAppSettings}
          onDesktopPreferencesChange={patch => {
            void updateDesktopPreferences(patch);
          }}
          onSetExpandedRow={setExpandedRow}
          translate={t}
        />
      )}

      {active === 'appearance' && (
        <SettingsAppearanceSection
          appSettings={props.appSettings}
          expandedRow={expandedRow}
          isDark={isDark}
          onAppSettingsChange={updateAppSettings}
          onSetExpandedRow={setExpandedRow}
          onToggleTheme={toggleTheme}
          translate={t}
        />
      )}

      {active === 'sync' && (
        <SettingsSyncSection
          appLanguage={props.appSettings.uiLanguage}
          embeddingStatus={embeddingStatus}
          failedSyncCount={props.failedSyncCount}
          isOnline={props.isOnline}
          isSignedIn={props.isSignedIn}
          isSyncing={props.isSyncing}
          isWorking={isWorking}
          lastSyncAt={props.lastSyncAt}
          onChooseStorage={async () => {
            const info = await props.onChooseStorage();
            return info;
          }}
          onDeleteEmbeddingModel={async () => {
            const next = await window.electronAPI?.localEmbedDeleteModel?.();
            setEmbeddingStatus(next ?? null);
            if (!next || next.state !== 'absent') {
              throw new Error(
                next?.error ??
                  t(
                    '검색 모델을 삭제하지 못했습니다.',
                    'Could not delete the search model.',
                  ),
              );
            }
            return next;
          }}
          onDownloadEmbeddingModel={async () => {
            const initial = await window.electronAPI?.localEmbedStatus?.();
            if (initial) {
              setEmbeddingStatus({
                ...initial,
                error: undefined,
                ready: false,
                state: 'downloading',
              });
            }
            const next = await window.electronAPI?.localEmbedDownloadModel?.();
            setEmbeddingStatus(next ?? null);
            if (!next || next.state !== 'ready') {
              throw new Error(
                next?.error ??
                  t(
                    '검색 모델을 받지 못했습니다.',
                    'Could not download the search model.',
                  ),
              );
            }
            return next;
          }}
          onOpenStorage={props.onOpenStorage}
          onSync={props.onSync}
          pendingSyncCount={props.pendingSyncCount}
          run={(action, success) => {
            void run(action, success);
          }}
          storageInfo={props.storageInfo}
          translate={t}
        />
      )}

      {active === 'backup' && (
        <SettingsBackupSection
          inboxData={props.inboxData}
          isWorking={isWorking}
          onBackup={props.onBackup}
          onExportJson={props.onExportJson}
          onRestore={props.onRestore}
          onRestoreFileChange={setRestoreFile}
          restoreFile={restoreFile}
          run={(action, success) => {
            void run(action, success);
          }}
          scheduleData={props.scheduleData}
          translate={t}
        />
      )}

      {active === 'hotkeys' && (
        <SettingsHotkeysSection
          appShortcutDraft={appShortcutDraft}
          appShortcuts={props.appShortcuts}
          appShortcutSections={APP_SHORTCUT_SECTIONS}
          editableAppShortcuts={EDITABLE_APP_SHORTCUTS}
          editableShortcuts={editableShortcuts}
          hasShortcutConflict={hasShortcutConflict}
          isWorking={isWorking}
          language={props.appSettings.uiLanguage}
          onCancelRecording={field => {
            setRecording(current => (current === field ? null : current));
          }}
          onCaptureShortcut={captureShortcut}
          onResetShortcut={restoreShortcut}
          onRestoreDefaults={() =>
            void run(async () => {
              await props.onResetAppShortcuts();
              await props.onResetShortcuts();
              setAppShortcutDraft(DEFAULT_APP_SHORTCUT_SETTINGS);
              setShortcutDraft(DEFAULT_SHORTCUT_SETTINGS);
            }, t('기본 단축키로 복원했습니다.', 'Default shortcuts restored.'))
          }
          onSave={() =>
            void run(async () => {
              const result = await props.onSaveShortcuts(shortcutDraft);
              // main이 등록에 실패하면 이전 설정으로 롤백된다.
              // 그 사실을 알리지 않으면 화면의 draft와 실제가 어긋난다.
              if (result && (!result.capture || !result.toggle)) {
                setShortcutDraft(props.shortcuts);
                const failed = result.toggle
                  ? localize(
                      props.appSettings.uiLanguage,
                      SHORTCUT_LABELS.capturePage,
                      'Save current page',
                    )
                  : localize(
                      props.appSettings.uiLanguage,
                      SHORTCUT_LABELS.toggleMini,
                      'Open Quick Subnota',
                    );
                throw new Error(
                  t(
                    `'${failed}' 단축키를 운영체제에 등록하지 못했습니다. 다른 조합을 선택해 주세요.`,
                    `Could not register '${failed}' with the operating system. Choose another shortcut.`,
                  ),
                );
              }
              await props.onSaveAppShortcuts(appShortcutDraft);
            }, t('단축키를 저장했습니다.', 'Shortcuts saved.'))
          }
          onStartRecording={field => {
            setFeedback(null);
            setRecording(field);
          }}
          recording={recording}
          shortcutConflicts={shortcutConflicts}
          shortcutDraft={shortcutDraft}
          shortcuts={props.shortcuts}
        />
      )}

      {active === 'account' && (
        <SettingsAccountSection
          email={props.email}
          isOnline={props.isOnline}
          isPasswordAccount={isPasswordAccount}
          isSignedIn={props.isSignedIn}
          isWorking={isWorking}
          onOpenDeleteDialog={openDeleteDialog}
          onPasswordReset={() => {
            // 되돌릴 수 없고 이 기기에서 로그아웃까지 된다. 무슨 일이
            // 일어나는지 먼저 말하고 확인을 받는다.
            if (
              !window.confirm(
                t(
                  '비밀번호를 재설정하시겠습니까?\n\n재설정 코드를 메일로 보내고 이 기기에서 로그아웃합니다. 로그인 화면에서 코드를 입력해 새 비밀번호를 정하세요.',
                  'Reset your password?\n\nWe will email a reset code and sign out this device. Enter the code on the sign-in screen to choose a new password.',
                ),
              )
            ) {
              return;
            }
            void run(
              props.onPasswordReset,
              t('재설정 코드를 보냈습니다.', 'Reset code sent.'),
            );
          }}
          onSignOut={props.onSignOut}
          provider={props.provider}
          providerLabel={providerLabel}
          providerValueLabel={t(
            `${providerLabelFor(props.provider, props.appSettings.uiLanguage)} 로그인`,
            `Signed in with ${providerLabelFor(
              props.provider,
              props.appSettings.uiLanguage,
            )}`,
          )}
          translate={t}
        />
      )}

      {active === 'about' && (
        <SettingsAboutSection
          onCheckUpdates={props.onCheckUpdates}
          run={run}
          translate={t}
        />
      )}

      {feedback && (
        <Text
          c={feedback.tone === 'error' ? 'red' : 'dimmed'}
          className="settings-reference-feedback"
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          size="sm"
        >
          {feedback.message}
        </Text>
      )}
    </main>
  );

  return (
    <>
      <Modal
        centered
        onClose={() => {
          if (!isDeletingAccount) {
            props.onClose();
          }
        }}
        opened={props.isOpen}
        overlayProps={{ backgroundOpacity: 0.38, blur: 3 }}
        padding={0}
        radius={13}
        size="min(860px, calc(100vw - 24px))"
        title={null}
        withCloseButton={false}
        xOffset={12}
        yOffset={12}
        styles={{
          body: { padding: 0 },
          content: {
            background: 'transparent',
            boxShadow: 'none',
            overflow: 'visible',
          },
        }}
      >
        <style>{SETTINGS_CSS}</style>
        <div className="settings-reference-frame">
          <div className="settings-reference">
            {nav}
            {content}
          </div>
          <button
            aria-label={t('설정 닫기', 'Close settings')}
            className="settings-reference-close"
            disabled={isDeletingAccount}
            onClick={props.onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </Modal>

      <SettingsDeleteAccountDialog
        deleteConfirmation={deleteConfirmation}
        deleteError={deleteError}
        deleteWord={deleteWord}
        isDeletingAccount={isDeletingAccount}
        isOpen={isDeleteDialogOpen}
        onCancel={() => setDeleteDialogOpen(false)}
        onChangeConfirmation={setDeleteConfirmation}
        onClose={() => {
          if (!isDeletingAccount) {
            setDeleteDialogOpen(false);
          }
        }}
        onSubmit={() => void submitDeleteAccount()}
        translate={t}
      />
    </>
  );
}
