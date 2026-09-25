import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/workspace/useBootLifecycle.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('boot lifecycle boundary', () => {
  it('keeps App with boot timing hook wiring only', () => {
    expect(appSource).toContain(
      "import { useBootLifecycle } from './features/workspace/useBootLifecycle';",
    );
    expect(appSource).toContain('useBootLifecycle({');
    expect(appSource).not.toContain('BOOT_FULLSCREEN_MAX_MS');
  });

  it('keeps the brand phase and hard upper bound timers', () => {
    expect(source).toContain('BOOT_BRAND_PHASE_MS');
    expect(source).toContain('BOOT_FULLSCREEN_MAX_MS');
    expect(source).toContain('setBootElapsedMs(Date.now() - startedAt)');
    expect(source).toMatch(
      /\(\) => setBooting\(false\),\s*BOOT_FULLSCREEN_MAX_MS/,
    );
  });

  it('hands off as soon as local workspace is ready after required motion', () => {
    expect(source).toContain(
      'if (!isBooting || !isLocalWorkspaceReady) return undefined;',
    );
    expect(source).toContain('resolveBootCloseDelayMs(');
    expect(source).toContain('bootMarkVariantRef.current === \'assemble\'');
  });

  it('cleans every timer when boot state changes or unmounts', () => {
    expect(source).toContain('window.clearTimeout(toShell);');
    expect(source).toContain('window.clearTimeout(cap);');
    expect(source).toContain('return () => window.clearTimeout(timer);');
  });

  it('uses two effects in stable order for phase timing and local handoff', () => {
    expect(source.match(/useEffect\(/g)).toHaveLength(2);
    expect(source).toContain('bootStartedAtRef,');
    expect(source).toContain('isLocalWorkspaceReady,');
  });
});
