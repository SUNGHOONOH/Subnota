import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
const hookSource = readFileSync(
  resolve(__dirname, '../features/settings/useDesktopPreferences.ts'),
  'utf8',
);

describe('desktop preferences lifecycle boundary', () => {
  it('keeps Electron preference and storage reads inside the Settings feature', () => {
    expect(appSource).toContain(
      "import { useDesktopPreferences } from './features/settings/useDesktopPreferences';",
    );
    expect(appSource).toContain('} = useDesktopPreferences();');
    expect(appSource).not.toContain('window.electronAPI.getDesktopPreferences()');
    expect(appSource).not.toContain('window.electronAPI.getLocalStorageInfo()');
  });

  it('loads both values together only when the Electron bridges exist', () => {
    expect(hookSource).toContain('!window.electronAPI?.getDesktopPreferences');
    expect(hookSource).toContain('!window.electronAPI?.getLocalStorageInfo');
    expect(hookSource).toContain('Promise.all([');
    expect(hookSource).toContain('setDesktopPreferences(preferences);');
    expect(hookSource).toContain('setStorageInfo(info);');
  });

  it('updates state only after an explicit preference or storage action', () => {
    expect(appSource).toContain('onChooseStorage: chooseLocalStorage');
    expect(appSource).toContain(
      'onDesktopPreferencesChange: updateDesktopPreferences',
    );
    expect(appSource).toContain('onOpenStorage: openLocalStorage');
    expect(hookSource).toContain('if (info) setStorageInfo(info);');
  });
});
