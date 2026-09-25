import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '../features/workspace/useWindowViewport.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

describe('window viewport lifecycle', () => {
  it('keeps the server-side width fallback in App', () => {
    expect(appSource).toContain(
      "typeof window === 'undefined' ? 1280 : window.innerWidth",
    );
  });

  it('updates width and marks the viewport as resizing on each resize', () => {
    expect(source).toContain('setWindowWidth(window.innerWidth);');
    expect(source).toContain('setWindowResizing(true);');
  });

  it('clears the resizing state 180ms after the latest event', () => {
    expect(source).toContain(
      'window.setTimeout(() => setWindowResizing(false), 180)',
    );
  });

  it('cleans up the timer and resize listener on unmount', () => {
    expect(source).toContain('window.clearTimeout(idleTimer);');
    expect(source).toContain(
      "window.removeEventListener('resize', update);",
    );
  });

  it('keeps App shell connected to the extracted lifecycle state', () => {
    expect(appSource).toContain(
      'const { isWindowResizing } = useWindowViewport({ setWindowWidth });',
    );
    expect(appSource).toContain('    isWindowResizing,');
  });
});
