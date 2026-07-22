import { describe, expect, it } from 'vitest';
import { decideMemoNavAction } from '../lib/memoNavAction';

describe('decideMemoNavAction', () => {
  it('creates a memo tab when no memo tab exists', () => {
    expect(
      decideMemoNavAction({ hasMemoTab: false, isMemoTabFocused: false }),
    ).toBe('create-new');
  });

  it('focuses the existing memo tab when it is not focused', () => {
    expect(
      decideMemoNavAction({ hasMemoTab: true, isMemoTabFocused: false }),
    ).toBe('focus-existing');
  });

  it('creates another memo tab when the memo tab is already focused', () => {
    expect(
      decideMemoNavAction({ hasMemoTab: true, isMemoTabFocused: true }),
    ).toBe('create-new');
  });
});
