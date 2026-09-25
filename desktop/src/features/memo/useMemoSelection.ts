import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { AmbientSearchTarget } from '../../lib/ambientSearch';
import { getMemoCategory } from '../../lib/memoCategory';
import type { NetworkSearchResult } from '../../services/local/memoSearchTypes';
import type { MemoRow, TabKey } from '../../types';

interface UseMemoSelectionOptions {
  activeMemoId: string | null;
  ambientTargetRef: MutableRefObject<AmbientSearchTarget | null>;
  memos: MemoRow[];
  setActiveDraftCategory: Dispatch<SetStateAction<string>>;
  setActiveMemoCreatedAt: Dispatch<SetStateAction<string>>;
  setActiveMemoId: Dispatch<SetStateAction<string | null>>;
  setActiveTab: Dispatch<SetStateAction<TabKey>>;
  setAmbientDisplayEditorId: Dispatch<SetStateAction<string | null>>;
  setAmbientEmptyEditorId: Dispatch<SetStateAction<string | null>>;
  setAmbientError: Dispatch<SetStateAction<string | null>>;
  setAmbientResult: Dispatch<SetStateAction<NetworkSearchResult | null>>;
  setAmbientTarget: Dispatch<SetStateAction<AmbientSearchTarget | null>>;
}

export const useMemoSelection = ({
  activeMemoId,
  ambientTargetRef,
  memos,
  setActiveDraftCategory,
  setActiveMemoCreatedAt,
  setActiveMemoId,
  setActiveTab,
  setAmbientDisplayEditorId,
  setAmbientEmptyEditorId,
  setAmbientError,
  setAmbientResult,
  setAmbientTarget,
}: UseMemoSelectionOptions) => {
  const selectMemo = (memo: MemoRow) => {
    const isDifferentMemo = memo.id !== activeMemoId;
    setActiveMemoId(memo.id);
    setActiveMemoCreatedAt(memo.created_at);
    setActiveDraftCategory(getMemoCategory(memo.category));
    if (isDifferentMemo) {
      ambientTargetRef.current = null;
      setAmbientTarget(null);
      setAmbientResult(null);
      setAmbientError(null);
      setAmbientDisplayEditorId(null);
      setAmbientEmptyEditorId(null);
    }
    setActiveTab('memo');
  };

  const selectMemoById = (memoId: string) => {
    const targetMemo = memos.find(memo => memo.id === memoId);

    if (targetMemo) {
      selectMemo(targetMemo);
    }
  };

  return { selectMemo, selectMemoById };
};
