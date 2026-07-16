import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: class MockBrowserWindow {},
  globalShortcut: {
    register: vi.fn(() => true),
    unregisterAll: vi.fn(),
  },
  screen: {
    getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
    getDisplayNearestPoint: vi.fn(() => ({
      workArea: { height: 900, width: 1440, x: 0, y: 0 },
    })),
  },
}));

import {
  getBrowserCaptureScript,
  parseBrowserPageOutput,
} from '../mini-subnota';

describe('Mini Subnota browser capture helpers', () => {
  it('keeps the legacy supported browser bundle IDs', () => {
    expect(getBrowserCaptureScript('com.apple.Safari')).toContain('Safari');
    expect(getBrowserCaptureScript('com.google.Chrome')).toContain('Google Chrome');
    expect(getBrowserCaptureScript('company.thebrowser.Browser')).toContain('Arc');
    expect(getBrowserCaptureScript('com.microsoft.edgemac')).toContain('Microsoft Edge');
    expect(getBrowserCaptureScript('com.brave.Browser')).toContain('Brave Browser');
    expect(getBrowserCaptureScript('com.unsupported.Browser')).toBeNull();
  });

  it('parses URL and title from osascript output', () => {
    expect(parseBrowserPageOutput('https://example.com\nExample title')).toEqual({
      title: 'Example title',
      url: 'https://example.com',
    });
  });

  it('returns an empty title when the browser only returns a URL', () => {
    expect(parseBrowserPageOutput('https://example.com')).toEqual({
      title: '',
      url: 'https://example.com',
    });
  });
});
