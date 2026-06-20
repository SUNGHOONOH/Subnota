import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AMBIENT_COOLDOWN_MS,
  AMBIENT_MAX_RESULT_COUNT,
  AMBIENT_MIN_CHARS,
} from '../../../lib/constants';
import { hashText } from '../../../lib/contentHash';
import { MemoChunk } from '../../../lib/memoChunker';
import {
  NetworkSearchResult,
  searchCursorNetwork,
} from '../../network/services/networkService';

interface UseAmbientArgs {
  text: string;
  memoId: string | null;
  selectionStart: number;
  selectionEnd: number;
  /** Only the focused pane runs ambient search (it's a network call). */
  isActive: boolean;
  /** Open a result in a (new) pane — provided by the workspace. */
  onOpenResult: (result: NetworkSearchResult) => void;
}

export interface UseAmbientResult {
  onAmbientIdle: (chunkText: string) => void;
  queryChunk: MemoChunk | null;
  results: NetworkSearchResult[];
  isCardsVisible: boolean;
  selectedResult: NetworkSearchResult | null;
  isPreviewVisible: boolean;
  onSelectResult: (result: NetworkSearchResult) => void;
  onOpenSelected: () => void;
  dismissPreview: () => void;
}

const distanceToRange = (cursorIndex: number, start: number, end: number) => {
  if (cursorIndex >= start && cursorIndex <= end) {
    return 0;
  }

  return Math.min(Math.abs(cursorIndex - start), Math.abs(cursorIndex - end));
};

export const findClosestTextIndex = (
  sourceText: string,
  targetText: string,
  cursorIndex: number,
) => {
  const target = targetText.trim();
  if (!target) {
    return Math.max(0, Math.min(cursorIndex, sourceText.length));
  }

  let bestIndex = sourceText.indexOf(target);
  if (bestIndex < 0) {
    return Math.max(0, Math.min(cursorIndex, sourceText.length));
  }

  let bestDistance = distanceToRange(
    cursorIndex,
    bestIndex,
    bestIndex + target.length,
  );
  let searchFrom = bestIndex + 1;

  while (searchFrom < sourceText.length) {
    const nextIndex = sourceText.indexOf(target, searchFrom);
    if (nextIndex < 0) {
      break;
    }

    const nextDistance = distanceToRange(
      cursorIndex,
      nextIndex,
      nextIndex + target.length,
    );

    if (nextDistance < bestDistance) {
      bestDistance = nextDistance;
      bestIndex = nextIndex;
    }

    searchFrom = nextIndex + 1;
  }

  return bestIndex;
};

/**
 * "무의식" ambient suggestions for a single editor. Only the active pane fetches
 * (network), dedupes by cursor chunk, and throttles. Selecting a card opens a
 * preview; confirming opens the result in a pane via onOpenResult.
 */
export const useAmbient = ({
  text,
  memoId,
  selectionStart,
  selectionEnd,
  isActive,
  onOpenResult,
}: UseAmbientArgs): UseAmbientResult => {
  const [queryChunk, setQueryChunk] = useState<MemoChunk | null>(null);
  const [results, setResults] = useState<NetworkSearchResult[]>([]);
  const [selectedResult, setSelectedResult] =
    useState<NetworkSearchResult | null>(null);
  const [isCardsVisible, setCardsVisible] = useState(false);
  const [isPreviewVisible, setPreviewVisible] = useState(false);

  const chunkHashRef = useRef<string | null>(null);
  const lastRequestAtRef = useRef(0);
  const requestIdRef = useRef(0);

  const onAmbientIdle = useCallback(
    async (chunkText: string) => {
      setCardsVisible(false);

      const collapsedSelection = selectionStart === selectionEnd;
      if (
        !isActive ||
        !memoId ||
        !collapsedSelection ||
        text.trim().length < AMBIENT_MIN_CHARS ||
        isPreviewVisible
      ) {
        return;
      }

      const chunkHash = hashText(`${memoId}:${chunkText.trim()}`);

      if (
        chunkHashRef.current === chunkHash &&
        queryChunk &&
        results.length > 0
      ) {
        setCardsVisible(true);
        return;
      }

      const now = Date.now();
      if (now - lastRequestAtRef.current < AMBIENT_COOLDOWN_MS) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      lastRequestAtRef.current = now;

      // The editor sends the cursor's block text (markdown-agnostic plaintext);
      // locate the occurrence closest to the current selection so repeated
      // blocks do not search from the first matching sentence.
      const cursorIndex = findClosestTextIndex(
        text,
        chunkText,
        selectionStart,
      );

      try {
        const result = await searchCursorNetwork({
          cursorIndex,
          limit: AMBIENT_MAX_RESULT_COUNT,
          memoId,
          text,
        });
        const nextResults = result.results.slice(0, 2);

        if (requestIdRef.current !== requestId) {
          return;
        }

        if (result.queryChunk && nextResults.length > 0) {
          chunkHashRef.current = chunkHash;
          setQueryChunk(result.queryChunk);
          setResults(nextResults);
          setSelectedResult(nextResults[0]);
          setCardsVisible(true);
        }
      } catch {
        // Ambient search is intentionally quiet.
      }
    },
    [
      isActive,
      isPreviewVisible,
      memoId,
      queryChunk,
      results.length,
      selectionEnd,
      selectionStart,
      text,
    ],
  );

  // Drop the ambient surface when this pane loses focus.
  useEffect(() => {
    if (!isActive) {
      setCardsVisible(false);
      setPreviewVisible(false);
    }
  }, [isActive]);

  const onSelectResult = useCallback((result: NetworkSearchResult) => {
    setSelectedResult(result);
    setCardsVisible(false);
    setPreviewVisible(true);
  }, []);

  const onOpenSelected = useCallback(() => {
    if (selectedResult) {
      onOpenResult(selectedResult);
      setPreviewVisible(false);
      setCardsVisible(false);
    }
  }, [onOpenResult, selectedResult]);

  const dismissPreview = useCallback(() => {
    setPreviewVisible(false);
  }, []);

  return {
    onAmbientIdle,
    queryChunk,
    results,
    isCardsVisible,
    selectedResult,
    isPreviewVisible,
    onSelectResult,
    onOpenSelected,
    dismissPreview,
  };
};
