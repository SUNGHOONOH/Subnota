import { format } from 'date-fns';

import { CalendarBlockRow } from '../../../types';
import { getBlockStart } from '../calendarUtils';

interface CalendarTodoItemProps {
  block: CalendarBlockRow;
  onEdit: (block: CalendarBlockRow) => void;
  onToggle: (id: string) => void;
}

const CalendarTodoItem = ({ block, onEdit, onToggle }: CalendarTodoItemProps) => {
  const completed = Boolean(block.is_completed);

  return (
    <div className={`cal-todo-item${completed ? ' completed' : ''}`}>
      <button
        aria-label={completed ? '완료 취소' : '완료'}
        className="cal-todo-check"
        onClick={() => onToggle(block.id)}
        type="button"
      >
        {completed ? '✓' : ''}
      </button>
      <button className="cal-todo-title" onClick={() => onEdit(block)} type="button">
        {!block.all_day && (
          <span className="cal-todo-time">{format(getBlockStart(block), 'a h:mm')}</span>
        )}
        <span className="cal-todo-text">{block.title}</span>
      </button>
    </div>
  );
};

export default CalendarTodoItem;
