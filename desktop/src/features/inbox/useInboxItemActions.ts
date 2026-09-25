import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import {
  type InboxSession,
  type InboxSummaryStatus,
  createInboxSession,
  deleteInboxSession,
  deleteInboxSessionByClientId,
} from '../../services/backend/inboxService';
import {
  cacheLocalInboxItem,
  createLocalInboxSession,
  isLocalInboxSessionDeleted,
  markLocalInboxSessionDeleted,
  removeLocalInboxSession,
  removeLocalInboxSessionIfNotDeleted,
} from '../../services/local/offlineStore';
import { normalizeWebUrl } from '../../lib/url-policy';
import type { UiLanguage } from '../../lib/appSettings';

type InboxIdSetRef = MutableRefObject<Set<string>>;
type InboxServerIdsRef = MutableRefObject<Map<string, string>>;
type InboxTombstoneWritesRef = MutableRefObject<Map<string, Promise<void>>>;

interface UseInboxItemActionsOptions {
  currentSessionRef: MutableRefObject<Session | null>;
  discardDeletedPendingInboxItem: (
    currentSession: Session,
    item: InboxSession,
    clientId: string,
    ownerId: string,
  ) => Promise<void>;
  deletedPendingInboxClientIdsRef: InboxIdSetRef;
  inboxItems: InboxSession[];
  inboxServerIdsByClientIdRef: InboxServerIdsRef;
  invalidateInboxLike: (id: string) => void;
  isCurrentSession: (expectedSession: Session) => boolean;
  language: UiLanguage;
  pendingInboxDeleteIdsRef: InboxIdSetRef;
  pendingInboxTombstoneWritesRef: InboxTombstoneWritesRef;
  refreshInbox: () => Promise<void>;
  session: Session | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setInboxItems: Dispatch<SetStateAction<InboxSession[]>>;
  t: (korean: string, english: string) => string;
}

