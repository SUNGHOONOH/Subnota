import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { AmbientSearchTarget } from '../../lib/ambientSearch';
import { createUuid } from '../../lib/contentHash';
import { DEFAULT_MEMO_CATEGORY } from '../../lib/memoCategory';
import type { NetworkSearchResult } from '../../services/local/memoSearchTypes';
import type { MemoRow } from '../../types';

interface UseMemoEditorActionsOptions {
  activeDraftCategory: string;
  activeMemoCreatedAtRef: MutableRefObject<string>;
  activeMemoIdRef: MutableRefObject<string | null>;
  ambientTargetRef: MutableRefObject<AmbientSearchTarget | null>;
  saveMemoContent: (
    id: string,
    content: string,
    fallback?: { category?: string; createdAt?: string },
    previousEditorContent?: string,
    allowEmpty?: boolean,
  ) => MemoRow | null;
  setActiveMemoCreatedAt: Dispatch<SetStateAction<string>>;
  setActiveMemoId: Dispatch<SetStateAction<string | null>>;
  setAmbientError: Dispatch<SetStateAction<string | null>>;
  setAmbientResult: Dispatch<SetStateAction<NetworkSearchResult | null>>;
  setAmbientTarget: Dispatch<SetStateAction<AmbientSearchTarget | null>>;
  t: (korean: string, english: string) => string;
}

export const useMemoEditorActions = ({
  activeDraftCategory,
  activeMemoCreatedAtRef,
  activeMemoIdRef,
  ambientTargetRef,
  saveMemoContent,
  setActiveMemoCreatedAt,
  setActiveMemoId,
  setAmbientError,
  setAmbientResult,
  setAmbientTarget,
  t,
}: UseMemoEditorActionsOptions) => {
  const changeMemoDraft = (
    value: string,
    previousEditorContent?: string,
  ) => {
    let memoId = activeMemoIdRef.current;
    let createdAt = activeMemoCreatedAtRef.current;
    if (!memoId && value.trim()) {
      memoId = createUuid();
      createdAt = new Date().toISOString();
      activeMemoIdRef.current = memoId;
      activeMemoCreatedAtRef.current = createdAt;
      setActiveMemoId(memoId);
      setActiveMemoCreatedAt(createdAt);
    }

    ambientTargetRef.current = null;
    setAmbientTarget(null);
    setAmbientResult(null);
    setAmbientError(null);

    if (memoId) {
      saveMemoContent(
        memoId,
        value,
        {
          category: activeDraftCategory,
          createdAt,
        },
        previousEditorContent,
      );
    }
  };

  const createMemoFromContent = (
    content: string,
    category = DEFAULT_MEMO_CATEGORY,
  ) => {
    const createdAt = new Date().toISOString();
    const id = createUuid();
    const memo = saveMemoContent(id, content, { category, createdAt });
    if (!memo) {
      throw new Error(
        t('빈 메모는 생성할 수 없습니다.', 'Cannot create an empty note.'),
      );
    }
    return memo;
  };

  const updateMemoContentById = (
    id: string,
    content: string,
    previousEditorContent?: string,
  ) => {
    saveMemoContent(id, content, undefined, previousEditorContent);
  };

  return {
    changeMemoDraft,
    createMemoFromContent,
    updateMemoContentById,
  };
};
