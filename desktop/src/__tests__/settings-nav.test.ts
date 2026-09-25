import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) =>
  readFileSync(resolve(__dirname, '..', path), 'utf8');

const navSource = read('features/settings/SettingsNav.tsx');
const modalSource = read('features/settings/SettingsModal.tsx');

describe('SettingsNav', () => {
  it('keeps the seven sections and their existing order', () => {
    const ids = ['general', 'appearance', 'sync', 'backup', 'hotkeys', 'account', 'about'];
    let previousIndex = -1;
    for (const id of ids) {
      const index = navSource.indexOf(`id: '${id}'`);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
    expect(navSource).toContain('export const SETTINGS_SECTIONS');
  });

  it('preserves the settings navigation chrome and active state contract', () => {
    expect(navSource).toContain('settings-reference-sidebar');
    expect(navSource).toContain('settings-reference-nav');
    expect(navSource).toContain('settings-reference-nav-button');
    expect(navSource).toContain('data-active={active === section.id ? \'\' : undefined}');
    expect(navSource).toContain('onClick={() => onSelect(section.id)}');
    expect(navSource).toContain("localize(language, '설정', 'Settings')");
  });

  it('leaves SettingsModal with state assembly and the extracted navigation only', () => {
    expect(modalSource).toContain('import SettingsNav, { SETTINGS_SECTIONS } from \'./SettingsNav\';');
    expect(modalSource).toContain('const [active, setActive] = useState(SETTINGS_SECTIONS[0].id);');
    expect(modalSource).toContain('<SettingsNav');
    expect(modalSource).not.toContain('function Nav(');
    expect(modalSource).not.toContain('const SECTIONS:');
  });
});
