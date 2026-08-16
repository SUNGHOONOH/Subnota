import { describe, expect, it } from 'vitest';

import { createKeyedMutationQueue } from '../lib/keyedMutationQueue';

describe('keyed mutation queue', () => {
  it('sends mutations for one record in user order and only accepts the latest result', async () => {
    let releaseFirst: (() => void) | null = null;
    const serverOrder: string[] = [];
    const accepted: string[] = [];
    const queue = createKeyedMutationQueue();

    const first = queue.enqueue('calendar-1', async ({ isLatest }) => {
      serverOrder.push('A:start');
      await new Promise<void>(resolve => {
        releaseFirst = resolve;
      });
      serverOrder.push('A:end');
      if (isLatest()) accepted.push('A');
    });
    const latest = queue.enqueue('calendar-1', async ({ isLatest }) => {
      serverOrder.push('B:start');
      if (isLatest()) accepted.push('B');
    });

    await Promise.resolve();
    expect(serverOrder).toEqual(['A:start']);
    releaseFirst?.();
    await Promise.all([first, latest]);

    expect(serverOrder).toEqual(['A:start', 'A:end', 'B:start']);
    expect(accepted).toEqual(['B']);
  });

  it('continues with the latest mutation after an earlier request fails', async () => {
    const queue = createKeyedMutationQueue();
    const events: string[] = [];

    const failed = queue.enqueue('calendar-1', async () => {
      events.push('save');
      throw new Error('offline');
    });
    const deleted = queue.enqueue('calendar-1', async ({ isLatest }) => {
      events.push('delete');
      expect(isLatest()).toBe(true);
    });

    await expect(failed).rejects.toThrow('offline');
    await deleted;
    expect(events).toEqual(['save', 'delete']);
  });

  it('does not serialize unrelated records behind each other', async () => {
    let releaseA: (() => void) | null = null;
    const events: string[] = [];
    const queue = createKeyedMutationQueue();

    const a = queue.enqueue('calendar-a', async () => {
      events.push('a');
      await new Promise<void>(resolve => {
        releaseA = resolve;
      });
    });
    const b = queue.enqueue('calendar-b', async () => {
      events.push('b');
    });

    await b;
    expect(events).toEqual(['a', 'b']);
    releaseA?.();
    await a;
  });
});
