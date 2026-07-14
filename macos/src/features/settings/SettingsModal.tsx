import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Anchor,
  Badge,
  Box,
  Button,
  Divider,
  FileButton,
  Group,
  Kbd,
  Modal,
  NumberInput,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  Title,
  useMantineColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  InformationCircleIcon,
  SwatchIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { APP_HOTKEYS } from '../../hooks/useAppHotkeys';
import { AppSettings, CloseBehavior } from '../../lib/appSettings';
import { DARK_MODE_ENABLED } from '../../lib/constants';
import {
  DEFAULT_SHORTCUT_SETTINGS,
  ShortcutSettings,
} from '../../lib/shortcutSettings';

interface ShortcutSaveResult {
  capture: boolean;
  toggle: boolean;
}

interface SettingsModalProps {
  appSettings: AppSettings;
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
  onChooseStorage: () => Promise<void>;
  onClose: () => void;
  onDesktopPreferencesChange: (preferences: {
    closeBehavior: CloseBehavior;
    launchAtLogin: boolean;
  }) => Promise<void>;
  onExportJson: (name: string, value: unknown) => Promise<string | null>;
  onOpenStorage: () => Promise<void>;
  onPasswordReset: () => Promise<void>;
  onResetShortcuts: () => Promise<ShortcutSaveResult | void>;
  onRestore: (file: File) => Promise<void>;
  onSaveShortcuts: (
    settings: ShortcutSettings,
  ) => Promise<ShortcutSaveResult | void>;
  onSignOut: () => void;
  onSync: () => void;
}

type IconComponent = typeof Cog6ToothIcon;

