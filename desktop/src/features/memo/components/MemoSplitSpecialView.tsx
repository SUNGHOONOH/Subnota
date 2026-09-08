import type { ComponentProps } from 'react';

import type { UiLanguage } from '../../../lib/appSettings';
import CalendarWorkspace from '../../calendar/CalendarWorkspace';
import ScheduleInboxWorkspace from '../../schedule/ScheduleInboxWorkspace';
import InboxWorkspace from '../../inbox/InboxWorkspace';
import type {
  MemoSplitEditorState,
  MemoSplitPaneState,
  MemoSplitPaneView,
} from './MemoSplitWorkspace';
import MemoSplitPaneViewPicker from './MemoSplitPaneViewPicker';
import NearbyNotesPane from './NearbyNotesPane';
import SourcePaneBody from './SourcePaneBody';
import TopicsPane from './TopicsPane';

type CalendarViewProps = ComponentProps<typeof CalendarWorkspace>;
type ScheduleInboxViewProps = ComponentProps<typeof ScheduleInboxWorkspace>;
type InboxViewProps = ComponentProps<typeof InboxWorkspace>;
type NearbyNotesViewProps = ComponentProps<typeof NearbyNotesPane>;
type TopicsViewProps = ComponentProps<typeof TopicsPane>;
type SourceViewProps = ComponentProps<typeof SourcePaneBody>;

interface MemoSplitSpecialViewProps {
  calendar: CalendarViewProps;
  editor: MemoSplitEditorState;
  inbox: InboxViewProps;
  language: UiLanguage;
  nearby: NearbyNotesViewProps;
  onSelectView: (
    pane: MemoSplitPaneState,
    view: MemoSplitPaneView,
  ) => void;
  pane: MemoSplitPaneState;
  scheduleInbox: ScheduleInboxViewProps;
  source: SourceViewProps;
  topics: TopicsViewProps;
}

/**
 * Renders the non-note bodies that can occupy a split pane.
 *
 * The note editor remains in MemoSplitWorkspace because it owns its live
 * Tiptap instance, draft persistence, ambient search, and schedule overlays.
 * Keeping these read/list/map views here makes that fallback easier to reason
 * about without adding a wrapper element or changing any existing markup.
 */
const MemoSplitSpecialView = ({
  calendar,
  editor,
  inbox,
  language,
  nearby,
  onSelectView,
  pane,
  scheduleInbox,
  source,
  topics,
}: MemoSplitSpecialViewProps) => {
  if (editor.isViewPicker) {
    return (
      <MemoSplitPaneViewPicker
        language={language}
        onSelectView={(view) => onSelectView(pane, view)}
      />
    );
  }

  if (editor.view === 'calendar') {
    return <CalendarWorkspace {...calendar} />;
  }

  if (editor.view === 'briefing') {
    return <ScheduleInboxWorkspace {...scheduleInbox} />;
  }

  if (editor.view === 'inbox') {
    return <InboxWorkspace {...inbox} />;
  }

  if (
    editor.view === 'network' &&
    (editor.networkIsLoading ||
      editor.networkErrorMessage ||
      editor.networkQueryChunk ||
      editor.networkResults)
  ) {
    return <NearbyNotesPane {...nearby} />;
  }

  if (editor.view === 'topics' || editor.view === 'network') {
    // `network` fallback preserves previously persisted State A tabs.
    return <TopicsPane {...topics} />;
  }

  if (editor.view === 'source') {
    return <SourcePaneBody {...source} />;
  }

  return null;
};

export default MemoSplitSpecialView;
