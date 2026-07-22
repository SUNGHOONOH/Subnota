import { describe, expect, it } from 'vitest';

import {
  normalizeStringArray,
  toValidDate,
} from '../lib/viewCrashGuards';

describe('view crash guards', () => {
  it('rejects invalid schedule dates before date-fns receives them', () => {
    expect(toValidDate('not-a-date')).toBeUndefined();
    expect(toValidDate(null)).toBeUndefined();
    expect(toValidDate('2026-07-18T12:00:00.000Z')).toBeInstanceOf(Date);
  });

  it('normalizes missing legacy inbox keywords to an empty array', () => {
    expect(normalizeStringArray(undefined)).toEqual([]);
    expect(normalizeStringArray(['one', null, 'two'])).toEqual(['one', 'two']);
  });
});
