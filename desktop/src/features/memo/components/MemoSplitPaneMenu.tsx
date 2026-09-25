import type { UiLanguage } from '../../../lib/appSettings';
import { Check } from '../../../components/icons';
import type { MemoSplitPaneView } from './MemoSplitWorkspace';
import {
  MENU_VIEWS,
  VIEW_ICONS,
} from './MemoSplitPaneViewPicker';
import { viewLabel } from '../memoSplitWorkspaceUtils';

interface MemoSplitPaneMenuProps {
  activeView: MemoSplitPaneView;
  editorCount: number;
  language: UiLanguage;
  onCloseAllEditors: () => void;
  onDropdownElementChange: (element: HTMLDivElement | null) => void;
  onSelectView: (view: MemoSplitPaneView) => void;
}

const MemoSplitPaneMenu = ({
  activeView,
  editorCount,
  language,
  onCloseAllEditors,
  onDropdownElementChange,
  onSelectView,
}: MemoSplitPaneMenuProps) => (
  <div
    className="split-pane-menu-dropdown"
    ref={onDropdownElementChange}
  >
    <button
      className="split-menu-item"
      onClick={onCloseAllEditors}
      type="button"
    >
      {language === 'en'
        ? `Close all ${editorCount} tabs`
        : `${editorCount}개의 탭 모두 닫기`}
    </button>
    <div className="split-menu-separator" />
    {MENU_VIEWS.map(view => {
      const ViewIcon = VIEW_ICONS[view];
      return (
        <button
          key={view}
          onClick={() => onSelectView(view)}
          className={`split-menu-item split-menu-view-item ${activeView === view ? 'active' : ''}`}
          type="button"
        >
          <span className="split-menu-check">
            {activeView === view ? <Check size={14} /> : null}
          </span>
          {ViewIcon ? <ViewIcon size={15} /> : null}
          <span>{viewLabel(view, language)}</span>
        </button>
      );
    })}
  </div>
);

export default MemoSplitPaneMenu;
