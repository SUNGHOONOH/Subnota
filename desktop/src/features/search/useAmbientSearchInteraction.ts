import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import {
  canRunAmbientAutoSearch,
  createAmbientSearchRunner,
  type AmbientSearchHandlers,
  type AmbientSearchRunOptions,
  type AmbientSearchTarget,
} from '../../lib/ambientSearch';
import {
  AMBIENT_EMPTY_NOTICE_MS,
  AMBIENT_MAX_RESULT_COUNT,
  AMBIENT_MIN_CHARS,
  AMBIENT_MIN_SIMILARITY,
} from '../../lib/constants';
import type { MemoChunk } from '../../lib/memoChunker';
import { getLocalWorkspaceOwner } from '../../services/local/offlineStore';
import {
  searchLocalMemoChunks,
} from '../../services/local/localMemoSearch';
import type {
  NetworkSearchResponse,
  NetworkSearchResult,
} from '../../services/local/memoSearchTypes';
import { createAmbientSearchHandlers } from './ambientSearchHandlers';

const MANUAL_AMBIENT_SEARCH_NOTICE_MIN_MS = 700;

interface UseAmbientSearchInteractionOptions {
  ambientDisplayEditorId: string | null;
  ambientEmptyEditorId: string | null;
  ambientTarget: AmbientSearchTarget | null;
  ambientTargetRef: MutableRefObject<AmbientSearchTarget | null>;
  appAmbientAutoSearchEnabled: boolean;
  flushLocalMemoIndex: (
    memoIds?: string[],
    isVisible?: boolean,
  ) => Promise<boolean>;
  hasSession: boolean;
  setAmbientDisplayEditorId: Dispatch<SetStateAction<string | null>>;
  setAmbientEmptyEditorId: Dispatch<SetStateAction<string | null>>;
  setAmbientError: Dispatch<SetStateAction<string | null>>;
  setAmbientResult: Dispatch<SetStateAction<NetworkSearchResult | null>>;
  setAmbientTarget: Dispatch<SetStateAction<AmbientSearchTarget | null>>;
  setManualAmbientSearchNotice: Dispatch<
    SetStateAction<{ id: number; startedAt: number } | null>
  >;
}

type AmbientSearchRunner = {
  cancel: () => void;
  run: (
    target: AmbientSearchTarget | null,
    handlers?: AmbientSearchHandlers<MemoChunk, NetworkSearchResult>,
    options?: AmbientSearchRunOptions,
  ) => boolean;
};

