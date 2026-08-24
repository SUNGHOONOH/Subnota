import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
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
  TextInput,
  Title,
  Tooltip,
  useMantineColorScheme,
} from '@mantine/core';
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  CircleStackIcon,
  Cog6ToothIcon,
  CommandLineIcon,
  InformationCircleIcon,
  PencilIcon,
  SwatchIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import SubnotaMark from '../../components/SubnotaMark';
import SubnotaSpinner from '../../components/SubnotaSpinner';
import { AppSettings, CloseBehavior } from '../../lib/appSettings';
import { getUiDateLocale, localize } from '../../lib/uiLanguage';
import { DARK_MODE_ENABLED } from '../../lib/constants';
import {
  APP_SHORTCUT_LABELS,
  APP_SHORTCUT_RESERVED,
  AppShortcutSettings,
  DEFAULT_APP_SHORTCUT_SETTINGS,
  DEFAULT_SHORTCUT_SETTINGS,
  findShortcutConflictsForFields,
  formatHotkeyKey,
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

type IconComponent = typeof Cog6ToothIcon;
type EditableShortcutField = keyof ShortcutSettings | keyof AppShortcutSettings;

const isGlobalShortcutField = (
  field: EditableShortcutField,
): field is keyof ShortcutSettings => field in DEFAULT_SHORTCUT_SETTINGS;

const REFERENCE_CSS = `
.settings-reference-frame {
  --ref-text: var(--app-color-text-strong);
  --ref-selected: var(--app-color-bg-muted);
  width: min(820px, calc(100vw - 48px));
  aspect-ratio: 41 / 30;
  max-height: calc(100dvh - 48px);
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  margin-inline: auto;
}

.settings-reference {
  --ref-bg: var(--app-color-bg-surface);
  --ref-text: var(--app-color-text-strong);
  --ref-muted: var(--app-color-muted-design);
  --ref-line: var(--app-color-border);
  --ref-selected: var(--app-color-bg-muted);
  --ref-focus: var(--app-color-text-strong);
  --ref-scale: 0.72;
  /* The reference layout is rendered at 72%; these resolve to the app's
     24/28px control and 14/16px icon tiers after scaling. */
  --ref-control-compact: 33.333px;
  --ref-control-standard: 38.889px;
  --ref-icon-compact: 19.444px;
  --ref-icon-standard: 22.222px;
  --ref-font-compact: 16.667px;
  --ref-font-standard: 18.056px;
  --ref-padding-compact: 11.111px;
  --ref-padding-standard: 13.889px;
  display: flex;
  width: calc(100% / var(--ref-scale));
  height: calc(100% / var(--ref-scale));
  background: var(--ref-bg);
  color: var(--ref-text);
  border: 1px solid var(--app-color-border-strong);
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
  background: var(--app-color-bg-surface);
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
  background: var(--app-color-bg-muted);
  color: var(--app-color-text);
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
  /* 로고는 배경 없이 마크만. 색은 --app-color-brand-mark 한 곳에서 온다. */
  background: transparent;
  color: var(--app-color-brand-mark);
  font-family: Apple SD Gothic Neo, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
}

.settings-reference-close {
  align-items: center;
  appearance: none;
  position: absolute;
  top: 13px;
  right: 13px;
  z-index: 10;
  display: inline-flex;
  justify-content: center;
  width: var(--ref-control-compact);
  height: var(--ref-control-compact);
  min-width: var(--ref-control-compact);
  padding: 0;
  border: 0;
  border-radius: 17px;
  background: transparent;
  color: var(--ref-text);
}

.settings-reference-close:hover,
.settings-reference-close:active {
  background: var(--ref-selected);
}

.settings-reference-close svg {
  width: var(--ref-icon-compact);
  height: var(--ref-icon-compact);
  stroke-width: 2;
}

.settings-reference-expanded {
  padding: 23px 0 22px;
}

.settings-reference-save.mantine-Button-root,
.settings-reference-cancel.mantine-Button-root {
  height: var(--ref-control-compact);
  padding: 0 var(--ref-padding-compact);
  border-radius: 8px;
  font-size: var(--ref-font-compact);
  line-height: 1;
  font-weight: 600;
}

.settings-reference-save.mantine-Button-root {
  background: var(--ref-text);
  color: var(--app-color-bg-surface);
}

.settings-reference-cancel.mantine-Button-root {
  background: transparent;
  color: var(--ref-text);
}

.settings-reference-segmented .mantine-SegmentedControl-root {
  background: var(--ref-selected);
}

/* Mantine 기본 lg 라벨은 9px인데, 이 화면 전체가 --ref-scale(0.72)로 축소돼
   실효 7px가 된다. 다른 텍스트와 같은 기준으로 키워 둔다. */
.settings-reference-switch {
  --switch-label-font-size: 12px;
}

.settings-reference-shortcut-control {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 7px;
}

.settings-reference-shortcut-value {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 74px;
  min-height: var(--ref-control-standard);
  padding: 4px 11px;
  border: 0;
  border-radius: 14px;
  background: var(--ref-selected);
  color: var(--ref-text);
  cursor: pointer;
  transition: background 150ms ease-out, scale 150ms ease-out;
}

/* 바탕이 --ref-selected(회색)라 hover는 한 단계 눌린 회색이어야 한다.
   코랄로 올리면 단축키 칸이 브랜드 강조처럼 보인다. */
.settings-reference-shortcut-value:hover {
  background: var(--app-color-bg-pressed);
}

.settings-reference-shortcut-value:active {
  scale: 0.96;
}

.settings-reference-shortcut-value .mantine-Kbd-root {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: inherit;
  font-size: var(--ref-font-compact);
  font-weight: 500;
}

.settings-reference-shortcut-value[data-conflict] {
  background: color-mix(in srgb, var(--app-color-danger) 12%, var(--ref-selected));
  color: var(--app-color-danger);
}

.settings-reference-shortcut-edit.mantine-ActionIcon-root {
  width: var(--ref-control-compact);
  height: var(--ref-control-compact);
  min-width: var(--ref-control-compact);
  border-radius: 50%;
  color: var(--ref-muted);
}

.settings-reference-shortcut-edit.mantine-ActionIcon-root:hover {
  background: var(--ref-selected);
  color: var(--ref-text);
}

.settings-reference-shortcut-edit svg {
  width: var(--ref-icon-compact);
  height: var(--ref-icon-compact);
  stroke-width: 1.9;
}

.settings-reference-shortcut-record {
  display: flex;
  align-items: center;
  min-width: 270px;
  min-height: var(--ref-control-standard);
  padding: 4px 12px;
  border: 1px solid var(--app-color-brand-500);
  border-radius: 14px;
  background: var(--app-color-bg-surface);
  color: var(--ref-text);
  cursor: text;
  text-align: left;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-color-brand-500) 32%, transparent);
}

.settings-reference-shortcut-record[data-conflict] {
  border-color: var(--app-color-danger);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-color-danger) 32%, transparent);
}

.settings-reference-shortcut-record:focus-visible {
  outline: none;
}

.settings-reference-shortcut-recording-text {
  color: var(--ref-muted);
  font-size: var(--ref-font-standard);
  font-weight: 500;
}

.settings-reference-shortcut-cancel.mantine-Button-root {
  height: var(--ref-control-standard);
  padding: 0 8px;
  border-radius: 8px;
  color: var(--ref-muted);
  font-size: var(--ref-font-compact);
  font-weight: 600;
}

.settings-reference-shortcut-cancel.mantine-Button-root:hover {
  background: transparent;
  color: var(--ref-text);
}

.settings-reference-shortcut-conflict {
  color: var(--app-color-danger);
}

.settings-reference-feedback {
  margin-top: 28px;
}

`;

// The initial settings implementation was a visual reference rendered through
// a scale transform. The direct rules below own the actual desktop layout and
// control sizes, so the modal keeps one readable form at every window size.
const SETTINGS_CSS = `${REFERENCE_CSS}
.settings-reference-frame {
  width: min(860px, calc(100vw - 48px));
  height: min(660px, calc(100dvh - 48px));
  max-height: calc(100dvh - 48px);
  aspect-ratio: auto;
  overflow: hidden;
  border: 1px solid var(--app-color-border);
  border-radius: 13px;
  background: var(--app-color-bg-surface);
}

.settings-reference {
  --settings-control-height: 28px;
  --settings-icon-size: 16px;
  display: flex;
  width: 100%;
  height: 100%;
  transform: none;
  transform-origin: initial;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--app-color-bg-surface);
  color: var(--app-color-text-strong);
  font-family: Apple SD Gothic Neo, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
}

.settings-reference-sidebar {
  flex: 0 0 220px;
  width: 220px;
  padding: 24px 12px;
  border-right: 1px solid var(--app-color-border);
  background: var(--app-color-bg-muted);
}

.settings-reference-sidebar-title {
  margin: 0 12px 20px;
  color: var(--app-color-text-strong);
  font-size: 20px;
  line-height: 1.3;
  font-weight: 600;
}

.settings-reference-nav {
  gap: 2px;
}

.settings-reference-nav-button.mantine-Button-root {
  width: 100%;
  min-height: 32px;
  height: 32px;
  padding: 0 10px;
  border-radius: 7px;
  color: var(--app-color-text);
  font-size: 13px;
  font-weight: 500;
}

.settings-reference-nav-button .mantine-Button-section {
  margin-inline-end: 9px;
}

.settings-reference-nav-button svg {
  width: 16px;
  height: 16px;
  stroke-width: 1.8;
}

/* 코랄 틴트(--app-color-bg-active)를 쓰면 탐색 항목이 브랜드 강조처럼 읽힌다.
   여기는 "지금 보고 있는 곳"을 알리는 자리지 강조할 자리가 아니다.

   사이드바 바탕이 --app-color-bg-muted라, hover에 --app-color-bg-hover를 쓰면
   **같은 값이라 아무 변화가 없다**. 회색 바탕에서는 방향을 뒤집는다 —
   선택은 종이색으로 떠오르고, hover는 한 단계 눌린 회색이다. */
.settings-reference-nav-button[data-active] {
  background: var(--app-color-bg-surface);
  box-shadow: 0 1px 2px rgba(var(--legacy-ink-rgb), 0.06);
}

.settings-reference-nav-button:not([data-active]):hover,
.settings-reference-nav-button:not([data-active]):active {
  background: var(--app-color-bg-pressed);
}

.settings-reference-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 28px 36px;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--app-color-border) transparent;
}

.settings-reference-main::-webkit-scrollbar {
  display: block;
  width: 8px;
}

.settings-reference-main::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 8px;
  background: var(--app-color-border);
  background-clip: padding-box;
}

.settings-reference-page-title {
  margin: 0 0 28px;
  color: var(--app-color-text-strong);
  font-size: 20px;
  line-height: 1.3;
  font-weight: 600;
}

.settings-reference-sections {
  gap: 26px;
}

/* 묶음 이름은 카드 밖 위에. 카드 안 행 제목(13px)보다 작고 흐려야
   "이건 항목이 아니라 이름"으로 읽힌다. */
.settings-reference-section-title {
  margin: 0 0 7px;
  padding-left: 2px;
  color: var(--app-color-muted-design);
  font-size: 12px;
  line-height: 1.4;
  font-weight: 600;
}

.settings-reference-section-description {
  margin: -3px 0 8px;
  padding-left: 2px;
  color: var(--app-color-muted);
  font-size: 12px;
  line-height: 1.45;
}

/* design.md: "Avoid making every surface a large rounded card." 그래서
   radius를 16~18px이 아닌 10px로 두고 hairline 테두리만 쓴다 — 미리보기
   패널 행·링크 카드와 같은 급이다. */
.settings-reference-card {
  border: 1px solid var(--app-color-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--app-color-bg-surface);
}

/* 자식 사이에만 선을 넣는다. 행이 직접 구분선을 그리면 마지막 행 아래에도
   선이 남아 카드 모서리와 겹친다. */
.settings-reference-card > * + * {
  border-top: 1px solid var(--app-color-border-soft);
}

/* 묶음 하나에 속하지 않는 페이지 단위 동작(단축키 저장 등). 카드 밖에 둔다. */
.settings-reference-actions {
  gap: 8px;
  margin-top: -8px;
}

.settings-reference-row {
  min-height: 0;
  padding: 13px 14px;
  gap: 20px;
}

.settings-reference-row > .mantine-Box-root {
  min-width: 0;
}

.settings-reference-row-label {
  color: var(--app-color-text);
  font-size: 13px;
  line-height: 1.45;
  font-weight: 500;
}

.settings-reference-row-value {
  margin-top: 2px;
  color: var(--app-color-muted);
  font-size: 12px;
  line-height: 1.45;
  font-weight: 400;
}

/* 맨 글자로 두면 "위치 변경 폴더 열기"처럼 두 동작이 한 문장으로 붙어 읽힌다.
   아주 작은 pill로 감싸 각각이 누를 수 있는 것임을 알린다. 카드 안이라
   테두리는 hairline, 높이는 컴팩트 단(24px)에 맞춘다. */
.settings-reference-link {
  align-items: center;
  background: var(--app-color-bg-surface);
  border: 1px solid var(--app-color-border);
  border-radius: 999px;
  color: var(--app-color-text-soft);
  display: inline-flex;
  font-size: 12px;
  font-weight: 500;
  height: 24px;
  justify-content: center;
  line-height: 1;
  min-height: 24px;
  padding: 0 10px;
  text-decoration: none;
  transition: background-color 120ms ease, color 120ms ease, scale 120ms ease;
}

.settings-reference-link:hover {
  background: var(--app-color-bg-hover);
  color: var(--app-color-text-strong);
  text-decoration: none;
}

.settings-reference-link:active {
  scale: 0.96;
}

/* 여러 개가 나란히 설 때(위치 변경 · 폴더 열기) 간격을 좁힌다. */
.settings-reference-row .mantine-Group-root .settings-reference-link + .settings-reference-link {
  margin-left: 0;
}

.settings-reference-link[aria-disabled='true'] {
  background: transparent;
  border-color: var(--app-color-border-soft);
  color: var(--app-color-muted);
}

.settings-reference-badge.mantine-Badge-root {
  min-height: 22px;
  padding: 0 8px;
  border-radius: 8px;
  background: var(--app-color-bg-muted);
  color: var(--app-color-text);
  font-size: 11px;
  font-weight: 500;
}

.settings-reference-provider-value {
  gap: 6px;
}

.settings-reference-provider-icon {
  width: 16px;
  height: 16px;
  flex-basis: 16px;
}

.settings-reference-subnota-logo {
  border-radius: 4px;
  font-size: 10px;
  line-height: 16px;
}

.settings-reference-close {
  appearance: none;
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--settings-control-height, 28px);
  min-width: var(--settings-control-height, 28px);
  height: var(--settings-control-height, 28px);
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--app-color-text);
  cursor: pointer;
  font-size: 22px;
  font-weight: 300;
  line-height: 1;
}

.settings-reference-close svg {
  width: var(--settings-icon-size, 16px);
  height: var(--settings-icon-size, 16px);
}

.settings-reference-close:focus-visible {
  outline: 2px solid var(--app-color-focus-ring);
  outline-offset: 2px;
}

.settings-reference-expanded {
  padding: 13px 14px;
}

.settings-reference-save.mantine-Button-root,
.settings-reference-cancel.mantine-Button-root {
  height: var(--settings-control-height);
  min-height: var(--settings-control-height);
  padding: 0 10px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
}

.settings-reference-save.mantine-Button-root {
  background: var(--app-color-brand-500);
  color: var(--app-color-bg-surface);
}

.settings-reference-save.mantine-Button-root:hover {
  background: var(--app-color-brand-600);
}

.settings-reference-cancel.mantine-Button-root {
  color: var(--app-color-text);
}

/* radius는 테마(mantineTheme.ts)의 defaultProps가 정한다 — 여기서 다시 쓰면
   네 곳 중 설정만 각진 채로 남는다. */
.settings-reference-segmented .mantine-SegmentedControl-root {
  min-height: var(--settings-control-height);
  padding: 2px;
  background: var(--app-color-bg-muted);
}

.settings-reference-segmented .mantine-SegmentedControl-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  color: var(--app-color-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  text-align: center;
}

.settings-reference-switch {
  --switch-label-font-size: 10px;
}

.settings-reference-shortcut-control {
  flex: 0 0 auto;
  gap: 6px;
}

/* 짧은 라벨 하나를 담는 컨트롤이라 알약이다 — 키 캡처럼 읽혀야 한다.
   좌우 여백을 늘려 둥근 끝이 글자를 물지 않게 한다. */
.settings-reference-shortcut-value {
  display: inline-flex;
  align-items: center;
  min-width: 54px;
  min-height: var(--settings-control-height);
  padding: 3px 11px;
  border-radius: 999px;
  background: var(--app-color-bg-muted);
  color: var(--app-color-text);
  cursor: default;
}

.settings-reference-shortcut-value .mantine-Kbd-root {
  color: inherit;
  font-size: 12px;
  font-weight: 400;
}

.settings-reference-shortcut-value[data-conflict] {
  background: color-mix(in srgb, var(--app-color-danger) 10%, var(--app-color-bg-muted));
  color: var(--app-color-danger);
}

.settings-reference-shortcut-edit.mantine-ActionIcon-root,
.settings-reference-shortcut-reset.mantine-ActionIcon-root {
  width: var(--settings-control-height);
  min-width: var(--settings-control-height);
  height: var(--settings-control-height);
  border-radius: 7px;
  color: var(--app-color-muted);
}

.settings-reference-shortcut-edit.mantine-ActionIcon-root:hover,
.settings-reference-shortcut-reset.mantine-ActionIcon-root:hover {
  background: var(--app-color-bg-muted);
  color: var(--app-color-text);
}

.settings-reference-shortcut-edit svg,
.settings-reference-shortcut-reset svg {
  width: var(--settings-icon-size);
  height: var(--settings-icon-size);
  stroke-width: 1.8;
}

.settings-reference-shortcut-record {
  min-width: 184px;
  min-height: 32px;
  padding: 4px 10px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-color-brand-500) 28%, transparent);
}

.settings-reference-shortcut-recording-text {
  font-size: 13px;
  font-weight: 400;
}

.settings-reference-shortcut-cancel.mantine-Button-root {
  min-height: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
}

.settings-reference-shortcut-conflict {
  color: var(--app-color-danger);
}

.settings-reference-feedback {
  margin-top: 20px;
  font-size: 12px;
  line-height: 1.45;
}

/* 카드 안에 들어가므로 자체 테두리·모서리를 두지 않는다 — 카드 속 카드가
   된다. 되돌릴 수 없는 작업이라 배경으로만 구분한다. */
.settings-reference-confirmation {
  margin: 0;
  padding: 13px 14px;
  border: 0;
  border-radius: 0;
  background: var(--app-color-bg-muted);
}

@media (max-width: 640px) {
  .settings-reference-frame {
    width: calc(100vw - 24px);
    height: calc(100dvh - 24px);
    max-height: calc(100dvh - 24px);
  }

  .settings-reference-sidebar {
    flex-basis: 176px;
    width: 176px;
    padding: 18px 8px;
  }

  .settings-reference-sidebar-title {
    margin: 0 8px 16px;
    font-size: 18px;
  }

  .settings-reference-nav-button.mantine-Button-root {
    padding: 0 8px;
    font-size: 12px;
  }

  .settings-reference-main {
    padding: 20px;
  }

  .settings-reference-row {
    gap: 12px;
  }

  .settings-reference-shortcut-record {
    min-width: 152px;
  }
}
`;

const SECTIONS: Array<{
  enLabel: string;
  icon: IconComponent;
  id: string;
  label: string;
}> = [
  { enLabel: 'General', icon: Cog6ToothIcon, id: 'general', label: '일반' },
  { enLabel: 'Appearance & editor', icon: SwatchIcon, id: 'appearance', label: '화면 및 편집기' },
  { enLabel: 'Sync & storage', icon: ArrowPathIcon, id: 'sync', label: '동기화 및 저장소' },
  { enLabel: 'Backup & data', icon: CircleStackIcon, id: 'backup', label: '백업 및 데이터' },
  { enLabel: 'Shortcuts', icon: CommandLineIcon, id: 'hotkeys', label: '단축키' },
  { enLabel: 'Account', icon: UserCircleIcon, id: 'account', label: '계정' },
  { enLabel: 'About', icon: InformationCircleIcon, id: 'about', label: '정보' },
];

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

const THIRD_PARTY_MODEL_URLS = {
  backendLicense: 'https://www.apache.org/licenses/LICENSE-2.0',
  backendModel:
    'https://huggingface.co/BAAI/bge-m3/tree/5617a9f61b028005a4858fdac845db406aefb181',
  desktopLicense: 'https://opensource.org/license/mit/',
  desktopModel:
    'https://huggingface.co/Xenova/bge-m3/tree/4de13258303883538bd53b696b452bf8099f0858',
} as const;

const embeddingModelText = (
  status: LocalEmbeddingStatusBridge | null,
  language: AppSettings['uiLanguage'],
) => {
  if (!status) return localize(language, '상태를 확인하는 중...', 'Checking status…');
  if (status.state === 'ready') {
    return `${localize(language, '준비됨', 'Ready')} · ${formatBytes(status.downloadedBytes)}`;
  }
  if (status.state === 'downloading') {
    return `${localize(language, '받는 중', 'Downloading')} · ${formatBytes(status.downloadedBytes)} / ${formatBytes(status.totalBytes)}`;
  }
  if (status.state === 'loading') return localize(language, '모델을 여는 중...', 'Loading model…');
  if (status.state === 'failed') return status.error ?? localize(language, '받지 못했습니다.', 'Download failed.');
  return `${localize(language, '받지 않음', 'Not downloaded')} · ${localize(language, '약', 'about')} ${formatBytes(status.totalBytes)}`;
};

// 문구는 그대로 두고 앞에 작은 점 하나만 붙인다. 설정 화면에 큰 스피너나
// 별도 모달을 세우지 않는다 — 행 높이도 그대로여야 한다.
const embeddingModelDescription = (
  status: LocalEmbeddingStatusBridge | null,
  language: AppSettings['uiLanguage'],
) => {
  const isBusy =
    !status || status.state === 'loading' || status.state === 'downloading';
  const text = embeddingModelText(status, language);
  return isBusy ? (
    <>
      <span aria-hidden="true" className="inline-busy" />
      {text}
    </>
  ) : (
    text
  );
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

function RowAction({
  children,
  className,
  color,
  disabled,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Anchor
      aria-disabled={disabled ? 'true' : undefined}
      c={color}
      className={
        className
          ? `settings-reference-link ${className}`
          : 'settings-reference-link'
      }
      component="button"
      onClick={disabled ? undefined : onClick}
      type="button"
    >
      {children}
    </Anchor>
  );
}

function Hotkey({
  language,
  value,
}: {
  language: AppSettings['uiLanguage'];
  value: string;
}) {
  if (!value.trim()) {
    return (
      <Badge className="settings-reference-badge" variant="filled">
        {localize(language, '미설정', 'Not set')}
      </Badge>
    );
  }

  return (
    <Group gap={4} wrap="nowrap">
      {value.split('+').map((key, index) => (
        <Kbd key={`${key}-${index}`}>{formatHotkeyKey(key)}</Kbd>
      ))}
    </Group>
  );
}

function ShortcutRecorder({
  canReset,
  conflict,
  field,
  language,
  label,
  onCancel,
  onKeyDown,
  onReset,
  onStart,
  recording,
  value,
}: {
  canReset: boolean;
  conflict?: string;
  field: EditableShortcutField;
  language: AppSettings['uiLanguage'];
  label: string;
  onCancel: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onReset: () => void;
  onStart: () => void;
  recording: boolean;
  value: string;
}) {
  if (recording) {
    return (
      <Group className="settings-reference-shortcut-control" gap={7} wrap="nowrap">
        <button
          aria-label={localize(language, `${label} 단축키 입력`, `Set ${label} shortcut`)}
          autoFocus
          className="settings-reference-shortcut-record"
          data-conflict={conflict ? '' : undefined}
          key={`record-${field}`}
          onBlur={onCancel}
          onKeyDown={onKeyDown}
          type="button"
        >
          <span className="settings-reference-shortcut-recording-text">
            {localize(language, '단축키를 누르세요', 'Press a shortcut')}
          </span>
        </button>
        <Button
          className="settings-reference-shortcut-cancel"
          onClick={onCancel}
          variant="transparent"
        >
          {localize(language, '취소', 'Cancel')}
        </Button>
      </Group>
    );
  }

  return (
    <Group className="settings-reference-shortcut-control" gap={7} wrap="nowrap">
      <span
        aria-label={localize(language, `${label} 단축키`, `${label} shortcut`)}
        className="settings-reference-shortcut-value"
        data-conflict={conflict ? '' : undefined}
      >
        <Hotkey language={language} value={value} />
      </span>
      <Tooltip label={localize(language, '단축키 변경', 'Change shortcut')} withArrow>
        <ActionIcon
          aria-label={localize(language, `${label} 단축키 변경`, `Change ${label} shortcut`)}
          className="settings-reference-shortcut-edit"
          onClick={onStart}
          variant="subtle"
        >
          <PencilIcon />
        </ActionIcon>
      </Tooltip>
      {canReset && (
        <Tooltip label={localize(language, '저장된 단축키로 되돌리기', 'Restore saved shortcut')} withArrow>
          <ActionIcon
            aria-label={localize(
              language,
              `${label} 단축키를 저장된 값으로 되돌리기`,
              `Restore ${label} shortcut`,
            )}
            className="settings-reference-shortcut-reset"
            onClick={onReset}
            variant="subtle"
          >
            <ArrowUturnLeftIcon />
          </ActionIcon>
        </Tooltip>
      )}
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
      <SubnotaMark size={16} />
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
  // 구분선을 행이 직접 그리지 않는다. 묶음 카드가 자식 사이에만 선을 넣어
  // 마지막 행 아래 선이 남지 않게 한다(.settings-reference-card > * + *).
  return (
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
  );
}

/**
 * 한 탭 안의 설정 묶음. 이름은 카드 밖 위에 작게 두고, 관련 행만 카드에 담는다.
 * 전폭 구분선으로만 나뉘어 있으면 탭 전체가 하나의 긴 목록으로 읽혀 어디서
 * 주제가 바뀌는지 알 수 없다.
 */
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
    <section className="settings-reference-group">
      <Title className="settings-reference-section-title" order={3}>
        {title}
      </Title>
      {description && (
        <Text className="settings-reference-section-description">
          {description}
        </Text>
      )}
      <div className="settings-reference-card">{children}</div>
    </section>
  );
}

function ExpandableRow({
  children,
  expanded,
  language,
  label,
  onClose,
  onOpen,
  value,
}: {
  children: ReactNode;
  expanded: boolean;
  language: AppSettings['uiLanguage'];
  label: string;
  onClose: () => void;
  onOpen: () => void;
  value: string;
}) {
  if (!expanded) {
    return (
      <Row
        action={<RowAction onClick={onOpen}>{localize(language, '편집', 'Edit')}</RowAction>}
        description={value}
        label={label}
      />
    );
  }

  return (
    <Stack
      className="settings-reference-expanded"
      gap={16}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <Text className="settings-reference-row-label">{label}</Text>
      {children}
      <Group gap={8}>
        <Button className="settings-reference-save" onClick={onClose}>
          {localize(language, '완료', 'Done')}
        </Button>
      </Group>
    </Stack>
  );
}

function Nav({
  active,
  language,
  onSelect,
}: {
  active: string;
  language: AppSettings['uiLanguage'];
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="settings-reference-sidebar">
      <h2 className="settings-reference-sidebar-title">
        {localize(language, '설정', 'Settings')}
      </h2>
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
              variant="transparent"
            >
              {localize(language, section.label, section.enLabel)}
            </Button>
          );
        })}
      </nav>
    </aside>
  );
}

