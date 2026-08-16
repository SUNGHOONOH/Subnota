import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveMemoSavePresentation } from '../lib/memoSaveStatus';
import type { MemoRow } from '../types';

const workspace = readFileSync(
  resolve(__dirname, '../features/memo/components/MemoSplitWorkspace.tsx'),
  'utf8',
);

const memo = (localSyncStatus: MemoRow['local_sync_status']): MemoRow => ({
  category: 'general',
  content: '내용',
  content_hash: 'hash',
  created_at: '2026-08-11T00:00:00.000Z',
  id: 'memo-1',
  is_archived: false,
  local_sync_status: localSyncStatus,
  updated_at: '2026-08-11T00:00:00.000Z',
});

describe('memo save presentation', () => {
  it('hides automatic successful saves while preserving save failures', () => {
    expect(workspace).toContain('const showSaveIssue =');
    expect(workspace).toContain("memo.local_sync_status === 'failed'");
    expect(workspace).toMatch(
      /\{showSaveIssue && \([\s\S]*?className="split-note-save-status"/,
    );
    expect(workspace).not.toContain("{savePresentation?.text ?? '새 노트'}");
  });

  it('never calls an in-flight local write saved', () => {
    expect(
      resolveMemoSavePresentation(memo('pending'), 'saving-local'),
    ).toEqual({ label: '로컬에 저장 중', text: '… 저장 중' });
  });

  it('surfaces a terminal local database failure', () => {
    expect(
      resolveMemoSavePresentation(memo('pending'), 'local-failed'),
    ).toEqual({ label: '로컬 저장 실패', text: '! 로컬 저장 실패' });
  });

  it('keeps cloud synchronization states after the local write succeeds', () => {
    expect(resolveMemoSavePresentation(memo('synced'))).toEqual({
      label: '클라우드에 동기화됨',
      text: '☁︎ 저장됨',
    });
    expect(resolveMemoSavePresentation(memo('failed'))).toEqual({
      label: '로컬에 저장됨 · 동기화 실패',
      text: '! 저장됨 · 동기화 실패',
    });
    expect(resolveMemoSavePresentation(memo('pending'))).toEqual({
      label: '로컬에 저장됨',
      text: '✓ 저장됨',
    });
  });
});
