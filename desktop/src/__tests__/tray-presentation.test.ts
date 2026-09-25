import { describe, expect, it } from 'vitest';

import {
  getCaptureFailureMessage,
  getInboxSaveStatusMessage,
  normalizeRecentInboxItem,
  truncateLabel,
} from '../features/mini/trayPresentation';

const translate = (korean: string, english: string) =>
  `${korean} | ${english}`;

describe('tray presentation rules', () => {
  it('normalizes valid recent Inbox items without changing the web URL policy', () => {
    expect(
      normalizeRecentInboxItem({
        sourceLabel: '  Chrome  ',
        summaryStatus: 'ready',
        title: '  Example  ',
        url: 'https://example.com/path',
      }),
    ).toEqual({
      sourceLabel: 'Chrome',
      summaryStatus: 'ready',
      title: 'Example',
      url: 'https://example.com/path',
    });
  });

  it('uses safe fallbacks and rejects invalid recent Inbox payloads', () => {
    expect(
      normalizeRecentInboxItem({
        sourceLabel: ' ',
        title: ' ',
        url: 'https://example.com',
      }),
    ).toEqual({
      sourceLabel: '링크',
      title: 'https://example.com/',
      url: 'https://example.com/',
    });
    expect(normalizeRecentInboxItem({ sourceLabel: 'Chrome', title: 'x', url: 'file:///x' })).toBeNull();
    expect(
      normalizeRecentInboxItem({
        sourceLabel: 'Chrome',
        summaryStatus: 'unknown',
        title: 'x',
        url: 'https://example.com',
      }),
    ).toBeNull();
  });

  it('keeps each summary status message in one translation boundary', () => {
    expect(
      getInboxSaveStatusMessage(
        { sourceLabel: 'Chrome', summaryStatus: 'partial', title: 'x', url: 'https://example.com' },
        translate,
      ),
    ).toContain('링크와 메타데이터를 저장했습니다. 본문 요약은 제한적입니다.');
    expect(
      getInboxSaveStatusMessage(
        { sourceLabel: 'Chrome', summaryStatus: 'failed', title: 'x', url: 'https://example.com' },
        translate,
      ),
    ).toContain('링크는 저장했습니다. 요약은 생성하지 못했습니다.');
    expect(
      getInboxSaveStatusMessage(
        { sourceLabel: 'Chrome', summaryStatus: 'pending', title: 'x', url: 'https://example.com' },
        translate,
      ),
    ).toContain('링크를 저장했습니다. 요약을 준비 중입니다.');
    expect(
      getInboxSaveStatusMessage(
        { sourceLabel: 'Chrome', summaryStatus: 'ready', title: 'x', url: 'https://example.com' },
        translate,
      ),
    ).toContain('링크 저장함에 저장됨');
  });

  it('localizes known capture failures only in English mode', () => {
    const korean = '지원하는 브라우저의 현재 페이지를 찾지 못했습니다. 다시 시도해 주세요.';
    expect(getCaptureFailureMessage(korean, 'ko')).toBe(korean);
    expect(getCaptureFailureMessage(korean, 'en')).toContain('Could not find the current page');
    expect(getCaptureFailureMessage('other failure', 'en')).toBe('other failure');
  });

  it('truncates labels with one visible ellipsis', () => {
    expect(truncateLabel('short', 10)).toBe('short');
    expect(truncateLabel('123456', 5)).toBe('1234…');
    expect(truncateLabel('123', 0)).toBe('…');
  });
});