const REFERENCE_CSS = `
.settings-reference-frame {
  --ref-text: #222222;
  --ref-selected: #f3f3f3;
  width: min(820px, calc(100vw - 24px));
  height: min(600px, calc(100dvh - 24px));
  position: relative;
  overflow: hidden;
  border-radius: 18px;
}

.settings-reference {
  --ref-bg: #ffffff;
  --ref-text: #222222;
  --ref-muted: #767676;
  --ref-line: #e7e7e7;
  --ref-selected: #f3f3f3;
  --ref-focus: #222222;
  --ref-scale: 0.76;
  display: flex;
  width: calc(100% / var(--ref-scale));
  height: calc(100% / var(--ref-scale));
  background: var(--ref-bg);
  color: var(--ref-text);
  border: 1px solid #cfd7e1;
  border-radius: 22px;
  overflow: hidden;
  transform: scale(var(--ref-scale));
  transform-origin: top left;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.settings-reference * {
  box-sizing: border-box;
}

.settings-reference-sidebar {
  flex: 0 0 320px;
  width: 320px;
  padding: 29px 16px 32px;
  border-right: 1px solid var(--ref-line);
  background: #ffffff;
}

.settings-reference-sidebar-title {
  margin: 0 24px 43px;
  font-size: 26px;
  line-height: 1.16;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--ref-text);
}

.settings-reference-nav {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.settings-reference-nav-button.mantine-Button-root {
  width: 100%;
  height: 58px;
  padding: 0 18px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--ref-text);
  font-size: 18px;
  line-height: 1.2;
  font-weight: 400;
  letter-spacing: 0;
  justify-content: flex-start;
}

.settings-reference-nav-button .mantine-Button-inner {
  justify-content: flex-start;
}

.settings-reference-nav-button .mantine-Button-section {
  margin-inline-end: 17px;
}

.settings-reference-nav-button svg {
  width: 25px;
  height: 25px;
  stroke-width: 1.9;
}

.settings-reference-nav-button[data-active] {
  background: var(--ref-selected);
}

.settings-reference-nav-button:hover,
.settings-reference-nav-button:active {
  background: var(--ref-selected);
}

.settings-reference-nav-button:focus-visible,
.settings-reference-link:focus-visible,
.settings-reference-mobile-back:focus-visible,
.settings-reference-shortcut-record:focus-visible {
  outline: 2px solid var(--ref-focus);
  outline-offset: 2px;
}

.settings-reference-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 29px 24px 72px;
  scrollbar-width: none;
}

.settings-reference-main::-webkit-scrollbar {
  display: none;
}

.settings-reference-page-title {
  margin: 0 0 49px;
  font-size: 26px;
  line-height: 1.16;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--ref-text);
}

.settings-reference-sections {
  display: flex;
  flex-direction: column;
  gap: 49px;
}

.settings-reference-section-title {
  margin: 0 0 7px;
  font-size: 23px;
  line-height: 1.18;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--ref-text);
}

.settings-reference-section-divider {
  margin: 0;
  border-color: var(--ref-line);
}

.settings-reference-row {
  min-height: 98px;
  padding: 23px 0 22px;
}

.settings-reference-row-label {
  margin: 0;
  color: var(--ref-text);
  font-size: 18px;
  line-height: 1.23;
  font-weight: 600;
  letter-spacing: 0;
}

.settings-reference-row-value {
  margin-top: 4px;
  color: var(--ref-muted);
  font-size: 17px;
  line-height: 1.22;
  font-weight: 400;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.settings-reference-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ref-text);
  font-size: 18px;
  line-height: 1.23;
  font-weight: 400;
  letter-spacing: 0;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}

.settings-reference-link:hover {
  color: var(--ref-text);
  text-decoration: underline;
}

.settings-reference-link[aria-disabled="true"] {
  color: var(--ref-muted);
  cursor: default;
  text-decoration: none;
}

.settings-reference-badge.mantine-Badge-root {
  height: 29px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: #eeeeee;
  color: #333333;
  font-size: 15px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.settings-reference-provider-value {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.settings-reference-provider-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}

.settings-reference-subnota-logo {
  border-radius: 6px;
  background: #1e1e1e;
  color: #ffffff;
  font-family: Helvetica, Arial, sans-serif;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
}

.settings-reference-close.mantine-Button-root {
  position: absolute;
  top: 13px;
  right: 13px;
  z-index: 2;
  width: 34px;
  height: 34px;
  min-width: 34px;
  padding: 0;
  border: 0;
  border-radius: 17px;
  background: transparent;
  color: var(--ref-text);
}

.settings-reference-close.mantine-Button-root:hover,
.settings-reference-close.mantine-Button-root:active {
  background: var(--ref-selected);
}

.settings-reference-close svg {
  width: 17px;
  height: 17px;
  stroke-width: 2;
}

.settings-reference-expanded {
  padding: 23px 0 22px;
}

.settings-reference-save.mantine-Button-root,
.settings-reference-cancel.mantine-Button-root {
  height: 40px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 16px;
  line-height: 1;
  font-weight: 600;
}

.settings-reference-save.mantine-Button-root {
  background: var(--ref-text);
  color: #ffffff;
}

.settings-reference-cancel.mantine-Button-root {
  background: transparent;
  color: var(--ref-text);
}

.settings-reference-segmented .mantine-SegmentedControl-root {
  background: #f3f3f3;
}

.settings-reference-shortcut-record {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 190px;
  min-height: 40px;
  padding: 4px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
}

.settings-reference-shortcut-record:hover {
  background: var(--ref-selected);
}

.settings-reference-shortcut-record[data-recording] {
  border-color: var(--ref-text);
  box-shadow: 0 0 0 1px var(--ref-text);
}

.settings-reference-feedback {
  margin-top: 28px;
}

.settings-reference-mobile-header {
  display: none;
}

@media (max-width: 768px) {
  .settings-reference-frame {
    width: calc(100vw - 24px);
    height: min(600px, calc(100dvh - 24px));
  }

  .settings-reference {
    --ref-scale: 1;
    display: block;
  }

  .settings-reference-sidebar {
    width: 100%;
    border-right: 0;
  }

  .settings-reference-main {
    padding: 24px;
  }

  .settings-reference-mobile-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 28px;
  }

  .settings-reference-mobile-back.mantine-Button-root {
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: 20px;
    background: transparent;
    color: var(--ref-text);
  }

  .settings-reference-mobile-back svg {
    width: 22px;
    height: 22px;
  }

  .settings-reference-page-title {
    margin-bottom: 35px;
  }
}
`;

