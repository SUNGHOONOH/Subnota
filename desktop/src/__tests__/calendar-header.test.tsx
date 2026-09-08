import type { ReactElement } from 'react';
import { MantineProvider } from '@mantine/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CalendarHeader from '../features/calendar/components/CalendarHeader';

const render = (node: ReactElement) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>);

describe('CalendarHeader', () => {
  it('renders the existing view, navigation, and optional utility controls', () => {
    const markup = render(
      <CalendarHeader
        hasNewReport
        isScheduleInboxOpen
        language="ko"
        onChangeView={() => undefined}
        onNext={() => undefined}
        onOpenReport={() => undefined}
        onPrevious={() => undefined}
        onToday={() => undefined}
        onToggleScheduleInbox={() => undefined}
        title="2026년 9월"
        view="month"
      />,
    );

    expect(markup).toContain('cal-header');
    expect(markup).toContain('2026년 9월');
    expect(markup).toContain('aria-label="캘린더 보기"');
    expect(markup).toContain('aria-label="캘린더 이동"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('일정 저장함');
    expect(markup).toContain('월간 기록');
    expect(markup).toContain('cal-report-dot');
  });

  it('omits optional utility buttons when callbacks are absent', () => {
    const markup = render(
      <CalendarHeader
        hasNewReport={false}
        isScheduleInboxOpen={false}
        language="en"
        onChangeView={() => undefined}
        onNext={() => undefined}
        onPrevious={() => undefined}
        onToday={() => undefined}
        title="September 2026"
        view="week"
      />,
    );

    expect(markup).toContain('September 2026');
    expect(markup).toContain('Week');
    expect(markup).toContain('Month');
    expect(markup).not.toContain('cal-inbox-button');
    expect(markup).not.toContain('cal-report-button');
  });
});