export const useInboxItemActions = ({
  currentSessionRef,
  discardDeletedPendingInboxItem,
  deletedPendingInboxClientIdsRef,
  inboxItems,
  inboxServerIdsByClientIdRef,
  invalidateInboxLike,
  isCurrentSession,
  language,
  pendingInboxDeleteIdsRef,
  pendingInboxTombstoneWritesRef,
  refreshInbox,
  session,
  setError,
  setInboxItems,
  t,
}: UseInboxItemActionsOptions) => {
  const inboxSourceLabel = (sourceType: InboxSession['sourceType']) => {
    if (sourceType === 'youtube') return 'YouTube';
    if (sourceType === 'instagram') return 'Instagram';
    return t('링크', 'Link');
  };

  // 반환값은 웹 클리핑 알림이 성공/실패를 가리는 데 쓴다. 로컬 우선 저장이라
  // 백엔드 호출이 실패해도(오프라인 큐) 저장 자체는 성공으로 본다.
  /**
   * 수집함의 수동 저장과 웹 클리핑이 같이 쓴다. 실패를 알리는 방법이 서로
   * 달라서 호출자를 받는다 — 수동은 방금 누른 사람이 앞에 있으니 다이얼로그로
   * 알리고, 클리핑은 사용자가 브라우저에 있으므로 창을 띄우지 않는다
   * (메뉴바 표시와 트레이 메뉴가 대신 알린다).
   */
  const saveInboxUrl = async (
    url: string,
    { source = 'clip' }: { source?: 'clip' | 'manual' } = {},
  ): Promise<{ error?: string; summaryStatus?: InboxSummaryStatus }> => {
    const failManually = (message: string) => {
      if (source === 'manual') window.alert(message);
      return { error: message };
    };
    const currentSession = session;
    setError(null);
    const normalizedUrl = normalizeWebUrl(url);
    if (!normalizedUrl) {
      return failManually(
        t(
          'http 또는 https 웹페이지 주소만 저장할 수 있습니다.',
          'Only http or https web addresses can be saved.',
        ),
      );
    }
    if (!currentSession) {
      return failManually(
        t(
          '링크를 저장하려면 먼저 로그인해 주세요.',
          'Sign in before saving a link.',
        ),
      );
    }
    const ownerId = currentSession.user.id;
    const localItem = await createLocalInboxSession(normalizedUrl, ownerId);
    setInboxItems((previous) => [localItem, ...previous]);
    window.electronAPI?.recordInboxSave?.({
      sourceLabel: inboxSourceLabel(localItem.sourceType),
      summaryStatus: localItem.summaryStatus,
      title: localItem.title ?? normalizedUrl,
      url: normalizedUrl,
    });

    try {
      const item = await createInboxSession(currentSession, {
        clientId: localItem.clientId,
        url: normalizedUrl,
      });
      inboxServerIdsByClientIdRef.current.set(localItem.clientId, item.id);
      const discardIfDeleted = async () => {
        const isDeleted =
          deletedPendingInboxClientIdsRef.current.has(localItem.clientId) ||
          (await isLocalInboxSessionDeleted(localItem.clientId, ownerId));
        if (!isDeleted) {
          return false;
        }
        deletedPendingInboxClientIdsRef.current.add(localItem.clientId);
        pendingInboxDeleteIdsRef.current.add(localItem.clientId);
        try {
          await discardDeletedPendingInboxItem(
            currentSession,
            item,
            localItem.clientId,
            ownerId,
          );
        } catch (caught) {
          if (isCurrentSession(currentSession)) {
            setError(
              caught instanceof Error
                ? caught.message
                : t(
                    '수집 항목 삭제를 서버에 반영하지 못했습니다.',
                    'Could not sync the saved-link deletion to the server.',
                  ),
            );
          }
        }
        return true;
      };
      if (await discardIfDeleted()) {
        return {};
      }
      // 캐시에 먼저 쓰고 큐에서 뺀다 — 2.5초 재조회 전에 재시작해도 보인다.
      await cacheLocalInboxItem(item, ownerId);
      if (await discardIfDeleted()) {
        return {};
      }
      const removedPendingItem = await removeLocalInboxSessionIfNotDeleted(
        localItem.clientId,
        ownerId,
      );
      if (!removedPendingItem || (await discardIfDeleted())) {
        if (!removedPendingItem) {
          deletedPendingInboxClientIdsRef.current.add(localItem.clientId);
          pendingInboxDeleteIdsRef.current.add(localItem.clientId);
          await discardDeletedPendingInboxItem(
            currentSession,
            item,
            localItem.clientId,
            ownerId,
          );
        }
        return {};
      }
      if (!isCurrentSession(currentSession)) {
        return {};
      }
      inboxServerIdsByClientIdRef.current.delete(localItem.clientId);
      setInboxItems((previous) => [
        item,
        ...previous.filter(
          (previousItem) =>
            previousItem.id !== localItem.id && previousItem.id !== item.id,
        ),
      ]);
      window.electronAPI?.recordInboxSave?.({
        sourceLabel: inboxSourceLabel(item.sourceType),
        summaryStatus: item.summaryStatus,
        title:
          item.title ?? item.originalUrl ?? item.canonicalUrl ?? normalizedUrl,
        url: item.originalUrl ?? item.canonicalUrl ?? normalizedUrl,
      });
      window.setTimeout(() => {
        void refreshInbox();
      }, 2500);
      // 알림 문구가 "저장은 됐지만 요약은 실패"를 구분할 수 있게 실어 보낸다.
      return { summaryStatus: item.summaryStatus };
    } catch (caught) {
      if (!isCurrentSession(currentSession)) {
        return {};
      }
      if (deletedPendingInboxClientIdsRef.current.has(localItem.clientId)) {
        return {};
      }
      setError(
        caught instanceof Error
          ? language === 'en'
            ? `${caught.message} Saved to the offline queue.`
            : `${caught.message} 오프라인 큐에 저장했습니다.`
          : t('오프라인 큐에 저장했습니다.', 'Saved to the offline queue.'),
      );
    }
    return {};
  };

  const deleteInboxItem = (id: string) => {
    if (
      !window.confirm(
        t('수집한 링크를 삭제하시겠습니까?', 'Delete this saved link?'),
      )
    ) {
      return;
    }

    const currentSession = session;
    const deletedItem = inboxItems.find((item) => item.id === id);
    if (!currentSession || !deletedItem) return;
    const ownerId = currentSession.user.id;
    const pendingClientId =
      deletedItem?.clientId && deletedItem.id === deletedItem.clientId
        ? deletedItem.clientId
        : null;
    invalidateInboxLike(id);
    pendingInboxDeleteIdsRef.current.add(id);
    if (deletedItem.clientId) {
      deletedPendingInboxClientIdsRef.current.add(deletedItem.clientId);
    }
    setInboxItems((previous) => previous.filter((item) => item.id !== id));

    // Every delete, including a known server row, is durable before the remote
    // request. This keeps a concurrent refresh or another renderer from
    // resurrecting the card while DELETE/POST is still in flight.
    const tombstoneWrite = markLocalInboxSessionDeleted(
      deletedItem,
      ownerId,
    ).then(() => undefined);
    const tombstoneKey = `${ownerId}:${id}`;
    pendingInboxTombstoneWritesRef.current.set(tombstoneKey, tombstoneWrite);
    void (async () => {
      try {
        await tombstoneWrite;
      } catch (caught) {
        pendingInboxDeleteIdsRef.current.delete(id);
        if (deletedItem.clientId) {
          deletedPendingInboxClientIdsRef.current.delete(deletedItem.clientId);
        }
        if (currentSessionRef.current?.user.id === ownerId) {
          setInboxItems((previous) =>
            previous.some((item) => item.id === id)
              ? previous
              : [deletedItem, ...previous],
          );
          window.alert(
            t(
              '링크를 삭제하지 못했습니다.\n잠시 뒤 다시 시도해 주세요.',
              'Could not delete the link.\nPlease try again shortly.',
            ),
          );
        }
        if (
          pendingInboxTombstoneWritesRef.current.get(tombstoneKey) ===
          tombstoneWrite
        ) {
          pendingInboxTombstoneWritesRef.current.delete(tombstoneKey);
        }
        return;
      }

      try {
        if (pendingClientId) {
          const serverId =
            inboxServerIdsByClientIdRef.current.get(pendingClientId);
          if (serverId) {
            await discardDeletedPendingInboxItem(
              currentSession,
              { ...deletedItem, id: serverId },
              pendingClientId,
              ownerId,
            );
          } else {
            const deleted = await deleteInboxSessionByClientId(
              currentSession,
              pendingClientId,
            );
            if (deleted) {
              await removeLocalInboxSession(pendingClientId, ownerId);
              deletedPendingInboxClientIdsRef.current.delete(pendingClientId);
              pendingInboxDeleteIdsRef.current.delete(pendingClientId);
            }
          }
          return;
        }

        await deleteInboxSession(currentSession, id);
        await removeLocalInboxSession(id, ownerId);
        pendingInboxDeleteIdsRef.current.delete(id);
        if (deletedItem.clientId) {
          deletedPendingInboxClientIdsRef.current.delete(deletedItem.clientId);
        }
      } catch (caught) {
        if (currentSessionRef.current?.user.id === ownerId) {
          setError(
            caught instanceof Error
              ? caught.message
              : t(
                  '수집 항목 삭제를 서버에 반영하지 못했습니다.',
                  'Could not sync the saved-link deletion to the server.',
                ),
          );
        }
      } finally {
        if (
          pendingInboxTombstoneWritesRef.current.get(tombstoneKey) ===
          tombstoneWrite
        ) {
          pendingInboxTombstoneWritesRef.current.delete(tombstoneKey);
        }
      }
    })();
  };

  return { deleteInboxItem, saveInboxUrl };
};
