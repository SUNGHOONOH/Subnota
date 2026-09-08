import type { UiLanguage } from '../../../lib/appSettings';
import { localize } from '../../../lib/uiLanguage';
import {
  AppWindow,
  CalendarDays,
  Inbox,
  NotebookText,
  Topics,
} from '../../../components/icons';
import type { MemoSplitPaneView } from './MemoSplitWorkspace';
import { viewLabel } from '../memoSplitWorkspaceUtils';

export const MENU_VIEWS: MemoSplitPaneView[] = ['memo', 'inbox', 'calendar', 'topics'];

export const VIEW_ICONS: Partial<Record<MemoSplitPaneView, typeof NotebookText>> = {
  briefing: Inbox,
  calendar: CalendarDays,
  inbox: AppWindow,
  memo: NotebookText,
  topics: Topics,
};

interface MemoSplitPaneViewPickerProps {
  language: UiLanguage;
  onSelectView: (view: MemoSplitPaneView) => void;
}

const MemoSplitPaneViewPicker = ({
  language,
  onSelectView,
}: MemoSplitPaneViewPickerProps) => (
  <div className="split-view-picker-stage">
    <section
      aria-label={localize(language, '새 탭에서 열기', 'Open in a new tab')}
      className="split-view-picker-panel"
    >
      <h2 className="split-view-picker-title">
        {localize(language, '새 탭에서 열기', 'Open in a new tab')}
      </h2>
      <div className="split-view-picker">
        {MENU_VIEWS.map((view, index) => {
          const ViewIcon = VIEW_ICONS[view];
          return (
            <button
              autoFocus={index === 0}
              className="split-view-picker-item"
              key={view}
              onClick={() => onSelectView(view)}
              type="button"
            >
              {ViewIcon ? <ViewIcon size={18} /> : null}
              <span>{viewLabel(view, language)}</span>
            </button>
          );
        })}
      </div>
    </section>
  </div>
);

export default MemoSplitPaneViewPicker;
