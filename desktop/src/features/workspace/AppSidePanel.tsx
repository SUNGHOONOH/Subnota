import type { PointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { PanelRight, PanelRightClose, X } from '../../components/icons';
import TooltipIconButton from '../../components/TooltipIconButton';
import type { InboxSession } from '../../services/backend/inboxService';
import type { NetworkSearchResult } from '../../services/local/memoSearchTypes';
import type {
  MemoRow,
  ScheduleInboxRow,
} from '../../types';
import PreviewPanel, {
  type PreviewPanelState,
} from '../preview/PreviewPanel';
import ScheduleInboxWorkspace from '../schedule/ScheduleInboxWorkspace';

type AppSidePanelKind = 'preview' | 'schedule-inbox';

type Translate = (korean: string, english: string) => string;

interface AppSidePanelProps {
  activeSidePanel: AppSidePanelKind | null;
  collapseDurationMs: number;
  hasOpenSidePanel: boolean;
  incompleteScheduleInbox: ScheduleInboxRow[];
  inboxItems: InboxSession[];
  isSidePanelCollapsed: boolean;
  isSidePanelPushed: boolean;
  memos: MemoRow[];
  onClosePreview: () => void;
  onCloseScheduleInbox: () => void;
  onCollapse: () => void;
  onExpand: () => void;
  onPlaceScheduleInbox: (item: ScheduleInboxRow) => void;
  onPromotePreview: (result: NetworkSearchResult) => void;
  onResizeStart: (event: PointerEvent<HTMLDivElement>) => void;
  onRetryInboxSummary: (item: InboxSession) => Promise<void>;
  onRetryPreview: () => void;
  onSelectPreviewResult: (result: NetworkSearchResult) => void;
  onShowList: () => void;
  onShowMoreResults: () => void;
  previewPanel: PreviewPanelState | null;
  shouldReduceMotion: boolean | null;
  translate: Translate;
  onDeleteScheduleInbox: (item: ScheduleInboxRow) => void;
}

const AppSidePanel = ({
  activeSidePanel,
  collapseDurationMs,
  hasOpenSidePanel,
  incompleteScheduleInbox,
  inboxItems,
  isSidePanelCollapsed,
  isSidePanelPushed,
  memos,
  onClosePreview,
  onCloseScheduleInbox,
  onCollapse,
  onExpand,
  onPlaceScheduleInbox,
  onPromotePreview,
  onResizeStart,
  onRetryInboxSummary,
  onRetryPreview,
  onSelectPreviewResult,
  onShowList,
  onShowMoreResults,
  previewPanel,
  shouldReduceMotion,
  translate: t,
  onDeleteScheduleInbox,
}: AppSidePanelProps) => (
  <>
    {hasOpenSidePanel && isSidePanelCollapsed && (
      <>
        <div aria-hidden="true" className="app-side-panel-reveal-zone" />
        <div className="app-side-panel-collapsed">
          <TooltipIconButton
            aria-label={t('사이드 패널 열기', 'Open side panel')}
            className="app-side-panel-toggle"
            onClick={onExpand}
            tooltip={t('사이드 패널 열기', 'Open side panel')}
          >
            <PanelRight size={16} />
          </TooltipIconButton>
        </div>
      </>
    )}
    <AnimatePresence initial={false}>
      {hasOpenSidePanel && !isSidePanelCollapsed && (
        <motion.div
          animate={{ x: 0 }}
          className="app-side-panel-slot"
          // Push 모드에서는 그리드 열 자체가 닫힘을 보간한다. 여기서도
          // 슬라이드 exit을 실행하면 트랙이 0으로 줄며 슬롯이 fixed로
          // 바뀌는 한 프레임이 생겨, 뒤의 그래프 캔버스가 잘못 축소된다.
          exit={
            shouldReduceMotion || isSidePanelPushed
              ? undefined
              : { x: '100%' }
          }
          initial={shouldReduceMotion ? false : { x: '100%' }}
          key="app-side-panel"
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  duration: collapseDurationMs / 1000,
                  ease: [0.4, 0, 0.2, 1],
                }
          }
        >
          {activeSidePanel === 'preview' && previewPanel ? (
            <PreviewPanel
              inboxItems={inboxItems}
              memos={memos}
              onClose={onClosePreview}
              onCollapse={onCollapse}
              onPromote={onPromotePreview}
              onResizeStart={onResizeStart}
              onRetryInboxSummary={onRetryInboxSummary}
              onRetry={onRetryPreview}
              onSelectResult={onSelectPreviewResult}
              onShowMoreResults={onShowMoreResults}
              onShowList={onShowList}
              state={previewPanel}
            />
          ) : (
            <aside
              aria-label={t('일정 저장함', 'Schedule inbox')}
              className="schedule-inbox-panel"
            >
              <div
                aria-hidden="true"
                className="preview-resizer"
                onPointerDown={onResizeStart}
              />
              <header className="schedule-inbox-panel-header">
                <span className="schedule-inbox-panel-title">
                  {t('일정 저장함', 'Schedule inbox')}
                </span>
                <div className="schedule-inbox-panel-actions">
                  <TooltipIconButton
                    aria-label={t('사이드 패널 접기', 'Collapse side panel')}
                    className="schedule-inbox-panel-action side-panel-collapse-action"
                    onClick={onCollapse}
                    tooltip={t('사이드 패널 접기', 'Collapse side panel')}
                  >
                    <PanelRightClose size={16} />
                  </TooltipIconButton>
                  <TooltipIconButton
                    aria-label={t('일정 저장함 닫기', 'Close schedule inbox')}
                    className="schedule-inbox-panel-action"
                    onClick={onCloseScheduleInbox}
                    tooltip={t('닫기', 'Close')}
                  >
                    <X size={16} />
                  </TooltipIconButton>
                </div>
              </header>
              <ScheduleInboxWorkspace
                compact
                inboxItems={incompleteScheduleInbox}
                onDeleteInbox={onDeleteScheduleInbox}
                onPlaceInbox={onPlaceScheduleInbox}
              />
            </aside>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </>
);

export default AppSidePanel;
