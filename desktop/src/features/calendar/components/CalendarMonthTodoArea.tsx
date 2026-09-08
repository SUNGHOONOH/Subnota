import { AnimatePresence, motion } from 'framer-motion';

import type { CalendarBlockRow } from '../../../types';
import DayTodoPanel from './DayTodoPanel';

interface CalendarMonthTodoAreaProps {
  blocks: CalendarBlockRow[];
  date: Date;
  detailAriaLabel: string;
  isDetailOpen: boolean;
  onAdd: () => void;
  onEdit: (block: CalendarBlockRow) => void;
  onToggle: (blockId: string) => void;
  onToggleDetail: () => void;
  shouldReduceMotion: boolean | null;
}

const CalendarMonthTodoArea = ({
  blocks,
  date,
  detailAriaLabel,
  isDetailOpen,
  onAdd,
  onEdit,
  onToggle,
  onToggleDetail,
  shouldReduceMotion,
}: CalendarMonthTodoAreaProps) => (
  <>
    <aside className="cal-side">
      <DayTodoPanel
        blocks={blocks}
        date={date}
        isDetailOpen={isDetailOpen}
        onAdd={onAdd}
        onEdit={onEdit}
        onToggleDetail={onToggleDetail}
        onToggle={onToggle}
      />
    </aside>

    <AnimatePresence initial={false}>
      {isDetailOpen && (
        <motion.aside
          animate={{ opacity: 1, y: 0 }}
          aria-label={detailAriaLabel}
          className="cal-month-todo-overlay"
          exit={
            shouldReduceMotion
              ? undefined
              : { opacity: 0, transition: { duration: 0.15 }, y: 8 }
          }
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          key="month-todo-overlay"
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { bounce: 0, duration: 0.3, type: 'spring' }
          }
        >
          <DayTodoPanel
            blocks={blocks}
            date={date}
            isDetailOpen
            onAdd={onAdd}
            onEdit={onEdit}
            onToggleDetail={onToggleDetail}
            onToggle={onToggle}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  </>
);

export default CalendarMonthTodoArea;
