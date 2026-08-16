import TooltipIconButton from '../../../components/TooltipIconButton';
import { CalendarBlockRow } from '../../../types';
import { getBlockStart } from '../calendarUtils';
import { getUiDateLocale, localize, useUiLanguage } from '../../../lib/uiLanguage';

interface CalendarTodoItemProps {
  block: CalendarBlockRow;
  onEdit: (block: CalendarBlockRow) => void;
  onToggle: (id: string) => void;
}

const CalendarTodoItem = ({ block, onEdit, onToggle }: CalendarTodoItemProps) => {
  const language = useUiLanguage();
  const t = (korean: string, english: string) => localize(language, korean, english);
  const completed = Boolean(block.is_completed);

  return (
    <div className={`cal-todo-item${completed ? ' completed' : ''}`}>
      <TooltipIconButton
        aria-label={completed ? t('완료 취소', 'Mark incomplete') : t('완료', 'Mark complete')}
        className="cal-todo-check"
        onClick={() => onToggle(block.id)}
        placement="left"
        tooltip={completed ? t('완료 취소', 'Mark incomplete') : t('완료', 'Mark complete')}
      >
        {completed ? '✓' : ''}
      </TooltipIconButton>
      <button className="cal-todo-title" onClick={() => onEdit(block)} type="button">
        {!block.all_day && (
          <span className="cal-todo-time">
            {new Intl.DateTimeFormat(getUiDateLocale(language), {
              hour: 'numeric',
              minute: '2-digit',
            }).format(getBlockStart(block))}
          </span>
        )}
        <span className="cal-todo-text">{block.title}</span>
      </button>
    </div>
  );
};

export default CalendarTodoItem;