const SECTIONS: Array<{
  icon: IconComponent;
  id: string;
  label: string;
}> = [
  { icon: Cog6ToothIcon, id: 'general', label: '일반' },
  { icon: SwatchIcon, id: 'appearance', label: '화면 및 편집기' },
  { icon: ArrowPathIcon, id: 'sync', label: '동기화 및 저장소' },
  { icon: CircleStackIcon, id: 'backup', label: '백업 및 데이터' },
  { icon: CommandLineIcon, id: 'hotkeys', label: '단축키' },
  { icon: UserCircleIcon, id: 'account', label: '계정' },
  { icon: InformationCircleIcon, id: 'about', label: '정보' },
];

const EDITABLE_SHORTCUTS: Array<{
  description: string;
  field: keyof ShortcutSettings;
  label: string;
}> = [
  {
    description: '어디서든 빠른 메모 패널을 엽니다.',
    field: 'toggleMini',
    label: 'Mini Subnota 열기',
  },
  {
    description: '현재 브라우저 페이지를 웹 Inbox로 보냅니다.',
    field: 'capturePage',
    label: '현재 페이지 저장',
  },
  {
    description: '앱 안에서 메모 검색을 엽니다.',
    field: 'openSearch',
    label: '메모 검색',
  },
];

const PROVIDER_LABELS: Record<string, string> = {
  email: 'Subnota 계정',
  google: 'Google',
  kakao: '카카오',
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const formatShortcutKey = (key: string) => {
  const normalized = key.trim();
  if (normalized === 'mod' || normalized === 'CommandOrControl') return '⌘/Ctrl';
  if (normalized === 'Command' || normalized === 'Cmd') return '⌘';
  if (normalized === 'Control' || normalized === 'Ctrl') return 'Ctrl';
  if (normalized === 'Shift') return '⇧';
  if (normalized === 'Alt' || normalized === 'Option') return '⌥';
  if (normalized === 'Plus') return '+';
  if (normalized === 'Comma') return ',';
  return normalized;
};

function RowAction({
  children,
  color,
  disabled,
  onClick,
}: {
  children: ReactNode;
  color?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Anchor
      aria-disabled={disabled ? 'true' : undefined}
      c={color}
      className="settings-reference-link"
      component="button"
      onClick={disabled ? undefined : onClick}
      type="button"
    >
      {children}
    </Anchor>
  );
}

function Hotkey({ value }: { value: string }) {
  if (!value.trim()) {
    return (
      <Badge className="settings-reference-badge" variant="filled">
        미설정
      </Badge>
    );
  }

  return (
    <Group gap={4} wrap="nowrap">
      {value.split('+').map((key, index) => (
        <Kbd key={`${key}-${index}`}>{formatShortcutKey(key)}</Kbd>
      ))}
    </Group>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="settings-reference-provider-icon"
      viewBox="0 0 24 24"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function SubnotaIcon() {
  return (
    <span
      aria-hidden="true"
      className="settings-reference-provider-icon settings-reference-subnota-logo"
    >
      M
    </span>
  );
}

function ProviderValue({
  label,
  provider,
}: {
  label: string;
  provider?: string | null;
}) {
  const isGoogle = provider?.toLowerCase() === 'google';

  return (
    <span className="settings-reference-provider-value">
      {isGoogle ? <GoogleIcon /> : <SubnotaIcon />}
      <span>{label}</span>
    </span>
  );
}

function Row({
  action,
  description,
  label,
}: {
  action?: ReactNode;
  description?: ReactNode;
  label: ReactNode;
}) {
  return (
    <>
      <Group
        align="flex-start"
        className="settings-reference-row"
        gap={24}
        justify="space-between"
        wrap="nowrap"
      >
        <Box miw={0}>
          <Text className="settings-reference-row-label">{label}</Text>
          {description && (
            <Text className="settings-reference-row-value">{description}</Text>
          )}
        </Box>
        {action}
      </Group>
      <Divider className="settings-reference-section-divider" />
    </>
  );
}

function Section({
  children,
  description,
  title,
}: {
  children?: ReactNode;
  description?: ReactNode;
  title: string;
}) {
  return (
    <section>
      <Title className="settings-reference-section-title" order={3}>
        {title}
      </Title>
      {description && (
        <Text className="settings-reference-row-value" mb={13}>
          {description}
        </Text>
      )}
      <Divider className="settings-reference-section-divider" />
      {children}
    </section>
  );
}

function ExpandableRow({
  children,
  expanded,
  label,
  onClose,
  onOpen,
  value,
}: {
  children: ReactNode;
  expanded: boolean;
  label: string;
  onClose: () => void;
  onOpen: () => void;
  value: string;
}) {
  if (!expanded) {
    return (
      <Row
        action={<RowAction onClick={onOpen}>편집</RowAction>}
        description={value}
        label={label}
      />
    );
  }

  return (
    <>
      <Stack className="settings-reference-expanded" gap={16}>
        <Text className="settings-reference-row-label">{label}</Text>
        {children}
        <Group gap={8}>
          <Button className="settings-reference-save" onClick={onClose}>
            저장
          </Button>
          <Button
            className="settings-reference-cancel"
            onClick={onClose}
            variant="transparent"
          >
            취소
          </Button>
        </Group>
      </Stack>
      <Divider className="settings-reference-section-divider" />
    </>
  );
}

function Nav({
  active,
  isNarrow,
  onSelect,
}: {
  active: string;
  isNarrow: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="settings-reference-sidebar">
      <h2 className="settings-reference-sidebar-title">계정 설정</h2>
      <nav className="settings-reference-nav">
        {SECTIONS.map(section => {
          const Icon = section.icon;
          return (
            <Button
              className="settings-reference-nav-button"
              data-active={active === section.id ? '' : undefined}
              key={section.id}
              leftSection={<Icon />}
              onClick={() => onSelect(section.id)}
              rightSection={
                isNarrow ? <ChevronRightIcon style={{ marginLeft: 'auto' }} /> : undefined
              }
              variant="transparent"
            >
              {section.label}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}

export default function SettingsModal(props: SettingsModalProps) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const isNarrow = useMediaQuery('(max-width: 768px)');
  const [mobileView, setMobileView] = useState<'nav' | 'detail'>('nav');
  const [active, setActive] = useState(SECTIONS[0].id);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isWorking, setWorking] = useState(false);
  const [shortcutDraft, setShortcutDraft] = useState(props.shortcuts);
  const [recording, setRecording] = useState<keyof ShortcutSettings | null>(null);
  const viewportRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (props.isOpen) {
      setActive(SECTIONS[0].id);
      setExpandedRow(null);
      setFeedback(null);
      setShortcutDraft(props.shortcuts);
      setMobileView('nav');
      viewportRef.current?.scrollTo({ top: 0 });
    }
  }, [props.isOpen, props.shortcuts]);

  useEffect(() => {
    setExpandedRow(null);
    viewportRef.current?.scrollTo({ top: 0 });
  }, [active]);

  const selectNav = (id: string) => {
    setActive(id);
    setMobileView('detail');
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    setWorking(true);
    setFeedback(null);
    try {
      await action();
      setFeedback(success);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : '요청을 완료하지 못했습니다.',
      );
    } finally {
      setWorking(false);
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
      '일반 설정을 저장했습니다.',
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

  const expandable = (row: string) => ({
    expanded: expandedRow === row,
    onClose: () => setExpandedRow(null),
    onOpen: () => setExpandedRow(row),
  });

  const captureShortcut =
    (field: keyof ShortcutSettings) => (event: React.KeyboardEvent) => {
      event.preventDefault();
      if (event.key === 'Escape') {
        setRecording(null);
        return;
      }
      if (['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) {
        return;
      }

      const parts: string[] = [];
      if (event.metaKey || event.ctrlKey) parts.push('CommandOrControl');
      if (event.shiftKey) parts.push('Shift');
      if (event.altKey) parts.push('Alt');
      if (parts.length === 0) return;

      const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      setShortcutDraft(current => ({ ...current, [field]: [...parts, key].join('+') }));
      setRecording(null);
    };

  const sectionTitle =
    SECTIONS.find(section => section.id === active)?.label ?? '설정';

  const nav = (
    <Nav active={active} isNarrow={Boolean(isNarrow)} onSelect={selectNav} />
  );

  const content = (
    <main className="settings-reference-main" ref={viewportRef}>
      {isNarrow && (
        <div className="settings-reference-mobile-header">
          <Button
            aria-label="설정 목록으로 돌아가기"
            className="settings-reference-mobile-back"
            leftSection={<ArrowLeftIcon />}
            onClick={() => setMobileView('nav')}
            variant="transparent"
          />
          <Title className="settings-reference-page-title" order={2}>
            {sectionTitle}
          </Title>
        </div>
      )}

      {!isNarrow && (
        <Title className="settings-reference-page-title" order={2}>
          {sectionTitle}
        </Title>
      )}

      {active === 'general' && (
        <div className="settings-reference-sections">
          <Section title="시작 및 창">
            <Row
              action={
                <Switch
                  checked={props.desktopPreferences.launchAtLogin}
                  className="settings-reference-switch"
                  onChange={event =>
                    void updateDesktopPreferences({
                      launchAtLogin: event.currentTarget.checked,
                    })
                  }
                  size="md"
                />
              }
              description="로그인할 때 Subnota를 자동으로 엽니다."
              label="로그인 시 자동 실행"
            />
            <ExpandableRow
              label="창 닫기 동작"
              value={
                props.desktopPreferences.closeBehavior === 'tray'
                  ? '트레이로 최소화'
                  : '앱 종료'
              }
              {...expandable('closeBehavior')}
            >
              <SegmentedControl
                className="settings-reference-segmented"
                data={[
                  { label: '앱 종료', value: 'quit' },
                  { label: '트레이로 최소화', value: 'tray' },
                ]}
                onChange={value =>
                  void updateDesktopPreferences({
                    closeBehavior: value as CloseBehavior,
                  })
                }
                value={props.desktopPreferences.closeBehavior}
              />
            </ExpandableRow>
            <Row
              action={
                <Switch
                  checked={props.appSettings.restoreWorkspace}
                  className="settings-reference-switch"
                  onChange={event =>
                    updateAppSettings({
                      restoreWorkspace: event.currentTarget.checked,
                    })
                  }
                  size="md"
                />
              }
              description="앱을 열 때 마지막 작업 공간으로 돌아갑니다."
              label="마지막 작업 공간 복원"
            />
            <Row
              action={
                <Switch
                  checked={props.appSettings.autoCheckUpdates}
                  className="settings-reference-switch"
                  onChange={event =>
                    updateAppSettings({
                      autoCheckUpdates: event.currentTarget.checked,
                    })
                  }
                  size="md"
                />
              }
              description="새 버전이 있으면 알려줍니다."
              label="업데이트 자동 확인"
            />
          </Section>
        </div>
      )}

      {active === 'appearance' && (
        <div className="settings-reference-sections">
          <Section title="테마">
            {/* 초기 릴리스: 다크 모드 비활성화(라이트 고정). DARK_MODE_ENABLED로 복원. */}
            <Row
              action={
                DARK_MODE_ENABLED ? (
                  <RowAction onClick={toggleTheme}>전환</RowAction>
                ) : undefined
              }
              description={
                DARK_MODE_ENABLED
                  ? 'Subnota 전체 테마 설정과 동일하게 저장됩니다.'
                  : '이번 버전에서는 다크 모드를 잠시 사용할 수 없습니다.'
              }
              label={DARK_MODE_ENABLED && isDark ? '다크 모드' : '라이트 모드'}
            />
          </Section>
          <Section title="편집기 타이포그래피">
            <ExpandableRow
              label="글자 크기"
              value={`${props.appSettings.fontSize}px`}
              {...expandable('fontSize')}
            >
              <Group align="center" gap={18} wrap="nowrap">
                <Slider
                  flex={1}
                  label={value => `${value}px`}
                  max={24}
                  min={12}
                  onChange={fontSize => updateAppSettings({ fontSize })}
                  value={props.appSettings.fontSize}
                />
                <NumberInput
                  max={24}
                  min={12}
                  onChange={value =>
                    typeof value === 'number' &&
                    updateAppSettings({ fontSize: value })
                  }
                  suffix=" px"
                  value={props.appSettings.fontSize}
                  w={110}
                />
              </Group>
            </ExpandableRow>
            <ExpandableRow
              label="줄 간격"
              value={props.appSettings.lineHeight.toFixed(1)}
              {...expandable('lineHeight')}
            >
              <Slider
                label={value => value.toFixed(1)}
                max={2.2}
                min={1.2}
                onChange={lineHeight => updateAppSettings({ lineHeight })}
                step={0.1}
                value={props.appSettings.lineHeight}
              />
            </ExpandableRow>
          </Section>
        </div>
      )}

      {active === 'sync' && (
        <div className="settings-reference-sections">
          <Section title="동기화 상태">
            <Row
              action={
                <RowAction
                  disabled={!props.isSignedIn || !props.isOnline || props.isSyncing}
                  onClick={props.onSync}
                >
                  {props.isSyncing ? '동기화 중...' : '지금 동기화'}
                </RowAction>
              }
              description={
                props.lastSyncAt
                  ? `마지막 동기화 ${new Date(props.lastSyncAt).toLocaleString()}`
                  : '동기화 기록 없음'
              }
              label={props.isOnline ? '온라인' : '오프라인'}
            />
            <Row
              description={`대기 ${props.pendingSyncCount} · 실패 ${props.failedSyncCount}`}
              label="동기화 큐"
            />
          </Section>
          <Section
            description="위치를 변경하면 데이터베이스를 새 폴더로 복사한 뒤 앱을 다시 불러옵니다."
            title="로컬 저장소"
          >
            <Row
              action={
                <Group gap={18} wrap="nowrap">
                  <RowAction
                    onClick={() =>
                      void run(props.onChooseStorage, '저장소 위치를 변경했습니다.')
                    }
                  >
                    위치 변경
                  </RowAction>
                  <RowAction
                    onClick={() =>
                      void run(props.onOpenStorage, '저장소 폴더를 열었습니다.')
                    }
                  >
                    폴더 열기
                  </RowAction>
                </Group>
              }
              description={`${props.storageInfo?.databasePath ?? '불러오는 중...'} · ${formatBytes(props.storageInfo?.size ?? 0)} 사용`}
              label="SQLite 데이터베이스"
            />
          </Section>
        </div>
      )}

      {active === 'backup' && (
        <div className="settings-reference-sections">
          <Section title="전체 백업">
            <Row
              action={
                <RowAction
                  disabled={isWorking}
                  onClick={() => void run(props.onBackup, '백업을 생성했습니다.')}
                >
                  백업 생성
                </RowAction>
              }
              description="메모, 캘린더, Inbox가 포함된 SQLite 백업을 만듭니다."
              label="전체 데이터 백업"
            />
            <FileButton
              accept=".sqlite3"
              onChange={file => {
                if (file) {
                  void run(() => props.onRestore(file), '백업을 복원했습니다.');
                }
              }}
            >
              {({ onClick }) => (
                <Row
                  action={
                    <RowAction disabled={isWorking} onClick={onClick}>
                      파일 선택
                    </RowAction>
                  }
                  description="백업 파일로 현재 데이터를 교체합니다."
                  label="백업 파일 복원"
                />
              )}
            </FileButton>
          </Section>
          <Section title="JSON 내보내기">
            <Row
              action={
                <RowAction
                  onClick={() =>
                    void run(
                      () => props.onExportJson('subnota-calendar', props.scheduleData),
                      '캘린더 데이터를 내보냈습니다.',
                    )
                  }
                >
                  내보내기
                </RowAction>
              }
              description="모든 캘린더 항목을 JSON 파일로 저장합니다."
              label="캘린더 내보내기"
            />
            <Row
              action={
                <RowAction
                  onClick={() =>
                    void run(
                      () => props.onExportJson('subnota-inbox', props.inboxData),
                      'Inbox 데이터를 내보냈습니다.',
                    )
                  }
                >
                  내보내기
                </RowAction>
              }
              description="Inbox 항목을 JSON 파일로 저장합니다."
              label="Inbox 내보내기"
            />
          </Section>
        </div>
      )}

      {active === 'hotkeys' && (
        <div className="settings-reference-sections">
          <Section title="앱 단축키">
            {APP_HOTKEYS.map(item => (
              <Row
                action={<Hotkey value={item.accelerator} />}
                key={item.accelerator}
                label={item.label}
              />
            ))}
          </Section>
          <Section
            description="이 단축키는 운영체제에 등록됩니다."
            title="글로벌 단축키"
          >
            {EDITABLE_SHORTCUTS.map(item => (
              <Row
                action={
                  <button
                    aria-label={`${item.label} 단축키 변경`}
                    className="settings-reference-shortcut-record"
                    data-recording={recording === item.field ? '' : undefined}
                    onBlur={() =>
                      setRecording(current =>
                        current === item.field ? null : current,
                      )
                    }
                    onClick={() => setRecording(item.field)}
                    onKeyDown={
                      recording === item.field
                        ? captureShortcut(item.field)
                        : undefined
                    }
                    type="button"
                  >
                    {recording === item.field ? (
                      <Text c="dimmed" size="sm">
                        키를 누르세요...
                      </Text>
                    ) : (
                      <Hotkey value={shortcutDraft[item.field]} />
                    )}
                  </button>
                }
                description={item.description}
                key={item.field}
                label={item.label}
              />
            ))}
            <Group justify="flex-end" pt={24}>
              <Button
                className="settings-reference-cancel"
                onClick={() =>
                  void run(async () => {
                    await props.onResetShortcuts();
                    setShortcutDraft(DEFAULT_SHORTCUT_SETTINGS);
                  }, '기본 단축키로 복원했습니다.')
                }
                variant="transparent"
              >
                기본값 복원
              </Button>
              <Button
                className="settings-reference-save"
                onClick={() =>
                  void run(
                    () => props.onSaveShortcuts(shortcutDraft),
                    '단축키를 저장했습니다.',
                  )
                }
              >
                단축키 저장
              </Button>
            </Group>
          </Section>
        </div>
      )}

      {active === 'account' && (
        <div className="settings-reference-sections">
          <Section title="로그인">
            <Row description={props.email ?? '로그인되지 않음'} label="이메일" />
            <Row
              description={
                <ProviderValue
                  label={`${
                    PROVIDER_LABELS[props.provider ?? 'email'] ??
                    props.provider ??
                    'Subnota 계정'
                  } 로그인`}
                  provider={props.provider}
                />
              }
              label="로그인 방식"
            />
            <Row
              action={
                <RowAction
                  disabled={!props.isSignedIn || !props.email}
                  onClick={() =>
                    void run(
                      props.onPasswordReset,
                      '비밀번호 재설정 메일을 보냈습니다.',
                    )
                  }
                >
                  재설정
                </RowAction>
              }
              description="재설정 메일에서 비밀번호를 변경합니다."
              label="비밀번호"
            />
          </Section>
          <Section title="세션">
            <Row
              action={
                <RowAction
                  color="red"
                  disabled={!props.isSignedIn}
                  onClick={props.onSignOut}
                >
                  로그아웃
                </RowAction>
              }
              description="이 기기의 로컬 데이터는 그대로 유지됩니다."
              label="이 기기에서 로그아웃"
            />
          </Section>
        </div>
      )}

      {active === 'about' && (
        <div className="settings-reference-sections">
          <Section title="Subnota">
            <Row
              action={
                <RowAction
                  onClick={() =>
                    void run(async () => {
                      const message = await props.onCheckUpdates();
                      setFeedback(message);
                    }, '업데이트 확인을 완료했습니다.')
                  }
                >
                  업데이트 확인
                </RowAction>
              }
              description="로컬 우선 메모 및 캘린더 워크스페이스"
              label={`버전 ${__APP_VERSION__}`}
            />
          </Section>
        </div>
      )}

      {feedback && (
        <Text
          c="dimmed"
          className="settings-reference-feedback"
          role="status"
          size="sm"
        >
          {feedback}
        </Text>
      )}
    </main>
  );

  return (
    <Modal
      centered
      onClose={props.onClose}
      opened={props.isOpen}
      overlayProps={{ backgroundOpacity: 0.38, blur: 3 }}
      padding={0}
      radius={18}
      size="min(820px, calc(100vw - 24px))"
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
      <style>{REFERENCE_CSS}</style>
      <div className="settings-reference-frame">
        <Button
          aria-label="설정 닫기"
          className="settings-reference-close"
          onClick={props.onClose}
          variant="transparent"
        >
          <XMarkIcon />
        </Button>
        <div className="settings-reference">
          {(!isNarrow || mobileView === 'nav') && nav}
          {(!isNarrow || mobileView === 'detail') && content}
        </div>
      </div>
    </Modal>
  );
}
