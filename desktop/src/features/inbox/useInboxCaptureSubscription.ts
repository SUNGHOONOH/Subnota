import { useEffect, useRef } from 'react';

import type { InboxSummaryStatus } from '../../services/backend/inboxService';
import { notifyClipFailed, notifyClipSaved } from '../../lib/clipNotification';

interface InboxCapturePayload {
  error?: string;
  title?: string;
  url?: string;
}

type SaveInboxUrl = (
  url: string,
) => Promise<{ error?: string; summaryStatus?: InboxSummaryStatus }>;

interface UseInboxCaptureSubscriptionOptions {
  onCaptureError: (message: string) => void;
  onOpenInbox: () => void;
  saveInboxUrl: SaveInboxUrl;
}

/**
 * 메뉴바·전역 단축키·capture deep link로 들어오는 웹 캡처를 수집함으로
 * 연결한다. 저장 함수와 탭 이동 함수는 렌더마다 바뀔 수 있으므로, 구독은
 * 한 번만 설치하고 ref로 최신 callback을 사용한다.
 */
export const useInboxCaptureSubscription = ({
  onCaptureError,
  onOpenInbox,
  saveInboxUrl,
}: UseInboxCaptureSubscriptionOptions) => {
  const saveInboxUrlRef = useRef(saveInboxUrl);
  saveInboxUrlRef.current = saveInboxUrl;
  const onOpenInboxRef = useRef(onOpenInbox);
  onOpenInboxRef.current = onOpenInbox;
  const onCaptureErrorRef = useRef(onCaptureError);
  onCaptureErrorRef.current = onCaptureError;

  useEffect(() => {
    return window.electronAPI?.onInboxCapture?.((payload: InboxCapturePayload) => {
      if (payload.error) {
        onCaptureErrorRef.current(payload.error);
        notifyClipFailed(payload.error);
        return;
      }
      if (!payload.url) {
        return;
      }
      const url = payload.url;
      void saveInboxUrlRef.current(url).then((result) => {
        if (result.error) {
          notifyClipFailed(result.error);
          return;
        }
        notifyClipSaved(
          payload.title || url,
          () => onOpenInboxRef.current(),
          result.summaryStatus,
        );
      });
    });
  }, []);
};
