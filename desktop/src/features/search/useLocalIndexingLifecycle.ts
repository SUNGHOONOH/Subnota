import { useEffect, useRef, type MutableRefObject } from 'react';
import type { Session } from '@supabase/supabase-js';

import type { InboxSession } from '../../services/backend/inboxService';
import {
  cancelLocalMemoIndexing,
  scheduleLocalMemoIndexReconcile,
  subscribeLocalMemoIndexProgress,
  type LocalMemoIndexProgress,
} from '../../services/local/localMemoIndexer';
import {
  cancelLocalInboxIndexing,
  scheduleLocalInboxIndexReconcile,
} from '../../services/local/localInboxIndexer';
import type { MemoRow } from '../../types';
import {
  isEmptyLocalIndexCompletion,
  shouldShowLocalIndexProgress,
} from './LocalIndexProgress';

interface UseLocalIndexingLifecycleOptions {
  inboxItems: InboxSession[];
  isBooting: boolean;
  localIndexOwnerId: string | null;
  localIndexOwnerIdRef: MutableRefObject<string | null>;
  memos: MemoRow[];
  sessionRef: MutableRefObject<Session | null>;
  setEmbeddingGateOpen: (value: boolean) => void;
  setLocalIndexProgress: (value: LocalMemoIndexProgress | null) => void;
}

export const useLocalIndexingLifecycle = ({
  inboxItems,
  isBooting,
  localIndexOwnerId,
  localIndexOwnerIdRef,
  memos,
  sessionRef,
  setEmbeddingGateOpen,
  setLocalIndexProgress,
}: UseLocalIndexingLifecycleOptions) => {
  const localIndexStartupOwnerRef = useRef<string | null | undefined>(undefined);
  const embeddingGateOwnerRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeLocalMemoIndexProgress((progress) => {
      const ownerId = sessionRef.current?.user.id ?? null;
      if (progress.ownerId !== ownerId) return;
      if (isEmptyLocalIndexCompletion(progress) || !shouldShowLocalIndexProgress(progress)) {
        setLocalIndexProgress(null);
        return;
      }
      setLocalIndexProgress(progress);
    });
    return () => {
      unsubscribe();
    };
  }, [sessionRef, setLocalIndexProgress]);

  useEffect(() => {
    localIndexStartupOwnerRef.current = undefined;
    cancelLocalMemoIndexing();
    cancelLocalInboxIndexing();
    setLocalIndexProgress(null);
    return () => {
      cancelLocalMemoIndexing();
      cancelLocalInboxIndexing();
    };
  }, [localIndexOwnerId, setLocalIndexProgress]);

  useEffect(() => {
    if (isBooting) return;
    const owner = localIndexOwnerId ?? 'guest';
    if (embeddingGateOwnerRef.current === owner) return;
    embeddingGateOwnerRef.current = owner;
    void (async () => {
      const status = await window.electronAPI?.localEmbedStatus?.();
      if (status && !status.ready && status.state !== 'downloading') {
        setEmbeddingGateOpen(true);
      }
    })();
  }, [isBooting, localIndexOwnerId, setEmbeddingGateOpen]);

  useEffect(() => {
    if (isBooting || memos.length === 0) return;
    const startupOwner = localIndexOwnerId ?? 'guest';
    if (localIndexStartupOwnerRef.current === startupOwner) return;
    localIndexStartupOwnerRef.current = startupOwner;
    void (async () => {
      const status = await window.electronAPI?.localEmbedStatus?.();
      if (!status?.ready) return;
      scheduleLocalMemoIndexReconcile(memos, localIndexOwnerId);
    })();
  }, [isBooting, localIndexOwnerId, memos]);

  useEffect(() => {
    if (isBooting) return;
    const ownerId = localIndexOwnerId;
    void window.electronAPI?.localEmbedStatus?.().then((status) => {
      if (!status?.ready || localIndexOwnerIdRef.current !== ownerId) return;
      scheduleLocalInboxIndexReconcile(inboxItems, ownerId);
    });
  }, [inboxItems, isBooting, localIndexOwnerId, localIndexOwnerIdRef]);
};
