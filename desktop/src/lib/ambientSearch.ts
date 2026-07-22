import { AMBIENT_COOLDOWN_MS, AMBIENT_MIN_CHARS } from './constants';

export interface AmbientSearchTarget {
  editorId: string;
  memoId: string | null;
  queryText: string;
}

export interface AmbientSearchHandlers<TChunk, TResult> {
  onEmpty?: (target: AmbientSearchTarget) => void;
  onError?: (target: AmbientSearchTarget, error: unknown) => void;
  onFinish?: (target: AmbientSearchTarget) => void;
  onResult?: (
    target: AmbientSearchTarget,
    queryChunk: TChunk,
    result: TResult,
  ) => void;
  onStart?: (target: AmbientSearchTarget) => void;
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

// 수동 버튼과 자동 검색이 공유하는 단일 요청 실행기.
// - run()은 클릭 순간의 문장을 immutable snapshot으로 고정하고,
//   이후 입력이 이어져도 진행 중인 요청을 취소하거나 덮어쓰지 않는다.
// - 성공·실패·결과 없음일 때만 onFinish로 검색 상태가 해제된다.
// ponytail: 전역 단일 in-flight 잠금 — ambient는 결과 1개짜리 UI라 동시 요청이 무의미하다.
export const createAmbientSearchRunner = <TChunk, TResult>({
  cooldownMs = AMBIENT_COOLDOWN_MS,
  minChars = AMBIENT_MIN_CHARS,
  now = () => Date.now(),
  search,
}: {
  cooldownMs?: number;
  minChars?: number;
  now?: () => number;
  search: (
    target: AmbientSearchTarget,
  ) => Promise<{ queryChunk: TChunk; results: TResult[] }>;
}) => {
  let inFlight = false;
  const successAt = new Map<string, number>();

  return {
    isSearching: () => inFlight,
    run: (
      target: AmbientSearchTarget | null,
      handlers: AmbientSearchHandlers<TChunk, TResult> = {},
    ): boolean => {
      if (!target || inFlight) {
        return false;
      }
      const queryText = target.queryText.trim();
      if (queryText.length < minChars) {
        return false;
      }
      const cooldownKey = `${target.editorId}:${target.memoId ?? 'draft'}:${queryText}`;
      const lastSuccessAt = successAt.get(cooldownKey);
      if (lastSuccessAt !== undefined && now() - lastSuccessAt < cooldownMs) {
        return false;
      }

      inFlight = true;
      const snapshot: AmbientSearchTarget = { ...target, queryText };
      handlers.onStart?.(snapshot);
      void search(snapshot)
        .then(response => {
          successAt.set(cooldownKey, now());
          if (successAt.size > 200) {
            const oldestKey = successAt.keys().next().value;
            if (oldestKey) {
              successAt.delete(oldestKey);
            }
          }
          const topResult = response.results[0] ?? null;
          if (topResult) {
            handlers.onResult?.(snapshot, response.queryChunk, topResult);
          } else {
            handlers.onEmpty?.(snapshot);
          }
        })
        .catch(error => {
          handlers.onError?.(snapshot, error);
        })
        .finally(() => {
          inFlight = false;
          handlers.onFinish?.(snapshot);
        });
      return true;
    },
  };
};
