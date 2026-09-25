import type { Dispatch, SetStateAction } from 'react';

import type {
  AmbientSearchHandlers,
  AmbientSearchMode,
  AmbientSearchTarget,
} from '../../lib/ambientSearch';
import type { MemoChunk } from '../../lib/memoChunker';
import { formatLocalMemoSearchErrorMessage } from '../../services/local/localMemoSearch';
import type { NetworkSearchResult } from '../../services/local/memoSearchTypes';

interface CreateAmbientSearchHandlersOptions {
  isCurrentTarget: (target: AmbientSearchTarget) => boolean;
  setAmbientDisplayEditorId: Dispatch<SetStateAction<string | null>>;
  setAmbientEmptyEditorId: Dispatch<SetStateAction<string | null>>;
  setAmbientError: Dispatch<SetStateAction<string | null>>;
  setAmbientResult: Dispatch<SetStateAction<NetworkSearchResult | null>>;
  showEmptyNotice: (editorId: string) => void;
}

export const createAmbientSearchHandlers = ({
  isCurrentTarget,
  setAmbientDisplayEditorId,
  setAmbientEmptyEditorId,
  setAmbientError,
  setAmbientResult,
  showEmptyNotice,
}: CreateAmbientSearchHandlersOptions): AmbientSearchHandlers<
  MemoChunk,
  NetworkSearchResult
> => ({
  // 자동 검색의 "없음"·"오류"는 그리지 않는다. 사용자가 요청한 적이 없어
  // 알릴 것도 없고, 글 쓰는 중에 실패가 튀어나오면 방해만 된다. 다만
  // 이전 결과는 지워야 하므로 상태 정리는 그대로 한다.
  onEmpty: (target: AmbientSearchTarget, mode: AmbientSearchMode) => {
    if (!isCurrentTarget(target)) return;
    setAmbientResult(null);
    setAmbientError(null);
    if (mode !== 'manual') {
      setAmbientDisplayEditorId(null);
      setAmbientEmptyEditorId(null);
      return;
    }
    // 수동 검색에서 아무 반응이 없으면 "눌리긴 했나?"가 된다. 항상 알린다.
    setAmbientDisplayEditorId(target.editorId);
    showEmptyNotice(target.editorId);
  },
  onError: (
    target: AmbientSearchTarget,
    error: unknown,
    mode: AmbientSearchMode,
  ) => {
    if (!isCurrentTarget(target)) return;
    // 취소는 오류가 아니다 — 다음 입력이 이전 요청을 끊은 것뿐이다.
    const message = formatLocalMemoSearchErrorMessage(error);
    if (!message) return;
    setAmbientResult(null);
    setAmbientEmptyEditorId(null);
    if (mode !== 'manual') {
      setAmbientError(null);
      setAmbientDisplayEditorId(null);
      return;
    }
    setAmbientDisplayEditorId(target.editorId);
    setAmbientError(message);
  },
  onResult: (
    target: AmbientSearchTarget,
    _queryChunk: MemoChunk | null,
    result: NetworkSearchResult,
  ) => {
    if (!isCurrentTarget(target)) return;
    setAmbientResult(result);
    setAmbientError(null);
    setAmbientDisplayEditorId(target.editorId);
  },
});
