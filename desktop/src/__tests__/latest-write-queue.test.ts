import { describe, expect, it, vi } from 'vitest';

import { createLatestWriteQueue } from '../lib/latestWriteQueue';

describe('latest write queue', () => {
  it('retries a transient failure without asking the caller to retry', async () => {
    vi.useFakeTimers();
    const write = vi
      .fn<(value: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error('SQLite busy'))
      .mockResolvedValue(undefined);
    const queue = createLatestWriteQueue({
      retryDelay: () => 10,
      write,
    });

    const persisted = queue.enqueue('memo-1', '최신 내용');
    await vi.advanceTimersByTimeAsync(10);
    await persisted;

    expect(write).toHaveBeenNthCalledWith(1, '최신 내용');
    expect(write).toHaveBeenNthCalledWith(2, '최신 내용');
    vi.useRealTimers();
  });

  it('rejects a permanent failure after the retry budget is exhausted', async () => {
    vi.useFakeTimers();
    const failure = new Error('database or disk is full');
    const write = vi.fn<(value: string) => Promise<void>>().mockRejectedValue(failure);
    const queue = createLatestWriteQueue({
      maxAttempts: 3,
      retryDelay: () => 10,
      write,
    });

    const persisted = queue.enqueue('memo-1', '저장되지 못한 내용');
    const rejection = expect(persisted).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(20);

    await rejection;
    expect(write).toHaveBeenCalledTimes(3);
    // A later drain retries the retained latest value, so recovery does not
    // require the user to alter already-entered text just to enqueue it again.
    write.mockResolvedValue(undefined);
    await expect(queue.drain()).resolves.toBeUndefined();
    expect(write).toHaveBeenLastCalledWith('저장되지 못한 내용');
    vi.useRealTimers();
  });

  it('coalesces pending writes and never persists an older value after the latest one', async () => {
    let releaseFirstWrite: (() => void) | null = null;
    const writes: string[] = [];
    const write = vi.fn(async (value: string) => {
      writes.push(value);
      if (writes.length === 1) {
        await new Promise<void>(resolve => {
          releaseFirstWrite = resolve;
        });
      }
    });
    const queue = createLatestWriteQueue({ write });

    const first = queue.enqueue('memo-1', '중간 내용');
    const latest = queue.enqueue('memo-1', '최종 내용');
    releaseFirstWrite?.();
    await Promise.all([first, latest]);

    expect(writes).toEqual(['중간 내용', '최종 내용']);
  });

  it('keeps each drain retry bounded while storage remains unavailable', async () => {
    vi.useFakeTimers();
    const failure = new Error('disk unavailable');
    const write = vi.fn<(value: string) => Promise<void>>().mockRejectedValue(failure);
    const queue = createLatestWriteQueue({
      maxAttempts: 2,
      retryDelay: () => 10,
      write,
    });

    const first = expect(queue.enqueue('memo-1', '최신 내용')).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(10);
    await first;

    const retriedDrain = expect(queue.drain()).rejects.toBe(failure);
    await vi.advanceTimersByTimeAsync(10);
    await retriedDrain;
    expect(write).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it('does not back off and replay errors declared non-retryable', async () => {
    const maintenance = new Error('database maintenance');
    const write = vi
      .fn<(value: string) => Promise<void>>()
      .mockRejectedValueOnce(maintenance)
      .mockResolvedValue(undefined);
    const queue = createLatestWriteQueue({
      shouldRetry: error => error !== maintenance,
      write,
    });

    await expect(queue.enqueue('memo-1', '복원 전 내용')).rejects.toBe(
      maintenance,
    );
    expect(write).toHaveBeenCalledOnce();

    await expect(queue.drain()).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('drains writes that are still in flight', async () => {
    let releaseWrite: (() => void) | null = null;
    const queue = createLatestWriteQueue({
      write: () =>
        new Promise<void>(resolve => {
          releaseWrite = resolve;
        }),
    });
    let drained = false;

    void queue.enqueue('memo-1', '최신 내용');
    const pendingDrain = queue.drain().then(() => {
      drained = true;
    });
    await Promise.resolve();

    expect(drained).toBe(false);
    releaseWrite?.();
    await pendingDrain;
    expect(drained).toBe(true);
  });

  it('also drains a new key enqueued after draining starts', async () => {
    const releases = new Map<string, () => void>();
    const queue = createLatestWriteQueue({
      write: value =>
        new Promise<void>(resolve => {
          releases.set(value, resolve);
        }),
    });
    let drained = false;

    const first = queue.enqueue('memo-1', '첫 번째');
    const pendingDrain = queue.drain().then(() => {
      drained = true;
    });
    const second = queue.enqueue('memo-2', '두 번째');
    releases.get('첫 번째')?.();
    await first;

    expect(drained).toBe(false);
    releases.get('두 번째')?.();
    await Promise.all([second, pendingDrain]);
    expect(drained).toBe(true);
  });
});
