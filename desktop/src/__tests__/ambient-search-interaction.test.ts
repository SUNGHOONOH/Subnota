import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(__dirname, '..', 'features/search/useAmbientSearchInteraction.ts'),
  'utf8',
);
const appSource = readFileSync(resolve(__dirname, '..', 'App.tsx'), 'utf8');

describe('ambient search interaction boundary', () => {
  it('keeps App with the ambient interaction hook wiring', () => {
    expect(appSource).toContain(
      "import { useAmbientSearchInteraction } from './features/search/useAmbientSearchInteraction';",
    );
    expect(appSource).toContain('useAmbientSearchInteraction({');
    expect(appSource).not.toContain('const runAmbientSearchNow = (manualTarget?: AmbientSearchTarget) =>');
  });

  it('normalizes ambient query context and clears short targets', () => {
    expect(source).toContain('const trimmedQueryText = queryText.trim();');
    expect(source).toContain('trimmedQueryText.length < AMBIENT_MIN_CHARS');
    expect(source).toContain('previous && previous.editorId === editorId ? null : previous');
  });

  it('keeps manual progress notices and minimum visible duration', () => {
    expect(source).toContain('showManualAmbientSearchNotice');
    expect(source).toContain('MANUAL_AMBIENT_SEARCH_NOTICE_MIN_MS = 700');
    expect(source).toContain('finishManualAmbientSearchNotice');
    expect(source).toContain('setManualAmbientSearchNotice(null);');
  });

  it('preserves latest-target cancellation and mode-aware search execution', () => {
    expect(source).toContain('ambientRunnerRef.current.cancel();');
    expect(source).toContain('if (!indexed || !isCurrentAmbientTarget(target))');
    expect(source).toContain("mode: manualTarget ? 'manual' : 'auto'");
    expect(source).toContain('manualAmbientTargetRef.current = manualTarget;');
  });

  it('keeps automatic search behind the existing focus/session/settings gate', () => {
    expect(source).toContain('canRunAmbientAutoSearch({');
    expect(source).toContain('document.hasFocus()');
    expect(source).toContain('document.hidden');
    expect(source).toContain('ambientRunnerRef.current.run(ambientTarget, ambientSearchHandlers);');
  });

  it('cleans transient timers and runner state on unmount', () => {
    expect(source).toContain('ambientEmptyNoticeTimerRef.current');
    expect(source).toContain('manualAmbientSearchNoticeTimerRef.current');
    expect(source).toContain('ambientRunnerRef.current.cancel();');
  });
});
