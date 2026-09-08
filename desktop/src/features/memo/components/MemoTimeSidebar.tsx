import type { UiLanguage } from '../../../lib/appSettings';
import { formatMemoDate } from '../../../lib/date';
import { localize } from '../../../lib/uiLanguage';
import { ChevronRight } from '../../../components/icons';
import EmptyState from '../../../components/EmptyState';
import type { MemoRow } from '../../../types';
import { getMemoPreview, getMemoTitle } from '../memoWorkspaceUtils';

interface MemoTimeSidebarProps {
  activeMemoId: string | null;
  collapsedSections: ReadonlySet<string>;
  language: UiLanguage;
  onOpenMemoMenu: (memoId: string, x: number, y: number) => void;
  onSelectMemo: (memo: MemoRow) => void;
  onToggleSection: (title: string) => void;
  sections: Array<{ data: MemoRow[]; title: string }>;
}

const MemoTimeSidebar = ({
  activeMemoId,
  collapsedSections,
  language,
  onOpenMemoMenu,
  onSelectMemo,
  onToggleSection,
  sections,
}: MemoTimeSidebarProps) => {
  const t = (korean: string, english: string) => localize(language, korean, english);

  return (
    <div className="session-list">
      {sections.map(section => {
        const isCollapsed = collapsedSections.has(section.title);

        return (
          <section key={section.title}>
            <button
              aria-expanded={!isCollapsed}
              className={`session-section-toggle ${isCollapsed ? 'collapsed' : ''}`}
              onClick={() => onToggleSection(section.title)}
              type="button"
            >
              <ChevronRight size={13} />
              {section.title}
              <span className="session-section-count">
                {section.data.length}
              </span>
            </button>
            {!isCollapsed && section.data.map(memo => (
              <button
                className={memo.id === activeMemoId ? 'memo-row active' : 'memo-row'}
                key={memo.id}
                onClick={() => onSelectMemo(memo)}
                onContextMenu={event => {
                  event.preventDefault();
                  onOpenMemoMenu(memo.id, event.clientX, event.clientY);
                }}
                type="button"
              >
                <strong>{getMemoTitle(memo, language)}</strong>
                <span>
                  {formatMemoDate(memo.updated_at, language)} ·{' '}
                  {getMemoPreview(memo, language)}
                </span>
              </button>
            ))}
          </section>
        );
      })}
      {sections.length === 0 && (
        <EmptyState
          size="inline"
          title={t('첫 메모를 시작해 보세요', 'Start your first note')}
          tone="start"
        />
      )}
    </div>
  );
};

export default MemoTimeSidebar;