export const useAmbientSearchInteraction = ({
  ambientDisplayEditorId,
  ambientEmptyEditorId,
  ambientTarget,
  ambientTargetRef,
  appAmbientAutoSearchEnabled,
  flushLocalMemoIndex,
  hasSession,
  setAmbientDisplayEditorId,
  setAmbientEmptyEditorId,
  setAmbientError,
  setAmbientResult,
  setAmbientTarget,
  setManualAmbientSearchNotice,
}: UseAmbientSearchInteractionOptions) => {
  const manualAmbientTargetRef = useRef<AmbientSearchTarget | null>(null);
  const ambientEmptyNoticeTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const manualAmbientSearchNoticeRef = useRef<{
    id: number;
    startedAt: number;
  } | null>(null);
  const manualAmbientSearchNoticeTimerRef = useRef<number | null>(null);
  const manualAmbientSearchNoticeIdRef = useRef(0);
  const ambientRunnerRef = useRef<AmbientSearchRunner>(
    createAmbientSearchRunner<MemoChunk, NetworkSearchResult>({
      search: async (target, signal) => {
        const ownerId = getLocalWorkspaceOwner();
        try {
          const response: NetworkSearchResponse = await searchLocalMemoChunks({
            limit: AMBIENT_MAX_RESULT_COUNT,
            memoId: target.memoId,
            minimumSimilarity: AMBIENT_MIN_SIMILARITY,
            ownerId,
            queryText: target.queryText,
            signal,
          });
          if (getLocalWorkspaceOwner() !== ownerId) {
            throw new DOMException('Local workspace changed.', 'AbortError');
          }
          return response;
        } catch (error) {
          if (getLocalWorkspaceOwner() !== ownerId) {
            throw new DOMException('Local workspace changed.', 'AbortError');
          }
          throw error;
        }
      },
    }),
  );

  const updateAmbientTarget = (
    editorId: string,
    memoId: string | null,
    queryText: string,
  ) => {
    const trimmedQueryText = queryText.trim();
    if (trimmedQueryText.length < AMBIENT_MIN_CHARS) {
      setAmbientTarget((previous) =>
        previous && previous.editorId === editorId ? null : previous,
      );
      return;
    }
    setAmbientTarget((previous) =>
      previous &&
      previous.editorId === editorId &&
      previous.memoId === memoId &&
      previous.queryText === trimmedQueryText
        ? previous
        : { editorId, memoId, queryText: trimmedQueryText },
    );
  };

  const showAmbientEmptyNotice = (editorId: string) => {
    if (ambientEmptyNoticeTimerRef.current) {
      clearTimeout(ambientEmptyNoticeTimerRef.current);
    }
    setAmbientEmptyEditorId(editorId);
    ambientEmptyNoticeTimerRef.current = setTimeout(() => {
      setAmbientEmptyEditorId(null);
    }, AMBIENT_EMPTY_NOTICE_MS);
  };

  const showManualAmbientSearchNotice = () => {
    if (manualAmbientSearchNoticeTimerRef.current !== null) {
      window.clearTimeout(manualAmbientSearchNoticeTimerRef.current);
      manualAmbientSearchNoticeTimerRef.current = null;
    }
    const notice = {
      id: ++manualAmbientSearchNoticeIdRef.current,
      startedAt: Date.now(),
    };
    manualAmbientSearchNoticeRef.current = notice;
    setManualAmbientSearchNotice(notice);
    return notice.id;
  };

  const finishManualAmbientSearchNotice = (id: number) => {
    const notice = manualAmbientSearchNoticeRef.current;
    if (!notice || notice.id !== id) return;

    const remaining = Math.max(
      0,
      MANUAL_AMBIENT_SEARCH_NOTICE_MIN_MS -
        (Date.now() - notice.startedAt),
    );
    manualAmbientSearchNoticeTimerRef.current = window.setTimeout(() => {
      if (manualAmbientSearchNoticeRef.current?.id !== id) return;
      manualAmbientSearchNoticeRef.current = null;
      manualAmbientSearchNoticeTimerRef.current = null;
      setManualAmbientSearchNotice(null);
    }, remaining);
  };

  const isCurrentAmbientTarget = (target: AmbientSearchTarget) => {
    const current = ambientTargetRef.current;
    return Boolean(
      current &&
      current.editorId === target.editorId &&
      current.memoId === target.memoId &&
      current.queryText === target.queryText,
    );
  };

  const dismissAmbient = (editorId: string) => {
    const target = ambientTargetRef.current;
    const belongsToEditor =
      target?.editorId === editorId ||
      ambientDisplayEditorId === editorId ||
      ambientEmptyEditorId === editorId;
    if (!belongsToEditor) return;

    ambientRunnerRef.current.cancel();
    ambientTargetRef.current = null;
    manualAmbientTargetRef.current = null;
    setAmbientTarget(null);
    setAmbientResult(null);
    setAmbientError(null);
    setAmbientDisplayEditorId(null);
    setAmbientEmptyEditorId(null);
    if (ambientEmptyNoticeTimerRef.current) {
      clearTimeout(ambientEmptyNoticeTimerRef.current);
      ambientEmptyNoticeTimerRef.current = null;
    }
  };

  const ambientSearchHandlers = createAmbientSearchHandlers({
    isCurrentTarget: isCurrentAmbientTarget,
    setAmbientDisplayEditorId,
    setAmbientEmptyEditorId,
    setAmbientError,
    setAmbientResult,
    showEmptyNotice: showAmbientEmptyNotice,
  });

  const runAmbientSearchNow = (manualTarget?: AmbientSearchTarget) => {
    const target = manualTarget ?? ambientTargetRef.current;
    if (!target) return;
    const manualNoticeId = manualTarget
      ? showManualAmbientSearchNotice()
      : null;
    if (manualTarget) {
      ambientTargetRef.current = manualTarget;
      manualAmbientTargetRef.current = manualTarget;
      setAmbientTarget(manualTarget);
      setAmbientResult(null);
      setAmbientError(null);
      setAmbientDisplayEditorId(null);
      setAmbientEmptyEditorId(null);
    } else {
      manualAmbientTargetRef.current = null;
    }
    void flushLocalMemoIndex(undefined, Boolean(manualTarget)).then(
      (indexed) => {
        if (!indexed || !isCurrentAmbientTarget(target)) {
          if (manualNoticeId !== null) {
            finishManualAmbientSearchNotice(manualNoticeId);
          }
          return;
        }
        const handlers =
          manualNoticeId === null
            ? ambientSearchHandlers
            : {
                ...ambientSearchHandlers,
                onFinish: () => finishManualAmbientSearchNotice(manualNoticeId),
              };
        const started = ambientRunnerRef.current.run(target, handlers, {
          mode: manualTarget ? 'manual' : 'auto',
        });
        if (!started && manualNoticeId !== null) {
          finishManualAmbientSearchNotice(manualNoticeId);
        }
      },
      () => {
        if (manualNoticeId !== null) {
          finishManualAmbientSearchNotice(manualNoticeId);
        }
      },
    );
  };

  useEffect(() => {
    if (
      !canRunAmbientAutoSearch({
        autoSearchEnabled: appAmbientAutoSearchEnabled,
        documentHasFocus: document.hasFocus(),
        documentHidden: document.hidden,
        hasSession,
      })
    ) {
      return;
    }
    const manualTarget = manualAmbientTargetRef.current;
    if (
      manualTarget &&
      ambientTarget &&
      manualTarget.editorId === ambientTarget.editorId &&
      manualTarget.memoId === ambientTarget.memoId &&
      manualTarget.queryText === ambientTarget.queryText
    ) {
      return;
    }
    ambientRunnerRef.current.run(ambientTarget, ambientSearchHandlers);
  }, [ambientTarget, appAmbientAutoSearchEnabled, hasSession]);

  useEffect(() => {
    return () => {
      if (ambientEmptyNoticeTimerRef.current) {
        clearTimeout(ambientEmptyNoticeTimerRef.current);
      }
      if (manualAmbientSearchNoticeTimerRef.current !== null) {
        window.clearTimeout(manualAmbientSearchNoticeTimerRef.current);
      }
      ambientRunnerRef.current.cancel();
    };
  }, []);

  return { dismissAmbient, runAmbientSearchNow, updateAmbientTarget };
};
