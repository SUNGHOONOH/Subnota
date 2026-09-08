import type { MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { SegmentedControl, Tooltip, VisuallyHidden } from '@mantine/core';
import {
  AppWindow,
  CalendarDays,
  Download,
  Folder,
  List,
  NotebookText,
  Plus,
  Settings,
  Topics,
} from '@/components/icons';
import TooltipIconButton from '../../components/TooltipIconButton';
import SubnotaSpinner from '../../components/SubnotaSpinner';
import type { MemoSidebarMode } from '../memo/MemoWorkspace';
import {
  DEFAULT_APP_SHORTCUT_SETTINGS,
  formatHotkeyTooltip,
  type AppShortcutSettings,
} from '../../lib/shortcutSettings';
import type { TabKey } from '../../types';

type Translate = (korean: string, english: string) => string;

interface AppNavRailProps {
  activeTab: TabKey;
  appShortcuts: AppShortcutSettings;
  handleMemoNavClick: () => void;
  hasNewReport: boolean;
  hasPendingUpdate: boolean;
  isSessionCollapsed: boolean;
  isUpdatePopoverOpen: boolean;
  isUpdateWorking: boolean;
  memoSidebarMode: MemoSidebarMode;
  onOpenCalendar: () => void;
  onOpenInbox: () => void;
  onOpenTopics: () => void;
  onOpenNewTab: () => void;
  onOpenSettings: () => void;
  onRevealFloatingNav: () => void;
  onCollapsedNavInteraction: () => void;
  onSetActiveTab: (tab: TabKey) => void;
  onSetMemoSidebarMode: (mode: MemoSidebarMode) => void;
  onStartUpdate: () => void;
  updateActionLabel: string;
  updateActionTooltip: string;
  translate: Translate;
}

const AppNavRail = ({
  activeTab,
  appShortcuts,
  handleMemoNavClick,
  hasNewReport,
  hasPendingUpdate,
  isSessionCollapsed,
  isUpdatePopoverOpen,
  isUpdateWorking,
  memoSidebarMode,
  onOpenCalendar,
  onOpenInbox,
  onOpenTopics,
  onOpenNewTab,
  onOpenSettings,
  onRevealFloatingNav,
  onCollapsedNavInteraction,
  onSetActiveTab,
  onSetMemoSidebarMode,
  onStartUpdate,
  updateActionLabel,
  updateActionTooltip,
  translate: t,
}: AppNavRailProps) => {
  const handleClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!isSessionCollapsed) {
      return;
    }
    const button = (event.target as HTMLElement).closest('button');
    if (button instanceof HTMLElement) {
      button.blur();
    }
    onCollapsedNavInteraction();
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="nav-rail-reveal-zone"
        onMouseEnter={onRevealFloatingNav}
      />
      <aside className="nav-rail" onClickCapture={handleClickCapture}>
        <TooltipIconButton
          aria-label={t('메모', 'Memos')}
          className={activeTab === 'memo' ? 'nav-item active' : 'nav-item'}
          delay={300}
          onClick={handleMemoNavClick}
          placement="right"
          tooltip={formatHotkeyTooltip(
            t('메모', 'Memos'),
            appShortcuts.openMemos,
          )}
        >
          <NotebookText size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label={t('캘린더', 'Calendar')}
          className={`nav-item${hasNewReport ? ' has-badge' : ''}`}
          delay={300}
          onClick={onOpenCalendar}
          placement="right"
          tooltip={formatHotkeyTooltip(
            hasNewReport
              ? t('캘린더 · 새 월간 기록', 'Calendar · new monthly report')
              : t('캘린더', 'Calendar'),
            appShortcuts.openCalendar,
          )}
        >
          <CalendarDays size={22} />
          {hasNewReport && (
            <VisuallyHidden>
              {t('새 월간 기록', 'New monthly report')}
            </VisuallyHidden>
          )}
        </TooltipIconButton>
        <TooltipIconButton
          aria-label={t('링크', 'Inbox')}
          className="nav-item"
          delay={300}
          onClick={onOpenInbox}
          placement="right"
          tooltip={formatHotkeyTooltip(
            t('링크', 'Inbox'),
            appShortcuts.openInbox,
          )}
        >
          <AppWindow size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label="Topics"
          className="nav-item"
          delay={300}
          onClick={onOpenTopics}
          placement="right"
          tooltip={formatHotkeyTooltip('Topics', appShortcuts.openTopics)}
        >
          <Topics size={22} />
        </TooltipIconButton>
        <TooltipIconButton
          aria-label={t('새 탭', 'New tab')}
          className="nav-item nav-new-tab"
          delay={300}
          onClick={onOpenNewTab}
          placement="right"
          tooltip={formatHotkeyTooltip(
            t('새 탭', 'New tab'),
            appShortcuts.createTab,
          )}
        >
          <Plus size={22} />
        </TooltipIconButton>
        <div aria-hidden="true" className="nav-divider nav-mode-divider" />
        <SegmentedControl<MemoSidebarMode>
          aria-label={t('메모 보기 방식', 'Memo view')}
          classNames={{
            control: 'nav-mode-segment-control',
            innerLabel: 'nav-mode-segment-inner-label',
            label: 'nav-mode-segment-label',
            root: 'nav-mode-segment nav-context-item',
          }}
          data={[
            {
              label: (
                <Tooltip
                  label={t('목록', 'List')}
                  openDelay={300}
                  position="right"
                >
                  <span className="nav-mode-segment-icon">
                    {memoSidebarMode === 'time' && (
                      <motion.span
                        animate={{ opacity: 1, scale: 1 }}
                        aria-hidden="true"
                        className="nav-mode-segment-motion-indicator"
                        initial={{ opacity: 0, scale: 0.92 }}
                        transition={{
                          duration: 0.14,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                      />
                    )}
                    <List size={22} />
                    <VisuallyHidden>{t('목록', 'List')}</VisuallyHidden>
                  </span>
                </Tooltip>
              ),
              value: 'time',
            },
            {
              label: (
                <Tooltip
                  label={t('폴더', 'Folders')}
                  openDelay={300}
                  position="right"
                >
                  <span className="nav-mode-segment-icon">
                    {memoSidebarMode === 'folders' && (
                      <motion.span
                        animate={{ opacity: 1, scale: 1 }}
                        aria-hidden="true"
                        className="nav-mode-segment-motion-indicator"
                        initial={{ opacity: 0, scale: 0.92 }}
                        transition={{
                          duration: 0.14,
                          ease: [0.4, 0, 0.2, 1],
                        }}
                      />
                    )}
                    <Folder size={22} />
                    <VisuallyHidden>{t('폴더', 'Folders')}</VisuallyHidden>
                  </span>
                </Tooltip>
              ),
              value: 'folders',
            },
          ]}
          onChange={(mode) => {
            onSetActiveTab('memo');
            onSetMemoSidebarMode(mode);
          }}
          orientation="vertical"
          styles={{
            indicator: { display: 'none' },
            root: { background: 'var(--app-color-bg-muted)' },
          }}
          transitionDuration={200}
          transitionTimingFunction="cubic-bezier(0.4, 0, 0.2, 1)"
          value={memoSidebarMode}
          withItemsBorders={false}
        />
        <div className="nav-spacer" />
        <div aria-hidden="true" className="nav-divider nav-utility-divider" />
        {hasPendingUpdate && (
          <TooltipIconButton
            aria-controls={
              isUpdatePopoverOpen ? 'subnota-update-popover' : undefined
            }
            aria-expanded={isUpdatePopoverOpen || undefined}
            aria-label={updateActionLabel}
            className="nav-item nav-utility nav-update-action"
            delay={300}
            disabled={isUpdateWorking}
            onClick={onStartUpdate}
            placement="right"
            tooltip={updateActionTooltip}
          >
            {isUpdateWorking ? (
              <SubnotaSpinner size={22} />
            ) : (
              <Download size={22} />
            )}
            <VisuallyHidden>{updateActionLabel}</VisuallyHidden>
          </TooltipIconButton>
        )}
        <TooltipIconButton
          aria-label={t('설정', 'Settings')}
          className="nav-item nav-utility"
          delay={300}
          onClick={onOpenSettings}
          placement="right"
          tooltip={formatHotkeyTooltip(
            t('설정', 'Settings'),
            DEFAULT_APP_SHORTCUT_SETTINGS.openSettings,
          )}
        >
          <Settings size={22} />
        </TooltipIconButton>
      </aside>
    </>
  );
};

export default AppNavRail;
