import type { ReactElement } from 'react';
import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CalendarMonthTodoArea from '../features/calendar/components/CalendarMonthTodoArea';

vi.mock('../features/calendar/components/DayTodoPanel', () => ({
  default: () => <div className="cal-todo-panel" />,
}));

const render = (node: ReactElement) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);

const baseProps = {
  blocks: [],
  date: new Date('2026-09-07T09:00:00.000Z'),
  detailAriaLabel: '오늘 할 일 상세',
  onAdd: () => undefined,
  onEdit: () => undefined,
  onToggle: () => undefined,
  onToggleDetail: () => undefined,
  shouldReduceMotion: false,
};

describe('CalendarMonthTodoArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the monthly summary panel mounted while details are closed', () => {
    const markup = render(
      <CalendarMonthTodoArea {...baseProps} isDetailOpen={false} />,
    );

    expect(markup).toContain('cal-side');
    expect(markup).toContain('cal-todo-panel');
    expect(markup).not.toContain('cal-month-todo-overlay');
  });

  it('renders the detail overlay with the supplied accessible label when open', () => {
    const markup = render(
      <CalendarMonthTodoArea {...baseProps} isDetailOpen />,
    );

    expect(markup).toContain('cal-side');
    expect(markup).toContain('cal-month-todo-overlay');
    expect(markup).toContain('aria-label="오늘 할 일 상세"');
  });
});
