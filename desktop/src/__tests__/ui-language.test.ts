import { afterEach, describe, expect, it, vi } from 'vitest';

import { getUiDateLocale, getUiNumericDateOrder } from '../lib/uiLanguage';

describe('device-region date conventions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the device region for English UK dates', () => {
    vi.stubGlobal('navigator', {
      language: 'en-GB',
      languages: ['en-GB'],
    });

    expect(getUiDateLocale('en')).toBe('en-GB');
    expect(getUiNumericDateOrder('en')).toBe('dmy');
  });

  it('keeps US month-day order', () => {
    vi.stubGlobal('navigator', {
      language: 'en-US',
      languages: ['en-US'],
    });

    expect(getUiNumericDateOrder('en')).toBe('mdy');
  });

  it('does not guess for locales whose numeric order is year-first', () => {
    vi.stubGlobal('navigator', {
      language: 'en-CA',
      languages: ['en-CA'],
    });

    expect(getUiDateLocale('en')).toBe('en-CA');
    expect(getUiNumericDateOrder('en')).toBe('ymd');
  });
});
