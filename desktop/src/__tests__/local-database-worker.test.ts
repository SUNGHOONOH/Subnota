import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the most recently constructed worker so tests can drive its events.
class MockWorker {
  static last: MockWorker | null = null;
  handlers: Record<string, (arg?: unknown) => void> = {};
  postMessage = vi.fn();
  terminate = vi.fn(() => Promise.resolve(0));
  constructor() {
    MockWorker.last = this;
  }
  on(event: string, cb: (arg?: unknown) => void) {
    this.handlers[event] = cb;
    return this;
  }
  emit(event: string, arg?: unknown) {
    this.handlers[event]?.(arg);
  }
}

const appHandlers: Record<string, (...args: unknown[]) => void> = {};
const ipcHandlers: Record<string, (event: unknown, ...args: unknown[]) => unknown> = {};

vi.mock('node:worker_threads', () => ({ Worker: MockWorker }));
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/tmp',
    quit: vi.fn(),
    on: (event: string, cb: (...args: unknown[]) => void) => {
      appHandlers[event] = cb;
    },
  },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, ...args: unknown[]) => unknown) => {
      ipcHandlers[channel] = fn;
    },
  },
}));

// Importing the module registers the ipcMain handlers and the before-quit hook.
await import('../local-database');

const trustedEvent = {
  senderFrame: { url: '' },
  sender: { id: 1, getURL: () => '', once: vi.fn() },
};

const list = () =>
  ipcHandlers['local-db:list'](trustedEvent, 'guest', 'memo') as Promise<unknown>;

describe('local-database worker reliability', () => {
  beforeEach(() => {
    MockWorker.last = null;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects pending operations when the worker exits unexpectedly', async () => {
    const promise = list();
    const expectation = expect(promise).rejects.toThrow(/exit/i);
    const created = MockWorker.last;
    if (!created) throw new Error('worker was not created');
    created.emit('exit', 1);
    await expectation;
  });

  it('rejects a pending operation that never receives a response (timeout)', async () => {
    vi.useFakeTimers();
    const promise = list();
    const expectation = expect(promise).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(60_000);
    await expectation;
  });
});
