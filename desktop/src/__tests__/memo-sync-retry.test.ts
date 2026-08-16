import { describe, expect, it } from 'vitest';
import { memoSyncRetryDelay } from '../lib/memoSyncRetry';

describe('memoSyncRetryDelay', () => {
  it('backs off failed uploads and caps retries at five minutes', () => {
    expect(memoSyncRetryDelay(1)).toBe(1_000);
    expect(memoSyncRetryDelay(2)).toBe(5_000);
    expect(memoSyncRetryDelay(3)).toBe(15_000);
    expect(memoSyncRetryDelay(4)).toBe(60_000);
    expect(memoSyncRetryDelay(5)).toBe(300_000);
    expect(memoSyncRetryDelay(99)).toBe(300_000);
  });
});
