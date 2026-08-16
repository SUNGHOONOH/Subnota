import { AMBIENT_MIN_CHARS } from './constants';

export interface AmbientSearchTarget {
  editorId: string;
  memoId: string | null;
  queryText: string;
}

export type AmbientSearchMode = 'auto' | 'manual';

export interface AmbientSearchHandlers<TChunk, TResult> {
  // 자동 검색은 사용자가 시킨 적이 없다. 결과 없음·오류를 그대로 그리면
  // 글을 쓰는 중에 묻지도 않은 실패가 커서 아래 나타난다. 상태 정리는
  // 해야 하므로 호출은 하되, 표시 여부는 mode로 받아서 판단한다.
  onEmpty?: (target: AmbientSearchTarget, mode: AmbientSearchMode) => void;
  onError?: (
    target: AmbientSearchTarget,
    error: unknown,
    mode: AmbientSearchMode,
  ) => void;
  onFinish?: (target: AmbientSearchTarget) => void;
  onResult?: (
    target: AmbientSearchTarget,
    queryChunk: TChunk,
    result: TResult,
  ) => void;
  onStart?: (target: AmbientSearchTarget) => void;
}

export interface AmbientSearchRunOptions {
  // 사용자가 선택 후 직접 누른 검색은 자동 추천과 다르다. 짧은 구절도
  // 허용하되, 진행 중인 같은 요청은 여전히 하나만 유지한다.
  mode?: 'auto' | 'manual';
}

// 자동 검색 게이트: 설정 ON + 로그인 + 앱이 포그라운드일 때만 허용한다.
export const canRunAmbientAutoSearch = (input: {
  autoSearchEnabled: boolean;
  documentHasFocus: boolean;
  documentHidden: boolean;
  hasSession: boolean;
}): boolean =>
  input.autoSearchEnabled &&
  input.hasSession &&
  !input.documentHidden &&
  input.documentHasFocus;

// 수동 버튼과 자동 검색이 공유하는 latest-wins 실행기.
// 새 커서 문맥이 들어오면 이전 요청은 즉시 무효화하고, 실제 비동기 작업이
// 정리되는 즉시 가장 최근 요청만 실행한다. 임베딩 IPC 자체를 중간에 끊을 수
// 없어도 오래된 결과가 표시되거나 최신 요청이 in-flight 잠금에 유실되지 않는다.
export const createAmbientSearchRunner = <TChunk, TResult>({
  minChars = AMBIENT_MIN_CHARS,
  search,
}: {
  minChars?: number;
  search: (
    target: AmbientSearchTarget,
    signal: AbortSignal,
  ) => Promise<{ queryChunk: TChunk; results: TResult[] }>;
}) => {
  type PendingRequest = {
    handlers: AmbientSearchHandlers<TChunk, TResult>;
    mode: 'auto' | 'manual';
    targetKey: string;
    snapshot: AmbientSearchTarget;
  };
  type ActiveRequest = PendingRequest & {
    cancelled: boolean;
    controller: AbortController;
    finishNotified: boolean;
    id: number;
  };

  let active: ActiveRequest | null = null;
  let nextRequestId = 0;
  let queued: PendingRequest | null = null;
  let lastAutomaticTargetKey: string | null = null;

  const sameTarget = (
    left: AmbientSearchTarget,
    right: AmbientSearchTarget,
  ) =>
    left.editorId === right.editorId &&
    left.memoId === right.memoId &&
    left.queryText === right.queryText;

  const notifyFinish = (request: ActiveRequest) => {
    if (request.finishNotified) return;
    request.finishNotified = true;
    request.handlers.onFinish?.(request.snapshot);
  };

  const cancelActive = () => {
    if (!active || active.cancelled) return;
    active.cancelled = true;
    active.controller.abort();
    notifyFinish(active);
  };

  const start = (pending: PendingRequest) => {
    const request: ActiveRequest = {
      ...pending,
      cancelled: false,
      controller: new AbortController(),
      finishNotified: false,
      id: ++nextRequestId,
    };
    active = request;
    request.handlers.onStart?.(request.snapshot);

    void search(request.snapshot, request.controller.signal)
      .then(response => {
        if (request.cancelled || active?.id !== request.id) return;
        if (request.mode === 'auto') {
          lastAutomaticTargetKey = request.targetKey;
        }
        const topResult = response.results[0] ?? null;
        if (topResult) {
          request.handlers.onResult?.(
            request.snapshot,
            response.queryChunk,
            topResult,
          );
        } else {
          request.handlers.onEmpty?.(request.snapshot, request.mode);
        }
      })
      .catch(error => {
        if (
          request.cancelled ||
          request.controller.signal.aborted ||
          active?.id !== request.id
        ) {
          return;
        }
        request.handlers.onError?.(request.snapshot, error, request.mode);
      })
      .finally(() => {
        notifyFinish(request);
        if (active?.id !== request.id) return;
        active = null;
        const next = queued;
        queued = null;
        if (next) start(next);
      });
  };

  return {
    cancel: () => {
      queued = null;
      cancelActive();
    },
    isSearching: () =>
      Boolean((active && !active.cancelled) || queued),
    run: (
      target: AmbientSearchTarget | null,
      handlers: AmbientSearchHandlers<TChunk, TResult> = {},
      options: AmbientSearchRunOptions = {},
    ): boolean => {
      if (!target) {
        return false;
      }
      const queryText = target.queryText.trim();
      const mode = options.mode ?? 'auto';
      if (mode === 'auto' && queryText.length < minChars) {
        return false;
      }
      const targetKey = `${target.editorId}:${target.memoId ?? 'draft'}:${queryText}`;
      if (mode === 'auto' && lastAutomaticTargetKey === targetKey) {
        return false;
      }

      // 자동 추천은 현재 문맥에서 한 번만 끝낸다. 커서/문맥이 바뀌면
      // 같은 문장으로 돌아와도 다시 검색할 수 있다.
      if (mode === 'auto') {
        lastAutomaticTargetKey = null;
      }

      const snapshot: AmbientSearchTarget = { ...target, queryText };
      if (
        (queued && sameTarget(queued.snapshot, snapshot)) ||
        (active &&
          !active.cancelled &&
          sameTarget(active.snapshot, snapshot))
      ) {
        return false;
      }

      const pending = { handlers, mode, snapshot, targetKey };
      if (active) {
        cancelActive();
        queued = pending;
      } else {
        start(pending);
      }
      return true;
    },
  };
};
