import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerReconnectSync } from '../lib/reconnectSync';

class FakeTarget {
  listeners: Record<string, Set<() => void>> = {};
  addEventListener(type: string, cb: () => void) {
    (this.listeners[type] ??= new Set()).add(cb);
  }
  removeEventListener(type: string, cb: () => void) {
    this.listeners[type]?.delete(cb);
  }
  dispatch(type: string) {
    for (const cb of [...(this.listeners[type] ?? [])]) cb();
  }
  count(type: string) {
    return this.listeners[type]?.size ?? 0;
  }
}

const setup = (online = true, visibilityState = 'visible') => {
  const win = new FakeTarget();
  const doc = Object.assign(new FakeTarget(), { visibilityState });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', { onLine: online });
  return { win, doc };
};

afterEach(() => vi.unstubAllGlobals());

describe('registerReconnectSync', () => {
  it('drains when the connection returns (online event)', () => {
    const { win } = setup();
    const drain = vi.fn(() => Promise.resolve());
    registerReconnectSync(drain);
    win.dispatch('online');
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it('drains when the window becomes visible again', () => {
    const { doc } = setup(true, 'visible');
    const drain = vi.fn(() => Promise.resolve());
    registerReconnectSync(drain);
    doc.dispatch('visibilitychange');
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it('does not drain while offline', () => {
    const { win } = setup(false);
    const drain = vi.fn(() => Promise.resolve());
    registerReconnectSync(drain);
    win.dispatch('online');
    expect(drain).not.toHaveBeenCalled();
  });

  it('does not stack a second drain while one is in flight', async () => {
    const { win } = setup();
    let resolveDrain!: () => void;
    const drain = vi.fn(() => new Promise<void>(resolve => { resolveDrain = resolve; }));
    registerReconnectSync(drain);
    win.dispatch('online');
    win.dispatch('online');
    expect(drain).toHaveBeenCalledTimes(1);
    resolveDrain();
    await Promise.resolve();
    win.dispatch('online');
    expect(drain).toHaveBeenCalledTimes(2);
  });

  it('removes its listeners on cleanup', () => {
    const { win, doc } = setup();
    const drain = vi.fn(() => Promise.resolve());
    const cleanup = registerReconnectSync(drain);
    cleanup();
    expect(win.count('online')).toBe(0);
    expect(doc.count('visibilitychange')).toBe(0);
    win.dispatch('online');
    expect(drain).not.toHaveBeenCalled();
  });
});
