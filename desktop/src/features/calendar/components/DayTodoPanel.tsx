import { ChevronDown, ChevronUp } from '@/components/icons';
import TooltipIconButton from '@/components/TooltipIconButton';
import { CalendarBlockRow } from '../../../types';
import { sortTodos } from '../calendarUtils';
import CalendarTodoItem from './CalendarTodoItem';
import EmptyState from '../../../components/EmptyState';
import { getUiDateLocale, localize, useUiLanguage } from '../../../lib/uiLanguage';

interface DayTodoPanelProps {
  blocks: CalendarBlockRow[];
  date: Date;
  isDetailOpen?: boolean;
  onAdd: () => void;
  onEdit: (block: CalendarBlockRow) => void;
  onToggleDetail?: () => void;
  onToggle: (id: string) => void;
}

const DayTodoPanel = ({
  blocks,
  date,
  isDetailOpen = false,
  onAdd,
  onEdit,
  onToggleDetail,
  onToggle,
}: DayTodoPanelProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const todos = sortTodos(blocks);

  return (
    <div className="cal-todo-panel">
      <header className="cal-todo-head">
        <span className="cal-todo-date">
          {new Intl.DateTimeFormat(getUiDateLocale(language), {
            day: 'numeric',
            month: 'long',
            weekday: 'short',
          }).format(date)}
        </span>
        <div className="cal-todo-actions">
          {onToggleDetail && (
            <TooltipIconButton
              aria-expanded={isDetailOpen}
              aria-label={isDetailOpen ? t('할 일 상세 접기', 'Collapse to-do details') : t('할 일 자세히 보기', 'Show to-do details')}
              className="cal-todo-detail-toggle"
              onClick={onToggleDetail}
              placement="left"
              tooltip={isDetailOpen ? t('할 일 상세 접기', 'Collapse to-do details') : t('할 일 자세히 보기', 'Show to-do details')}
            >
              {/* 상세는 Todo 패널 위쪽으로 펼쳐진다. 셰브론은 누르면
                  내용이 움직일 방향을 가리킨다. */}
              {isDetailOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </TooltipIconButton>
          )}
          <TooltipIconButton
            aria-label={t('일정 추가', 'Add event')}
            className="cal-todo-add"
            onClick={onAdd}
            placement="left"
            tooltip={t('일정 추가', 'Add event')}
          >
            +
          </TooltipIconButton>
        </div>
      </header>
      {todos.length === 0 ? (
        <EmptyState size="inline" title={t('비어 있는 하루입니다', 'Nothing planned for this day')} />
      ) : (
        <div className="cal-todo-list">
          {todos.map(block => (
            <CalendarTodoItem
              block={block}
              key={block.id}
              onEdit={onEdit}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DayTodoPanel;
