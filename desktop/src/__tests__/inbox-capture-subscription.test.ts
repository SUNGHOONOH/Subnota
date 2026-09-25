import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/inbox/useInboxCaptureSubscription.ts'),
  'utf8',
);

describe('Inbox Electron capture subscription boundary', () => {
  it('keeps the main-process inbox capture listener in the Inbox feature', () => {
    expect(source).toContain('window.electronAPI?.onInboxCapture?.');
    expect(source).toContain('notifyClipSaved(');
    expect(source).toContain('notifyClipFailed(');
  });

  it('installs one listener while using refs for the latest callbacks', () => {
    expect(source).toContain('saveInboxUrlRef.current(url)');
    expect(source).toContain('onOpenInboxRef.current()');
    expect(source).toContain('onCaptureErrorRef.current(payload.error)');
    expect(source).toMatch(/\}, \[\]\);/);
  });

  it('keeps invalid capture payloads out of the save path', () => {
    expect(source).toContain('if (payload.error)');
    expect(source).toContain('if (!payload.url)');
  });
});
