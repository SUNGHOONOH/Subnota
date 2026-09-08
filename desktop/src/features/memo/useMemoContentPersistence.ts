import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Session } from '@supabase/supabase-js';

import { rebaseEditorChangeOntoCanonical } from '../../lib/mergeMemo';
import { getMemoCategory } from '../../lib/memoCategory';
import {
  createLocalMemoRow,
  getLocalWorkspaceOwner,
  persistLocalMemoEventually,
  preserveLocalMemoRecovery,
} from '../../services/local/offlineStore';
import type { MemoCloudSyncInput } from './memoCloudSync';
import type { MemoRow, MemoSaveState } from '../../types';

interface UseMemoContentPersistenceOptions {
  cancelMemoCloudRetry: (memoId: string) => void;
  deletingMemoIdsRef: MutableRefObject<Set<string>>;
  isCurrentSession: (expectedSession: Session) => boolean;
  isPreparingToQuitRef: MutableRefObject<boolean>;
  memosRef: MutableRefObject<MemoRow[]>;
  memoLocalWriteRevisionsRef: MutableRefObject<Map<string, number>>;
  memoSyncRevisionsRef: MutableRefObject<Map<string, number>>;
  pendingLocalMemoWriteOwnersRef: MutableRefObject<Map<string, string | null>>;
  pendingLocalMemoWritePromisesRef: MutableRefObject<Map<string, Promise<void>>>;
  scheduleMemoCloudSync: (
    currentSession: Session,
    memo: MemoCloudSyncInput,
  ) => void;
  sessionRef: MutableRefObject<Session | null>;
  setError: Dispatch<SetStateAction<string | null>>;
  setMemoSaveStates: Dispatch<
    SetStateAction<Record<string, MemoSaveState>>
  >;
  setMemos: Dispatch<SetStateAction<MemoRow[]>>;
  t: (korean: string, english: string) => string;
}

export const useMemoContentPersistence = ({
  cancelMemoCloudRetry,
  deletingMemoIdsRef,
  isCurrentSession,
  isPreparingToQuitRef,
  memosRef,
  memoLocalWriteRevisionsRef,
  memoSyncRevisionsRef,
  pendingLocalMemoWriteOwnersRef,
  pendingLocalMemoWritePromisesRef,
  scheduleMemoCloudSync,
  sessionRef,
  setError,
  setMemoSaveStates,
  setMemos,
  t,
}: UseMemoContentPersistenceOptions) => {
  const saveMemoContent = (
    id: string,
    content: string,
    fallback?: { category?: string; createdAt?: string },
    previousEditorContent?: string,
    allowEmpty = false,
  ) => {
    const existingMemo = memosRef.current.find((memo) => memo.id === id);
    if (isPreparingToQuitRef.current) {
      return existingMemo ?? null;
    }
    if (deletingMemoIdsRef.current.has(id)) {
      return existingMemo ?? null;
    }
    if (!existingMemo && !content.trim() && !allowEmpty) {
      return null;
    }
    let contentToSave = content;
    if (
      existingMemo &&
      previousEditorContent !== undefined &&
      existingMemo.content !== previousEditorContent
    ) {
      const rebased = rebaseEditorChangeOntoCanonical(
        previousEditorContent,
        content,
        existingMemo.content,
      );
      contentToSave = rebased.text;
      if (!rebased.ok) {
        void preserveLocalMemoRecovery(
          {
            content: existingMemo.content,
            memoId: id,
            source: 'server',
            sourceUpdatedAt:
              existingMemo.content_updated_at ?? existingMemo.updated_at,
          },
          sessionRef.current?.user.id,
        );
        setError(
          t(
            '동기화된 변경과 현재 입력을 자동 병합하지 못해 복구 기록을 보관했습니다.',
            'We could not merge synced changes with your edits, so a recovery copy was kept.',
          ),
        );
      }
    }
    if (existingMemo?.content === contentToSave) {
      return existingMemo;
    }

    const createdAt =
      existingMemo?.created_at ??
      fallback?.createdAt ??
      new Date().toISOString();
    const contentUpdatedAt = new Date().toISOString();
    const category = getMemoCategory(
      existingMemo?.category ?? fallback?.category,
    );
    const currentSession = sessionRef.current;
    const ownerId = currentSession?.user.id;
    const localMemo = createLocalMemoRow(
      {
        category,
        content: contentToSave,
        content_updated_at: contentUpdatedAt,
        created_at: createdAt,
        id,
        synced_content: existingMemo?.synced_content ?? null,
        synced_content_hash: existingMemo?.synced_content_hash ?? null,
      },
      'pending',
    );

    const mergeLocalMemo = (previous: MemoRow[]) => {
      const exists = previous.some((memo) => memo.id === id);
      const merged = exists
        ? previous.map((memo) => (memo.id === id ? localMemo : memo))
        : [localMemo, ...previous];
      return merged.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    };
    // React render가 반영되기 전에 Tiptap update가 연달아 와도 두 번째 입력은
    // 첫 번째 입력을 최신값으로 본다. 오래된 render closure로 최종 입력을
    // "변경 없음" 처리하면 DB에 중간 상태가 남을 수 있다.
    memosRef.current = mergeLocalMemo(memosRef.current);
    setMemos((previous) => mergeLocalMemo(previous));

    const localRevision = (memoLocalWriteRevisionsRef.current.get(id) ?? 0) + 1;
    memoLocalWriteRevisionsRef.current.set(id, localRevision);
    pendingLocalMemoWriteOwnersRef.current.set(id, ownerId ?? null);
    memoSyncRevisionsRef.current.set(
      id,
      (memoSyncRevisionsRef.current.get(id) ?? 0) + 1,
    );
    cancelMemoCloudRetry(id);
    setMemoSaveStates((previous) => ({
      ...previous,
      [id]: 'saving-local',
    }));
    // SQLite transient failures get a bounded retry budget. Only the latest
    // revision may schedule cloud sync or change the visible save state.
    const localWritePromise = persistLocalMemoEventually(localMemo, ownerId);
    pendingLocalMemoWritePromisesRef.current.set(id, localWritePromise);
    void localWritePromise
      .then(() => {
        if (memoLocalWriteRevisionsRef.current.get(id) !== localRevision)
          return;
        pendingLocalMemoWriteOwnersRef.current.delete(id);
        if (getLocalWorkspaceOwner() !== (ownerId ?? null)) return;
        setMemoSaveStates((previous) => {
          if (!(id in previous)) return previous;
          const next = { ...previous };
          delete next[id];
          return next;
        });
        if (currentSession && isCurrentSession(currentSession)) {
          scheduleMemoCloudSync(currentSession, {
            baseHash: existingMemo?.synced_content_hash ?? null,
            category,
            content: contentToSave,
            contentUpdatedAt,
            createdAt,
            id,
          });
        }
      })
      .catch(() => {
        if (memoLocalWriteRevisionsRef.current.get(id) !== localRevision)
          return;
        if (getLocalWorkspaceOwner() !== (ownerId ?? null)) return;
        setMemoSaveStates((previous) => ({
          ...previous,
          [id]: 'local-failed',
        }));
      })
      .finally(() => {
        if (
          pendingLocalMemoWritePromisesRef.current.get(id) === localWritePromise
        ) {
          pendingLocalMemoWritePromisesRef.current.delete(id);
        }
      });

    return localMemo;
  };

  return { saveMemoContent };
};
