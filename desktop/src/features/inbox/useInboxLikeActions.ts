import {
  useCallback,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  cacheLocalInboxItem,
  loadLocalInboxItems,
} from '../../services/local/offlineStore';
import {
  setInboxLiked,
  type InboxSession,
} from '../../services/backend/inboxService';
import {
  reconcileRemoteInboxLikes as reconcileRemoteInboxLikesState,
} from './inboxState';

type SessionRef = { current: Session | null };
type SequenceRef = { current: number };
type Translate = (korean: string, english: string) => string;

interface UseInboxLikeActionsOptions {
  currentSessionRef: SessionRef;
  refreshSequenceRef: SequenceRef;
  setInboxItems: Dispatch<SetStateAction<InboxSession[]>>;
  translate: Translate;
}

export const useInboxLikeActions = ({
  currentSessionRef,
  refreshSequenceRef,
  setInboxItems,
  translate: t,
}: UseInboxLikeActionsOptions) => {
  const revisionsRef = useRef<Map<string, number>>(new Map());
  const pendingCountsRef = useRef<Map<string, number>>(new Map());
  const confirmedLikesRef = useRef<Map<string, boolean>>(new Map());
  const latestLikesRef = useRef<Map<string, boolean>>(new Map());
  const refreshFloorRef = useRef<Map<string, number>>(new Map());

  const reset = useCallback(() => {
    revisionsRef.current.clear();
    pendingCountsRef.current.clear();
    confirmedLikesRef.current.clear();
    latestLikesRef.current.clear();
    refreshFloorRef.current.clear();
  }, []);

  const invalidateInboxLike = useCallback((id: string) => {
    revisionsRef.current.set(id, (revisionsRef.current.get(id) ?? 0) + 1);
  }, []);

  const reconcileRemoteInboxLikes = useCallback(
    (items: InboxSession[], requestSequence: number) =>
      reconcileRemoteInboxLikesState(items, requestSequence, {
        confirmedLikes: confirmedLikesRef.current,
        latestLikes: latestLikesRef.current,
        pendingCounts: pendingCountsRef.current,
        refreshFloor: refreshFloorRef.current,
      }),
    [],
  );

  const toggleInboxLike = useCallback(
    (id: string, liked: boolean) => {
      const currentSession = currentSessionRef.current;
      if (!currentSession) return;
      const ownerId = currentSession.user.id;
      const revision = (revisionsRef.current.get(id) ?? 0) + 1;
      revisionsRef.current.set(id, revision);
      const pendingCount = pendingCountsRef.current.get(id) ?? 0;
      if (pendingCount === 0) {
        confirmedLikesRef.current.set(id, !liked);
      }
      pendingCountsRef.current.set(id, pendingCount + 1);
      const settleMutation = (confirmedLiked?: boolean) => {
        if (confirmedLiked !== undefined) {
          confirmedLikesRef.current.set(id, confirmedLiked);
        }
        const remaining = Math.max(
          0,
          (pendingCountsRef.current.get(id) ?? 1) - 1,
        );
        if (remaining === 0) {
          pendingCountsRef.current.delete(id);
        } else {
          pendingCountsRef.current.set(id, remaining);
        }
      };
      const isLatest = () => revisionsRef.current.get(id) === revision;

      latestLikesRef.current.set(id, liked);
      refreshFloorRef.current.set(id, refreshSequenceRef.current + 1);
      setInboxItems(previous =>
        previous.map(item => (item.id === id ? { ...item, liked } : item)),
      );
      void setInboxLiked(currentSession, id, liked).then(
        async () => {
          if (currentSessionRef.current?.user.id !== ownerId) return;
          // Requests are serialized per item, so each success advances the last
          // confirmed server value even when a newer optimistic click exists.
          settleMutation(liked);
          if (!isLatest()) {
            return;
          }
          latestLikesRef.current.set(id, liked);
          refreshFloorRef.current.set(id, refreshSequenceRef.current + 1);
          // A GET that started before this PATCH may finish later. Reassert the
          // confirmed latest value now and let only a later refresh replace it.
          setInboxItems(previous =>
            previous.map(item => (item.id === id ? { ...item, liked } : item)),
          );
          // 로컬 캐시에도 반영 — 다음 fetch 전에 재시작해도 하트가 유지된다.
          try {
            const cached = (await loadLocalInboxItems(ownerId)).find(
              item => item.id === id,
            );
            if (cached && isLatest()) {
              await cacheLocalInboxItem({ ...cached, liked }, ownerId);
            }
          } catch {
            // 캐시 반영 실패는 무시 — 서버가 진실이고 다음 fetch가 맞춘다.
          }
        },
        () => {
          if (currentSessionRef.current?.user.id !== ownerId) return;
          settleMutation();
          if (!isLatest()) {
            return;
          }
          const confirmedLiked = confirmedLikesRef.current.get(id) ?? !liked;
          latestLikesRef.current.set(id, confirmedLiked);
          refreshFloorRef.current.set(id, refreshSequenceRef.current + 1);
          setInboxItems(previous =>
            previous.map(item =>
              item.id === id ? { ...item, liked: confirmedLiked } : item,
            ),
          );
          window.alert(
            t(
              '좋아요를 저장하지 못했습니다.\n잠시 뒤 다시 눌러 주세요.',
              'Could not save your like.\nPlease try again shortly.',
            ),
          );
        },
      );
    },
    [currentSessionRef, refreshSequenceRef, setInboxItems, t],
  );

  return {
    invalidateInboxLike,
    reconcileRemoteInboxLikes,
    reset,
    toggleInboxLike,
  };
};
