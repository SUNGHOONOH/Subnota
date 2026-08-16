import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const calendarSource = readFileSync(
  resolve(__dirname, '../features/calendar/CalendarWorkspace.tsx'),
  'utf8',
);
const settingsSource = readFileSync(
  resolve(__dirname, '../features/settings/SettingsModal.tsx'),
  'utf8',
);
const settingsCss = settingsSource.slice(
  settingsSource.indexOf('const SETTINGS_CSS'),
);
const styles = readFileSync(
  resolve(__dirname, '../styles/subnota-workspace.scss'),
  'utf8',
);

describe('desktop control density', () => {
  it('uses the compact tier for text actions while retaining separate icon tiers', () => {
    expect(styles).toContain('--control-size-compact: 24px');
    expect(styles).toContain('--control-icon-compact: 14px');
    expect(styles).toMatch(
      /\.ghost-button,[\s\S]*?\.link-button\s*\{[\s\S]*?font-size:\s*var\(--control-font-compact\)[\s\S]*?min-height:\s*var\(--control-size-compact\)/,
    );
    expect(settingsCss).toContain('--settings-control-height: 28px');
    expect(settingsCss).toMatch(
      /\.settings-reference-save\.mantine-Button-root,[\s\S]*?height:\s*var\(--settings-control-height\)/,
    );
  });

  it('keeps shortcut editing progressive: a compact keycap, one edit action, and saved-value undo', () => {
    expect(settingsSource).toContain('settings-reference-shortcut-value');
    expect(settingsSource).toContain('settings-reference-shortcut-record');
    expect(settingsSource).toContain('settings-reference-shortcut-cancel');
    expect(settingsSource).toContain('단축키를 누르세요');
    expect(settingsSource).toContain('<PencilIcon />');
    expect(settingsSource).toContain('<ArrowUturnLeftIcon />');
    expect(settingsSource).toContain('저장된 단축키로 되돌리기');
  });

  it('uses direct dimensions instead of a transformed reference layout', () => {
    expect(settingsCss).toContain('transform: none');
    expect(settingsCss).toContain('height: min(660px, calc(100dvh - 48px))');
    expect(settingsCss).toContain('@media (max-width: 640px)');
  });

  it('keeps calendar navigation compact and visually grouped', () => {
    expect(calendarSource).toContain(
      'aria-label="캘린더 보기" className="cal-views" role="group"',
    );
    expect(calendarSource).toContain('aria-pressed={view === key}');
    expect(calendarSource).toContain(
      'aria-label="캘린더 이동" className="cal-nav" role="group"',
    );
    expect(styles).toMatch(
      /\.cal-nav\s*\{[^}]*background:\s*var\(--legacy-bg-pressed\)[^}]*gap:\s*0[^}]*padding:\s*2px/,
    );
    expect(styles).toMatch(
      /\.cal-nav-icon\s*\{[^}]*height:\s*var\(--control-size-compact\)/,
    );
    expect(styles).not.toContain('min-width: 42px;');
  });

  it('uses the standard tier for split-pane header actions', () => {
    expect(styles).toMatch(
      /\.split-editor-tab-add\s*\{[\s\S]*?height:\s*var\(--control-size-standard\)[\s\S]*?width:\s*var\(--control-size-standard\)/,
    );
    expect(styles).toMatch(
      /\.split-action-btn\s*\{[\s\S]*?height:\s*var\(--control-size-standard\)[\s\S]*?width:\s*var\(--control-size-standard\)/,
    );
  });

  it('uses the standard tier for calendar utility icons', () => {
    expect(styles).toMatch(
      /\.cal-inbox-button\s*\{[\s\S]*?height:\s*var\(--control-size-standard\)/,
    );
    expect(styles).toMatch(
      /\.cal-report-button\s*\{[\s\S]*?height:\s*var\(--control-size-standard\)/,
    );
  });
});
