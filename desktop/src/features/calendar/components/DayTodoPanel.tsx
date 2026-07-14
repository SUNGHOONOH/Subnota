import { format } from 'date-fns';

import { CalendarBlockRow } from '../../../types';
import { sortTodos } from '../calendarUtils';
import CalendarTodoItem from './CalendarTodoItem';

interface DayTodoPanelProps {
  blocks: CalendarBlockRow[];
  date: Date;
  onAdd: () => void;
  onEdit: (block: CalendarBlockRow) => void;
  onToggle: (id: string) => void;
}

const DayTodoPanel = ({ blocks, date, onAdd, onEdit, onToggle }: DayTodoPanelProps) => {
  const todos = sortTodos(blocks);

  return (
    <div className="cal-todo-panel">
      <header className="cal-todo-head">
        <span className="cal-todo-date">{format(date, 'M월 d일 (E)')}</span>
        <button aria-label="일정 추가" className="cal-todo-add" onClick={onAdd} type="button">
          +
        </button>
      </header>
      {todos.length === 0 ? (
        <p className="cal-todo-empty">일정이 없습니다</p>
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
