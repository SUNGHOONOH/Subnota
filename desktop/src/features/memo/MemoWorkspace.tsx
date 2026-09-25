import {
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';

import { getSections } from '../../lib/memoSections';
import { splitMemoCategories } from '../../lib/memoCategory';
import {
  MemoFolder,
  MemoFolderMembership,
  MemoFolderMode,
  MemoRow,
} from '../../types';
import type { FolderRecommendation } from './folderOrganization';
import { localize, useUiLanguage } from '../../lib/uiLanguage';
import MemoContextMenu from './components/MemoContextMenu';
import MemoFolderSidebar from './components/MemoFolderSidebar';
import MemoTimeSidebar from './components/MemoTimeSidebar';
import {
  COLLAPSED_SECTIONS_KEY,
  readCollapsedSections,
} from './memoWorkspaceUtils';

interface MemoWorkspaceProps {
  activeMemoId: string | null;
  memos: MemoRow[];
  isSessionCollapsed?: boolean;
  sessionRailWidth: number;
  onSessionRailWidthChange: (width: number) => void;
  isSessionRailResizing: boolean;
  onSessionRailResizeStateChange: (isResizing: boolean) => void;
  onDeleteMemoById: (id: string) => void;
  onCreateFolder: (draft: {
    description?: string;
    mode: MemoFolderMode;
    name: string;
  }) => Promise<MemoFolder | null>;
  onCreateFolderFromRecommendation: (draft: {
    description?: string;
    memoIds: string[];
    mode: MemoFolderMode;
    name: string;
    topicId: string;
  }) => Promise<MemoFolder | null>;
  onCreateMemoInFolder: (folderId: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onSelectMemo: (memo: MemoRow) => void;
  onTogglePinMemo?: (memoId: string) => void;
  onToggleMemoFolder: (folderId: string, memoId: string) => Promise<void>;
  onUpdateFolderMode: (folderId: string, mode: MemoFolderMode) => Promise<void>;
  onUpdateFolderDetails: (
    folderId: string,
    draft: { description: string; name: string },
  ) => Promise<void>;
  pinnedMemoIds?: string[];
  folders: MemoFolder[];
  folderMemberships: MemoFolderMembership[];
  folderRecommendations: FolderRecommendation[];
  sidebarMode: MemoSidebarMode;
  workspaceContent?: ReactNode;
}

export type MemoSidebarMode = 'time' | 'folders';

export const SESSION_RAIL_MIN_WIDTH = 200;
export const SESSION_RAIL_WIDTH = 200;
export const SESSION_RAIL_MAX_WIDTH = 300;

export const clampSessionRailWidth = (width: number) =>
  Math.min(SESSION_RAIL_MAX_WIDTH, Math.max(SESSION_RAIL_MIN_WIDTH, width));

const MemoWorkspace = ({
  activeMemoId,
  memos,
  isSessionCollapsed = false,
  sessionRailWidth,
  onSessionRailWidthChange,
  isSessionRailResizing,
  onSessionRailResizeStateChange,
  onDeleteMemoById,
  onCreateFolder,
  onCreateFolderFromRecommendation,
  onCreateMemoInFolder,
  onDeleteFolder,
  onSelectMemo,
  onTogglePinMemo,
  onToggleMemoFolder,
  onUpdateFolderMode,
  onUpdateFolderDetails,
  pinnedMemoIds = [],
  folders,
  folderMemberships,
  folderRecommendations,
  sidebarMode,
  workspaceContent,
}: MemoWorkspaceProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) =>
    localize(language, korean, english);
  const [memoMenu, setMemoMenu] = useState<{ x: number; y: number; id: string } | null>(
    null,
  );
  const { miniMemos, normalMemos } = useMemo(
    () => splitMemoCategories(memos),
    [memos],
  );
  // 미니는 별도 모드가 아니라 노트 목록의 한 섹션이다.
  const sections = getSections(normalMemos, pinnedMemoIds, miniMemos, language);
  const [collapsedSections, setCollapsedSections] = useState(readCollapsedSections);
  const toggleSection = (title: string) => {
    const next = new Set(collapsedSections);
    if (next.has(title)) {
      next.delete(title);
    } else {
      next.add(title);
    }
    setCollapsedSections(next);
    window.localStorage?.setItem(
      COLLAPSED_SECTIONS_KEY,
      JSON.stringify([...next]),
    );
  };
  const handleSessionRailResizeStart = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (isSessionCollapsed) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const startX = event.clientX;
    const startWidth = sessionRailWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    let isCleanedUp = false;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    onSessionRailResizeStateChange(true);

    const handleMove = (moveEvent: PointerEvent) => {
      onSessionRailWidthChange(
        clampSessionRailWidth(startWidth + moveEvent.clientX - startX),
      );
    };

    const cleanup = () => {
      if (isCleanedUp) {
        return;
      }

      isCleanedUp = true;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      window.removeEventListener('blur', cleanup);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      onSessionRailResizeStateChange(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
    window.addEventListener('blur', cleanup);
  };

  const handleSessionRailResizeKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      event.key !== 'ArrowLeft' &&
      event.key !== 'ArrowRight' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }

    event.preventDefault();
    const nextWidth =
      event.key === 'Home'
        ? SESSION_RAIL_MIN_WIDTH
        : event.key === 'End'
          ? SESSION_RAIL_MAX_WIDTH
          : sessionRailWidth + (event.key === 'ArrowRight' ? 8 : -8);
    onSessionRailWidthChange(clampSessionRailWidth(nextWidth));
  };


  return (
    <div className="memo-layout">
      <motion.aside
        className="session-rail"
        initial={false}
        animate={{ width: isSessionCollapsed ? 0 : sessionRailWidth }}
        transition={{
          duration: isSessionRailResizing ? 0 : 0.28,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
       <div
         className="session-rail-inner"
         style={{ '--session-rail-width': `${sessionRailWidth}px` } as CSSProperties}
       >
        {sidebarMode === 'time' ? (
          <MemoTimeSidebar
            activeMemoId={activeMemoId}
            collapsedSections={collapsedSections}
            language={language}
            onOpenMemoMenu={(id, x, y) => setMemoMenu({ id, x, y })}
            onSelectMemo={onSelectMemo}
            onToggleSection={toggleSection}
            sections={sections}
          />
        ) : sidebarMode === 'folders' ? (
          <MemoFolderSidebar
            activeMemoId={activeMemoId}
            folderMemberships={folderMemberships}
            folderRecommendations={folderRecommendations}
            folders={folders}
            language={language}
            memos={memos}
            normalMemos={normalMemos}
            onCreateFolder={onCreateFolder}
            onCreateFolderFromRecommendation={onCreateFolderFromRecommendation}
            onCreateMemoInFolder={onCreateMemoInFolder}
            onDeleteFolder={onDeleteFolder}
            onOpenMemoMenu={(id, x, y) => setMemoMenu({ id, x, y })}
            onSelectMemo={onSelectMemo}
            onUpdateFolderDetails={onUpdateFolderDetails}
            onUpdateFolderMode={onUpdateFolderMode}
          />
        ) : null}
       </div>
        <div
          aria-hidden={isSessionCollapsed}
          aria-label={t('메모 목록 너비 조절', 'Resize note list')}
          aria-orientation="vertical"
          aria-valuemax={SESSION_RAIL_MAX_WIDTH}
          aria-valuemin={SESSION_RAIL_MIN_WIDTH}
          aria-valuenow={Math.round(sessionRailWidth)}
          className="session-rail-resizer"
          onKeyDown={handleSessionRailResizeKeyDown}
          onPointerDown={handleSessionRailResizeStart}
          role="separator"
          tabIndex={isSessionCollapsed ? -1 : 0}
        />
      </motion.aside>

      {workspaceContent}

      {memoMenu && (
        <MemoContextMenu
          folders={folders}
          folderMemberships={folderMemberships}
          memoMenu={memoMenu}
          onClose={() => setMemoMenu(null)}
          onDeleteMemoById={onDeleteMemoById}
          onToggleMemoFolder={onToggleMemoFolder}
          onTogglePinMemo={onTogglePinMemo}
          pinnedMemoIds={pinnedMemoIds}
          t={t}
        />
      )}
    </div>
  );
};

export default MemoWorkspace;
