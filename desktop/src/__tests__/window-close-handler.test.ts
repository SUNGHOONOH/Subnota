import { describe, expect, it, vi } from 'vitest';

import { attachCloseHandler } from '../window-close-handler';

function createMockWindow() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    hide: vi.fn(),
    on(event: string, fn: (...args: unknown[]) => void) {
      (listeners[event] ??= []).push(fn);
    },
    fireClose() {
      const event = { preventDefault: vi.fn() };
      listeners.close?.forEach(listener => listener(event));
      return event;
    },
  };
}

describe('attachCloseHandler', () => {
  it('lets the window close when tray mode is disabled', () => {
    const window = createMockWindow();
    attachCloseHandler(window as never);

    const event = window.fireClose();

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(window.hide).not.toHaveBeenCalled();
  });

  it('hides the window instead of closing in tray mode', () => {
    const window = createMockWindow();
    attachCloseHandler(window as never, { shouldHideOnClose: () => true });

    const event = window.fireClose();

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(window.hide).toHaveBeenCalledOnce();
  });
});
