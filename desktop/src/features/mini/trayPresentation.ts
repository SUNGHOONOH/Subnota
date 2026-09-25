import { normalizeWebUrl } from '../../lib/url-policy';

export type RecentInboxSummaryStatus =
  | 'pending'
  | 'ready'
  | 'partial'
  | 'unsupported'
  | 'failed';

export interface RecentInboxItem {
  summaryStatus?: RecentInboxSummaryStatus;
  title: string;
  url: string;
  sourceLabel: string;
}

export type TrayUiLanguage = 'en' | 'ko';
export type TrayTranslate = (korean: string, english: string) => string;

export const RECENT_INBOX_STATUSES = new Set<RecentInboxSummaryStatus>([
  'pending',
  'ready',
  'partial',
  'unsupported',
  'failed',
]);

export const normalizeRecentInboxItem = (value: unknown): RecentInboxItem | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<RecentInboxItem>;
  const url = normalizeWebUrl(item.url);
  if (!url || typeof item.title !== 'string' || typeof item.sourceLabel !== 'string') {
    return null;
  }
  const summaryStatus = item.summaryStatus;
  if (summaryStatus !== undefined && !RECENT_INBOX_STATUSES.has(summaryStatus)) {
    return null;
  }
  return {
    sourceLabel: item.sourceLabel.trim().slice(0, 100) || '링크',
    summaryStatus,
    title: item.title.trim().slice(0, 500) || url,
    url,
  };
};

export const getInboxSaveStatusMessage = (
  item: RecentInboxItem,
  translate: TrayTranslate,
) => {
  if (item.summaryStatus === 'partial') {
    return translate(
      '링크와 메타데이터를 저장했습니다. 본문 요약은 제한적입니다.',
      'Link and metadata saved. The page summary is limited.',
    );
  }
  if (item.summaryStatus === 'failed' || item.summaryStatus === 'unsupported') {
    return translate(
      '링크는 저장했습니다. 요약은 생성하지 못했습니다.',
      'Link saved, but a summary could not be created.',
    );
  }
  if (item.summaryStatus === 'pending') {
    return translate(
      '링크를 저장했습니다. 요약을 준비 중입니다.',
      'Link saved. Preparing its summary.',
    );
  }
  return translate('링크 저장함에 저장됨', 'Saved to Inbox');
};

export const getCaptureFailureMessage = (
  message: string,
  language: TrayUiLanguage,
) => {
  if (language !== 'en') return message;
  if (message.startsWith('지원하는 브라우저의 현재 페이지를 찾지 못했습니다.')) {
    return 'Could not find the current page in a supported browser. Try Safari, Chrome, Arc, Edge, or Brave.';
  }
  if (message.startsWith('브라우저 정보를 가져오지 못했습니다')) {
    return 'Could not read the browser information.';
  }
  if (message === '현재 페이지 저장은 macOS에서만 지원됩니다.') {
    return 'Saving the current page is available on macOS only.';
  }
  if (message === '웹페이지 주소만 저장할 수 있습니다. 브라우저 내부 페이지나 로컬 파일은 지원하지 않습니다.') {
    return 'Only web page addresses can be saved. Browser-internal pages and local files are not supported.';
  }
  return message;
};

export const truncateLabel = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
};
