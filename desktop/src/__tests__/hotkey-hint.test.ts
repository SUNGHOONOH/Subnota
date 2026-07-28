import { describe, expect, it } from 'vitest';

import {
  APP_SHORTCUT_FIELDS,
  DEFAULT_APP_SHORTCUT_SETTINGS,
  APP_SHORTCUT_LABELS,
  findShortcutConflictsForFields,
  formatHotkeyHint,
  normalizeAppShortcutSettings,
} from '../lib/shortcutSettings';

describe('formatHotkeyHint', () => {
  it('macOS는 기호로, 그 외는 글자로 보여준다', () => {
    expect(formatHotkeyHint('CommandOrControl+Enter', true)).toBe('⌘↩');
    expect(formatHotkeyHint('CommandOrControl+Enter', false)).toBe('Ctrl↩');
    expect(formatHotkeyHint('CommandOrControl+Shift+Enter', true)).toBe('⌘⇧↩');
    expect(formatHotkeyHint('CommandOrControl+Alt+Left', false)).toBe('CtrlAltLeft');
  });

  it('값이 없으면 빈 문자열', () => {
    expect(formatHotkeyHint(null)).toBe('');
    expect(formatHotkeyHint(undefined)).toBe('');
    expect(formatHotkeyHint('')).toBe('');
  });
});

describe('ambient 단축키 등록', () => {
  it('설정 화면에 노출되도록 필드·라벨이 함께 등록돼 있다', () => {
    expect(APP_SHORTCUT_FIELDS).toContain('openAmbientDetail');
    expect(APP_SHORTCUT_FIELDS).toContain('openAmbientList');
    expect(APP_SHORTCUT_LABELS.openAmbientDetail).toBeTruthy();
    expect(APP_SHORTCUT_LABELS.openAmbientList).toBeTruthy();
  });

  // 저장된 설정에 새 키가 없던 사용자도 기본값을 받아야 한다.
  it('기존 저장값에 없던 키는 기본값으로 채워진다', () => {
    const migrated = normalizeAppShortcutSettings({ createMemo: 'CommandOrControl+M' });
    expect(migrated.openAmbientDetail).toBe(
      DEFAULT_APP_SHORTCUT_SETTINGS.openAmbientDetail,
    );
    expect(migrated.openAmbientList).toBe(
      DEFAULT_APP_SHORTCUT_SETTINGS.openAmbientList,
    );
  });

  // 새 단축키가 기존 8개 중 무엇과도 겹치면 안 된다. Mod+Enter와
  // Mod+Shift+Enter는 수식자가 달라 서로도 충돌하지 않는다.
  it('기본값 전체에 충돌이 없다', () => {
    expect(
      findShortcutConflictsForFields(DEFAULT_APP_SHORTCUT_SETTINGS, {
        fields: APP_SHORTCUT_FIELDS,
        labels: APP_SHORTCUT_LABELS,
      }),
    ).toEqual({});
  });
});
