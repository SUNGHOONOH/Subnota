import { useCallback, type Dispatch, type SetStateAction } from 'react';

import type { UiLanguage } from '../../lib/appSettings';
import { localize } from '../../lib/uiLanguage';
import type { MemoRow } from '../../types';
import type { InboxSession } from '../../services/backend/inboxService';
import {
  scheduleLocalMemoIndexReconcile,
  type LocalMemoIndexProgress,
} from '../../services/local/localMemoIndexer';
import { scheduleLocalInboxIndexReconcile } from '../../services/local/localInboxIndexer';

interface UseEmbeddingModelDownloadOptions {
  getCurrentOwnerId: () => string | null;
  getInboxItems: () => InboxSession[];
  getIndexOwnerId: () => string | null;
  getMemos: () => MemoRow[];
  language: UiLanguage;
  setModelDownload: Dispatch<SetStateAction<LocalMemoIndexProgress | null>>;
}

export const useEmbeddingModelDownload = ({
  getCurrentOwnerId,
  getInboxItems,
  getIndexOwnerId,
  getMemos,
  language,
  setModelDownload,
}: UseEmbeddingModelDownloadOptions) => {
  const t = (korean: string, english: string) =>
    localize(language, korean, english);

  return useCallback(async () => {
    const api = window.electronAPI;
    if (!api?.localEmbedDownloadModel) return;
    const toProgress = (
      state: 'downloading' | 'loading' | 'failed',
      downloadedBytes: number,
      totalBytes: number,
      error?: string,
    ): LocalMemoIndexProgress => ({
      completedChunks: 0,
      downloadedBytes,
      error,
      isInitialIndex: false,
      isVisible: true,
      ownerId: getCurrentOwnerId(),
      stage: state,
      totalBytes,
      totalChunks: 0,
    });

    setModelDownload(toProgress('downloading', 0, 0));
    const timer = window.setInterval(() => {
      void api.localEmbedStatus?.().then((next) => {
        if (!next || next.state === 'ready') return;
        setModelDownload(
          toProgress(
            next.state === 'failed'
              ? 'failed'
              : next.state === 'loading'
                ? 'loading'
                : 'downloading',
            next.downloadedBytes,
            next.totalBytes,
            next.error,
          ),
        );
      });
    }, 500);

    try {
      const result = await api.localEmbedDownloadModel();
      if (!result.ready) {
        setModelDownload(
          toProgress(
            'failed',
            result.downloadedBytes,
            result.totalBytes,
            result.error ??
              t(
                '검색 준비 파일을 받지 못했습니다.',
                'Could not download the files needed for search.',
              ),
          ),
        );
      } else {
        setModelDownload(null);
        scheduleLocalMemoIndexReconcile(
          getMemos(),
          getIndexOwnerId(),
          true,
        );
        scheduleLocalInboxIndexReconcile(getInboxItems(), getIndexOwnerId());
      }
    } finally {
      window.clearInterval(timer);
    }
  }, []);
};