export default function SettingsModal(props: SettingsModalProps) {
  const t = (korean: string, english: string) =>
    localize(props.appSettings.uiLanguage, korean, english);
  const deleteWord = props.appSettings.uiLanguage === 'en' ? 'DELETE' : '삭제';
  const platformFeatures = window.electronAPI?.getPlatformFeatures?.();
  const editableShortcuts = platformFeatures?.captureShortcut === false
    ? EDITABLE_SHORTCUTS.filter(item => item.field !== 'capturePage')
    : EDITABLE_SHORTCUTS;
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [active, setActive] = useState(SECTIONS[0].id);
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

  const expandable = (row: string) => ({
    expanded: expandedRow === row,
    language: props.appSettings.uiLanguage,
    onClose: () => {
      setExpandedRow(null);
    },
    onOpen: () => {
      setExpandedRow(row);
    },
  });

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
    <Nav
      active={active}
      language={props.appSettings.uiLanguage}
      onSelect={selectNav}
    />
  );

  const content = (
    <main className="settings-reference-main" ref={viewportRef}>
      <Title className="settings-reference-page-title" order={2}>
        {(() => {
          const section = SECTIONS.find(item => item.id === active);
          return section
            ? localize(props.appSettings.uiLanguage, section.label, section.enLabel)
            : t('설정', 'Settings');
        })()}
      </Title>

      {active === 'general' && (
        <div className="settings-reference-sections">
          <Section title={t('언어', 'Language')}>
            <Row
              action={
                <SegmentedControl
                  className="settings-reference-segmented"
                  data={[
                    { label: '한국어', value: 'ko' },
                    { label: 'English', value: 'en' },
                  ]}
                  onChange={value =>
                    updateAppSettings({ uiLanguage: value as AppSettings['uiLanguage'] })
                  }
                  value={props.appSettings.uiLanguage}
                />
              }
              description={t(
                '화면 언어를 바꿉니다. 날짜 표시는 기기 지역 설정을 따릅니다.',
                'Changes the display language. Date formats follow your device region.',
              )}
              label={t('화면 언어', 'Display language')}
            />
          </Section>
          <Section title={t('시작 및 창', 'Startup & window')}>
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
                  offLabel="OFF"
                  onLabel="ON"
                  size="sm"
                  withThumbIndicator={false}
                />
              }
              description={t('로그인할 때 Subnota를 자동으로 엽니다.', 'Opens Subnota when you sign in to this computer.')}
              label={t('로그인 시 자동 실행', 'Launch at login')}
            />
            <ExpandableRow
              label={t('창 닫기 동작', 'When closing the window')}
              value={
                props.desktopPreferences.closeBehavior === 'tray'
                  ? t('트레이로 최소화', 'Minimize to tray')
                  : t('앱 종료', 'Quit app')
              }
              {...expandable('closeBehavior')}
            >
              <SegmentedControl
                className="settings-reference-segmented"
                data={[
                  { label: t('앱 종료', 'Quit app'), value: 'quit' },
                  { label: t('트레이로 최소화', 'Minimize to tray'), value: 'tray' },
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
                  offLabel="OFF"
                  onLabel="ON"
                  size="sm"
                  withThumbIndicator={false}
                />
              }
              description={t('앱을 열 때 마지막 작업 공간으로 돌아갑니다.', 'Returns to your last workspace when you open the app.')}
              label={t('마지막 작업 공간 복원', 'Restore last workspace')}
            />
          </Section>
          {/* 알림·업데이트·연관 문장 검색은 시작과도 창과도 관계가 없다.
              한 묶음에 있으면 제목이 내용의 절반만 설명하게 된다. */}
          <Section title={t('알림 및 업데이트', 'Notifications & updates')}>
            <Row
              action={
                <Switch
                  checked={props.appSettings.clipNotifications}
                  className="settings-reference-switch"
                  onChange={event =>
                    updateAppSettings({
                      clipNotifications: event.currentTarget.checked,
                    })
                  }
                  offLabel="OFF"
                  onLabel="ON"
                  size="sm"
                  withThumbIndicator={false}
                />
              }
              description={t('꺼도 메뉴바 표시는 그대로 남습니다.', 'The menu bar indicator remains visible when this is off.')}
              label={t('링크를 저장하면 알림', 'Notify when a link is saved')}
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
                  offLabel="OFF"
                  onLabel="ON"
                  size="sm"
                  withThumbIndicator={false}
                />
              }
              description={t('새 버전이 있으면 알려줍니다.', 'Lets you know when a new version is available.')}
              label={t('업데이트 자동 확인', 'Check for updates automatically')}
            />
          </Section>
          <Section title={t('메모 작성', 'Writing')}>
            <Row
              action={
                <Switch
                  checked={props.appSettings.ambientAutoSearchEnabled}
                  className="settings-reference-switch"
                  onChange={event =>
                    updateAppSettings({
                      ambientAutoSearchEnabled: event.currentTarget.checked,
                    })
                  }
                  offLabel="OFF"
                  onLabel="ON"
                  size="sm"
                  withThumbIndicator={false}
                />
              }
              description={t('입력을 멈추면 자동으로 연관 문장을 검색합니다. 꺼져 있으면 편집기 하단 버튼으로 직접 검색합니다.', 'Searches related passages after you pause typing. When off, use the button at the bottom of the editor.')}
              label={t('연관 문장 자동 검색', 'Automatic related-passage search')}
            />
          </Section>
        </div>
      )}

      {active === 'appearance' && (
        <div className="settings-reference-sections">
          {DARK_MODE_ENABLED && (
            <Section title={t('테마', 'Theme')}>
              <Row
                action={<RowAction onClick={toggleTheme}>{t('전환', 'Switch')}</RowAction>}
                description={t('Subnota 전체 테마 설정과 동일하게 저장됩니다.', 'Uses the same setting across Subnota.')}
                label={isDark ? t('다크 모드', 'Dark mode') : t('라이트 모드', 'Light mode')}
              />
            </Section>
          )}
          <Section title={t('편집기 타이포그래피', 'Editor typography')}>
            <ExpandableRow
              label={t('글자 크기', 'Font size')}
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
              label={t('줄 간격', 'Line height')}
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
          <Section title={t('동기화 상태', 'Sync status')}>
            <Row
              action={
                <RowAction
                  className="settings-sync-action"
                  disabled={!props.isSignedIn || !props.isOnline || props.isSyncing}
                  onClick={props.onSync}
                >
                  {props.isSyncing ? (
                    <>
                      <span aria-hidden="true" className="inline-busy" />
                      {t('동기화 중...', 'Syncing…')}
                    </>
                  ) : (
                    t('지금 동기화', 'Sync now')
                  )}
                </RowAction>
              }
              description={
                props.lastSyncAt
                  ? `${t('마지막 동기화', 'Last synced')} ${new Date(props.lastSyncAt).toLocaleString(getUiDateLocale(props.appSettings.uiLanguage))}`
                  : t('동기화 기록 없음', 'No sync history')
              }
              label={props.isOnline ? t('온라인', 'Online') : t('오프라인', 'Offline')}
            />
            <Row
              description={t(
                `대기 ${props.pendingSyncCount} · 실패 ${props.failedSyncCount}`,
                `${props.pendingSyncCount} pending · ${props.failedSyncCount} failed`,
              )}
              label={t('동기화 큐', 'Sync queue')}
            />
          </Section>
          <Section
            description={t('위치를 변경하면 데이터베이스를 새 폴더로 복사한 뒤 앱을 다시 불러옵니다.', 'Copies the database to a new folder, then reloads the app.')}
            title={t('로컬 저장소', 'Local storage')}
          >
            <Row
              action={
                <Group gap={18} wrap="nowrap">
                  <RowAction
                    onClick={() =>
                      void run(
                        props.onChooseStorage,
                        info => (info ? t('저장소 위치를 변경했습니다.', 'Storage location changed.') : null),
                      )
                    }
                  >
                    {t('위치 변경', 'Change location')}
                  </RowAction>
                  <RowAction
                    onClick={() =>
                      void run(props.onOpenStorage, t('저장소 폴더를 열었습니다.', 'Opened the storage folder.'))
                    }
                  >
                    {t('폴더 열기', 'Open folder')}
                  </RowAction>
                </Group>
              }
              description={`${props.storageInfo?.databasePath ?? t('불러오는 중...', 'Loading…')} · ${formatBytes(props.storageInfo?.size ?? 0)} ${t('사용', 'used')}`}
              label={t('SQLite 데이터베이스', 'SQLite database')}
            />
          </Section>
          <Section
            description={t('연관 문장 검색에 쓰는 파일입니다. 지우면 다음 검색 때 다시 받습니다.', 'This file powers related-passage search. It downloads again on your next search if removed.')}
            title={t('검색 모델', 'Search model')}
          >
            <Row
              action={
                embeddingStatus?.state === 'ready' ? (
                  <RowAction
                    disabled={isWorking}
                    onClick={() =>
                      void run(async () => {
                        const next = await window.electronAPI?.localEmbedDeleteModel?.();
                        setEmbeddingStatus(next ?? null);
                        if (!next || next.state !== 'absent') {
                          throw new Error(next?.error ?? t('검색 모델을 삭제하지 못했습니다.', 'Could not delete the search model.'));
                        }
                        return next;
                      }, t('검색 모델을 삭제했습니다.', 'Search model deleted.'))
                    }
                  >
                    {t('삭제', 'Delete')}
                  </RowAction>
                ) : embeddingStatus?.state === 'absent' ||
                  embeddingStatus?.state === 'failed' ? (
                  <RowAction
                    disabled={isWorking}
                    onClick={() =>
                      void run(async () => {
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
                          throw new Error(next?.error ?? t('검색 모델을 받지 못했습니다.', 'Could not download the search model.'));
                        }
                        return next;
                      }, t('검색 모델을 받았습니다.', 'Search model downloaded.'))
                    }
                  >
                    {t('다운로드', 'Download')}
                  </RowAction>
                ) : null
              }
              description={embeddingModelDescription(
                embeddingStatus,
                props.appSettings.uiLanguage,
              )}
              label={t('로컬 임베딩 모델', 'Local embedding model')}
            />
          </Section>
        </div>
      )}

      {active === 'backup' && (
        <div className="settings-reference-sections">
          <Section title={t('전체 백업', 'Full backup')}>
            <Row
              action={
                <RowAction
                  disabled={isWorking}
                  onClick={() =>
                    void run(
                      props.onBackup,
                      path => (path ? t('백업을 생성했습니다.', 'Backup created.') : null),
                    )
                  }
                >
                  {t('백업 생성', 'Create backup')}
                </RowAction>
              }
                  description={t('메모, 캘린더, Inbox가 포함된 SQLite 백업을 만듭니다.', 'Creates a SQLite backup with memos, calendar items, and Inbox data.')}
                  label={t('전체 데이터 백업', 'Back up all data')}
            />
            <FileButton
              accept=".sqlite3"
              onChange={setRestoreFile}
            >
              {({ onClick }) => (
                <Row
                  action={
                    <RowAction disabled={isWorking} onClick={onClick}>
                      {t('파일 선택', 'Choose file')}
                    </RowAction>
                  }
                  description={t('백업 파일로 현재 데이터를 교체합니다.', 'Replaces current data with a backup file.')}
                  label={t('백업 파일 복원', 'Restore backup file')}
                />
              )}
            </FileButton>
            {restoreFile && (
              <Box className="settings-reference-confirmation" role="alert">
                <Text className="settings-reference-row-label">
                  {t(
                    `'${restoreFile.name}' 파일로 현재 데이터를 교체할까요?`,
                    `Replace current data with '${restoreFile.name}'?`,
                  )}
                </Text>
                <Text className="settings-reference-row-value">
                  {t(
                    '현재 로컬 메모, 캘린더, 링크 저장함이 백업 내용으로 바뀝니다.',
                    'Your local memos, calendar, and Inbox will be replaced by this backup.',
                  )}
                </Text>
                <Group gap={8} mt={10}>
                  <Button
                    className="settings-reference-save"
                    disabled={isWorking}
                    onClick={() =>
                      void run(async () => {
                        await props.onRestore(restoreFile);
                        setRestoreFile(null);
                      }, t('백업을 복원했습니다.', 'Backup restored.'))
                    }
                  >
                    {t('복원 진행', 'Restore')}
                  </Button>
                  <Button
                    className="settings-reference-cancel"
                    disabled={isWorking}
                    onClick={() => setRestoreFile(null)}
                    variant="transparent"
                  >
                    {t('취소', 'Cancel')}
                  </Button>
                </Group>
              </Box>
            )}
          </Section>
          <Section title={t('JSON 내보내기', 'Export JSON')}>
            <Row
              action={
                <RowAction
                  disabled={isWorking}
                  onClick={() =>
                    void run(
                      () => props.onExportJson('subnota-calendar', props.scheduleData),
                      path => (path ? t('캘린더 데이터를 내보냈습니다.', 'Calendar data exported.') : null),
                    )
                  }
                >
                  {t('내보내기', 'Export')}
                </RowAction>
              }
              description={t('모든 캘린더 항목을 JSON 파일로 저장합니다.', 'Saves all calendar items to a JSON file.')}
              label={t('캘린더 내보내기', 'Export calendar')}
            />
            <Row
              action={
                <RowAction
                  disabled={isWorking}
                  onClick={() =>
                    void run(
                      () => props.onExportJson('subnota-inbox', props.inboxData),
                      path => (path ? t('링크 저장함 데이터를 내보냈습니다.', 'Inbox data exported.') : null),
                    )
                  }
                >
                  {t('내보내기', 'Export')}
                </RowAction>
              }
              description={t('링크 저장함 항목을 JSON 파일로 저장합니다.', 'Saves Inbox items to a JSON file.')}
              label={t('링크 저장함 내보내기', 'Export Inbox')}
            />
          </Section>
        </div>
      )}

      {active === 'hotkeys' && (
        <div className="settings-reference-sections">
          {APP_SHORTCUT_SECTIONS.map(section => (
            <Section
              description={
                section.description
                  ? localize(
                      props.appSettings.uiLanguage,
                      section.description,
                      section.enDescription ?? section.description,
                    )
                  : undefined
              }
              key={section.title}
              title={localize(props.appSettings.uiLanguage, section.title, section.enTitle)}
            >
              {EDITABLE_APP_SHORTCUTS.filter(item =>
                section.fields.includes(item.field),
              ).map(item => (
                <Row
                  action={
                    <ShortcutRecorder
                      canReset={appShortcutDraft[item.field] !== props.appShortcuts[item.field]}
                      conflict={shortcutConflicts[item.field]}
                      field={item.field}
                      label={localize(props.appSettings.uiLanguage, item.label, item.enLabel)}
                      language={props.appSettings.uiLanguage}
                      onCancel={() =>
                        setRecording(current =>
                          current === item.field ? null : current,
                        )
                      }
                      onKeyDown={captureShortcut(item.field)}
                      onReset={() => restoreShortcut(item.field)}
                      onStart={() => {
                        setFeedback(null);
                        setRecording(item.field);
                      }}
                      recording={recording === item.field}
                      value={appShortcutDraft[item.field]}
                    />
                  }
                  description={
                    shortcutConflicts[item.field] ? (
                      <Text
                        className="settings-reference-shortcut-conflict"
                        component="span"
                        size="sm"
                      >
                        {t(
                          `'${shortcutConflicts[item.field]}'와 충돌합니다.`,
                          `Conflicts with '${shortcutConflicts[item.field]}'.`,
                        )}
                      </Text>
                    ) : (
                      localize(props.appSettings.uiLanguage, item.description, item.enDescription)
                    )
                  }
                  key={item.field}
                  label={localize(props.appSettings.uiLanguage, item.label, item.enLabel)}
                />
              ))}
            </Section>
          ))}
          <Section title={t('빠른 실행', 'Quick actions')}>
            {editableShortcuts.map(item => (
              <Row
                action={
                  <ShortcutRecorder
                    canReset={shortcutDraft[item.field] !== props.shortcuts[item.field]}
                    conflict={shortcutConflicts[item.field]}
                    field={item.field}
                    label={localize(props.appSettings.uiLanguage, item.label, item.enLabel)}
                    language={props.appSettings.uiLanguage}
                    onCancel={() =>
                      setRecording(current =>
                        current === item.field ? null : current,
                      )
                    }
                    onKeyDown={captureShortcut(item.field)}
                    onReset={() => restoreShortcut(item.field)}
                    onStart={() => {
                      setFeedback(null);
                      setRecording(item.field);
                    }}
                    recording={recording === item.field}
                    value={shortcutDraft[item.field]}
                  />
                }
                description={
                  shortcutConflicts[item.field] ? (
                    <Text
                      className="settings-reference-shortcut-conflict"
                      component="span"
                      size="sm"
                    >
                      {t(
                        `'${shortcutConflicts[item.field]}'와 충돌합니다.`,
                        `Conflicts with '${shortcutConflicts[item.field]}'.`,
                      )}
                    </Text>
                  ) : (
                    localize(props.appSettings.uiLanguage, item.description, item.enDescription)
                  )
                }
                key={item.field}
                label={localize(props.appSettings.uiLanguage, item.label, item.enLabel)}
              />
            ))}
          </Section>
          {/* 이 버튼들은 앱 단축키와 전역 단축키를 모두 저장한다. "빠른 실행"
              묶음 안에 두면 그 묶음만 저장하는 것처럼 읽힌다. */}
          <Group className="settings-reference-actions" justify="flex-end">
              <Button
                className="settings-reference-cancel"
                onClick={() =>
                  void run(async () => {
                    await props.onResetAppShortcuts();
                    await props.onResetShortcuts();
                    setAppShortcutDraft(DEFAULT_APP_SHORTCUT_SETTINGS);
                    setShortcutDraft(DEFAULT_SHORTCUT_SETTINGS);
                  }, t('기본 단축키로 복원했습니다.', 'Default shortcuts restored.'))
                }
                variant="transparent"
              >
                {t('기본값 복원', 'Restore defaults')}
              </Button>
              <Button
                className="settings-reference-save"
                  disabled={hasShortcutConflict || isWorking}
                  onClick={() =>
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
              >
                {t('단축키 저장', 'Save shortcuts')}
              </Button>
          </Group>
        </div>
      )}

      {active === 'account' && (
        <div className="settings-reference-sections">
          <Section title={t('로그인', 'Sign in')}>
            <Row description={props.email ?? t('로그인되지 않음', 'Not signed in')} label={t('이메일', 'Email')} />
            <Row
              description={
                <ProviderValue
                  label={t(
                    `${providerLabelFor(props.provider, props.appSettings.uiLanguage)} 로그인`,
                    `Signed in with ${providerLabelFor(
                      props.provider,
                      props.appSettings.uiLanguage,
                    )}`,
                  )}
                  provider={props.provider}
                />
              }
              label={t('로그인 방식', 'Sign-in method')}
            />
            <Row
              action={
                <RowAction
                  disabled={
                    !props.isSignedIn || !props.email || !isPasswordAccount
                  }
                  // 되돌릴 수 없고 이 기기에서 로그아웃까지 된다. 무슨 일이
                  // 일어나는지 먼저 말하고 확인을 받는다.
                  onClick={() => {
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
                >
                  {t('재설정', 'Reset')}
                </RowAction>
              }
              description={
                isPasswordAccount
                  ? t('코드를 메일로 보내고 로그아웃합니다. 로그인 화면에서 새 비밀번호를 정합니다.', 'Emails a code and signs out this device. Choose a new password on the sign-in screen.')
                  : t(
                    `${providerLabel} 계정은 ${providerLabel}에서 비밀번호를 관리합니다.`,
                    `Your ${providerLabel} account manages its password with ${providerLabel}.`,
                  )
              }
              label={t('비밀번호', 'Password')}
            />
          </Section>
          <Section title={t('세션', 'Session')}>
            <Row
              action={
                <RowAction
                  color="red"
                  disabled={!props.isSignedIn}
                  onClick={props.onSignOut}
                >
                  {t('로그아웃', 'Sign out')}
                </RowAction>
              }
              description={t('이 기기의 로컬 데이터는 그대로 유지됩니다.', 'Local data on this device stays here.')}
              label={t('이 기기에서 로그아웃', 'Sign out on this device')}
            />
            <Row
              action={
                <RowAction
                  color="red"
                  disabled={!props.isSignedIn || !props.isOnline || isWorking}
                  onClick={openDeleteDialog}
                >
                  {t('계정 및 데이터 삭제', 'Delete account & data')}
                </RowAction>
              }
              description={
                props.isOnline
                  ? t('계정, 서버 데이터, 이 기기의 로컬 데이터를 모두 삭제합니다.', 'Deletes your account, server data, and local data on this device.')
                  : t('계정 삭제는 인터넷 연결이 필요합니다.', 'You need an internet connection to delete your account.')
              }
              label={t('계정 삭제', 'Delete account')}
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
                    void run(props.onCheckUpdates, message => message)
                  }
                >
                  {t('업데이트 확인', 'Check for updates')}
                </RowAction>
              }
              description={t('로컬 우선 메모 및 캘린더 워크스페이스', 'A local-first memo and calendar workspace')}
              label={`${t('버전', 'Version')} ${__APP_VERSION__}`}
            />
          </Section>
          <Section
            description={t('Subnota가 사용하는 임베딩 모델과 해당 라이선스입니다. 전체 고지는 저장소의 THIRD_PARTY_NOTICES.md에서 확인할 수 있습니다.', 'Embedding models used by Subnota and their licenses. See THIRD_PARTY_NOTICES.md for the complete notice.')}
            title={t('오픈소스 라이선스', 'Open-source licenses')}
          >
            <Row
              action={
                <Group gap={12} wrap="nowrap">
                  <RowAction
                    onClick={() =>
                      void window.electronAPI?.openExternal(
                        THIRD_PARTY_MODEL_URLS.backendModel,
                      )
                    }
                  >
                    {t('모델 카드', 'Model card')}
                  </RowAction>
                  <RowAction
                    onClick={() =>
                      void window.electronAPI?.openExternal(
                        THIRD_PARTY_MODEL_URLS.backendLicense,
                      )
                    }
                  >
                    {t('라이선스', 'License')}
                  </RowAction>
                </Group>
              }
              description="BAAI/bge-m3 · Apache-2.0 · Hugging Face Inference · revision 5617a9f"
              label={t('백엔드 임베딩 모델', 'Backend embedding model')}
            />
            <Row
              action={
                <Group gap={12} wrap="nowrap">
                  <RowAction
                    onClick={() =>
                      void window.electronAPI?.openExternal(
                        THIRD_PARTY_MODEL_URLS.desktopModel,
                      )
                    }
                  >
                    {t('모델 카드', 'Model card')}
                  </RowAction>
                  <RowAction
                    onClick={() =>
                      void window.electronAPI?.openExternal(
                        THIRD_PARTY_MODEL_URLS.desktopLicense,
                      )
                    }
                  >
                    {t('라이선스', 'License')}
                  </RowAction>
                </Group>
              }
              description={t('Xenova/bge-m3 · MIT · 로컬 다운로드 · ONNX q8 · revision 4de1325', 'Xenova/bge-m3 · MIT · local download · ONNX q8 · revision 4de1325')}
              label={t('데스크톱 임베딩 모델', 'Desktop embedding model')}
            />
          </Section>
          <Section title={t('약관 및 문의', 'Legal & contact')}>
            <Row
              action={
                <Group gap={12} wrap="nowrap">
                  <RowAction
                    onClick={() =>
                      void window.electronAPI?.openExternal(
                        'https://subnota.com/privacy',
                      )
                    }
                  >
                    {t('개인정보 처리방침', 'Privacy policy')}
                  </RowAction>
                  <RowAction
                    onClick={() =>
                      void window.electronAPI?.openExternal(
                        'https://subnota.com/terms',
                      )
                    }
                  >
                    {t('이용약관', 'Terms of service')}
                  </RowAction>
                </Group>
              }
              description={t('서비스 이용과 데이터 처리에 관한 안내입니다.', 'Information about using the service and how data is handled.')}
              label={t('법적 문서', 'Legal documents')}
            />
            <Row
              action={
                <RowAction
                  onClick={() =>
                    void window.electronAPI?.openExternal(
                      'mailto:contact@subnota.com',
                    )
                  }
                >
                  {t('이메일 보내기', 'Send email')}
                </RowAction>
              }
              description="contact@subnota.com"
              label={t('문의', 'Contact')}
            />
          </Section>
        </div>
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

      <Modal
        centered
        closeOnClickOutside={!isDeletingAccount}
        closeOnEscape={!isDeletingAccount}
        onClose={() => {
          if (!isDeletingAccount) {
            setDeleteDialogOpen(false);
          }
        }}
        opened={isDeleteDialogOpen}
        overlayProps={{ backgroundOpacity: 0.42, blur: 2 }}
        padding="md"
        radius="md"
        shadow="sm"
        size={380}
        title={t('계정 삭제', 'Delete account')}
        withCloseButton={!isDeletingAccount}
      >
        <Stack gap={10}>
          <Text size="sm">
            {t('계정과 저장된 데이터를 삭제합니다. 이 작업은 되돌릴 수 없습니다.', 'Deletes your account and saved data. This cannot be undone.')}
          </Text>
          <Text c="dimmed" size="xs">
            {t(`계속하려면 아래에 ‘${deleteWord}’를 입력하세요.`, `Type '${deleteWord}' below to continue.`)}
          </Text>
          <TextInput
            autoComplete="off"
            autoFocus
            disabled={isDeletingAccount}
            aria-label={t('계정 삭제 확인', 'Confirm account deletion')}
            onChange={event => setDeleteConfirmation(event.currentTarget.value)}
            placeholder={deleteWord}
            size="sm"
            value={deleteConfirmation}
          />
          {deleteError && (
            <Text c="red" role="alert" size="xs">
              {deleteError}
            </Text>
          )}
          <Group gap="xs" justify="flex-end" mt={2}>
            <Button
              disabled={isDeletingAccount}
              onClick={() => setDeleteDialogOpen(false)}
              size="sm"
              variant="subtle"
            >
              {t('취소', 'Cancel')}
            </Button>
            <Button
              color="red"
              disabled={deleteConfirmation.trim() !== deleteWord || isDeletingAccount}
              leftSection={isDeletingAccount ? <SubnotaSpinner size={16} /> : undefined}
              onClick={() => void submitDeleteAccount()}
              size="sm"
            >
              {isDeletingAccount
                ? t('삭제 중…', 'Deleting…')
                : deleteError
                  ? t('다시 시도', 'Try again')
                  : t('삭제', 'Delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
