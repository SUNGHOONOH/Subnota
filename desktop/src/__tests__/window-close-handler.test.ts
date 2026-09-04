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

  // Windows 트레이 안내는 창을 숨기기 **전에** 떠야 한다. 이미 숨긴 뒤에는
  // 무엇을 그려도 사용자가 볼 수 없다.
  it('keeps the window visible while something intercepts the hide', () => {
    const window = createMockWindow();
    attachCloseHandler(window as never, {
      interceptHide: () => true,
      shouldHideOnClose: () => true,
    });

    const event = window.fireClose();

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(window.hide).not.toHaveBeenCalled();
  });

  // 안내는 한 번뿐이다. 두 번째 닫기부터는 그대로 숨어야 한다.
  it('hides normally once nothing intercepts any more', () => {
    const window = createMockWindow();
    let intercepts = true;
    attachCloseHandler(window as never, {
      interceptHide: () => {
        const result = intercepts;
        intercepts = false;
        return result;
      },
      shouldHideOnClose: () => true,
    });

    window.fireClose();
    expect(window.hide).not.toHaveBeenCalled();

    window.fireClose();
    expect(window.hide).toHaveBeenCalledOnce();
  });
});
