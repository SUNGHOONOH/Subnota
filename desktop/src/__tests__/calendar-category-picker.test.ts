import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CALENDAR_COLOR_PRESETS,
  DEFAULT_CALENDAR_COLOR,
} from '../features/calendar/calendarCategories';

const calendarSource = readFileSync(
  resolve(__dirname, '../features/calendar/CalendarWorkspace.tsx'),
  'utf8',
);
const styles = readFileSync(
  resolve(__dirname, '../styles/subnota-workspace.scss'),
  'utf8',
);

describe('calendar category picker', () => {
  it('starts with the calendar default and six category colors', () => {
    expect(DEFAULT_CALENDAR_COLOR).toBe('#66705A');
    expect(CALENDAR_COLOR_PRESETS).toHaveLength(6);
    expect(CALENDAR_COLOR_PRESETS.map(({ color }) => color)).toEqual([
      '#66705A',
      '#2E8FE5',
      '#7650E6',
      '#E24782',
      '#FF5357',
      '#FFB31A',
    ]);
  });

  it('dismisses the picker outside its boundary and uses a compact custom-color icon', () => {
    expect(calendarSource).toContain(
      "document.addEventListener('pointerdown', dismissMenu)",
    );
    expect(calendarSource).toContain('ref={categoryPickerRef}');
    expect(calendarSource).toContain("from '@mantine/core'");
    expect(calendarSource).toContain('<ColorPicker');
    expect(calendarSource).toContain('format="hex"');
    expect(calendarSource).toContain('withinPortal={false}');
    expect(calendarSource).not.toContain('type="color"');
    expect(calendarSource).toMatch(
      /aria-label=\{t\(\s*'선택한 색상 미리보기'/,
    );
    expect(calendarSource).toMatch(
      /aria-label=\{t\(\s*'선택한 RGBA 색상'/,
    );
    expect(calendarSource).toContain('className="cal-category-color-confirm"');
    expect(styles).toMatch(
      /\.cal-category-name-input\s*\{[\s\S]*?font-size:\s*14px/,
    );
    expect(styles).toMatch(
      /\.cal-category-custom-swatch::before\s*\{[\s\S]*?conic-gradient/,
    );
  });
});
