import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/memo/components/MemoSplitScheduleOverlay.tsx'),
  'utf8',
);
const workspaceSource = readFileSync(
  resolve(__dirname, '../features/memo/components/MemoSplitWorkspace.tsx'),
  'utf8',
);

describe('MemoSplitScheduleOverlay', () => {
  it('owns the date picker condition and preserves its existing class names', () => {
    expect(source).toContain('openDatePickerEditorId === editor.id');
    expect(source).toContain('date-schedule-floating');
    expect(source).toContain('split-date-schedule-floating');
    expect(source).toContain('confirmLabel={confirmLabel}');
    expect(source).toContain('initialDate={datePickerSeed ?? undefined}');
  });

  it('keeps the portal guard and confirmation placement in the extracted unit', () => {
    expect(source).toContain("typeof document !== 'undefined'");
    expect(source).toContain('schedule-confirm-floating');
    expect(source).toContain('scheduleConfirm.anchor.width / 2');
    expect(source).toContain('document.body');
    expect(source).toContain('onChangeDate={() => onChangeDate(editor)}');
    expect(source).toContain('onConfirm={() => onConfirm(editor)}');
  });

  it('leaves persistence handlers in the workspace and wires the extracted unit once', () => {
    expect(workspaceSource).toContain('const registerEditorSchedule =');
    expect(workspaceSource).toContain('const commitScheduleConfirm =');
    expect(workspaceSource).toContain('const openPickerFromConfirm =');
    expect(workspaceSource).toContain('const applyEditorDate =');
    expect(workspaceSource).toContain('<MemoSplitScheduleOverlay');
    expect(workspaceSource).not.toContain('createPortal(');
  });
});
