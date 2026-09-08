import { useCallback } from 'react';

import { hasScheduledDate } from '../schedule/scheduleInboxUtils';
import type { MemoSplitPaneView } from '../memo/components/MemoSplitWorkspace';
import type { GlobalSearchItem } from '../../lib/globalSearch';
import type { MemoRow, ScheduleInboxRow } from '../../types';

interface UseGlobalSearchNavigationOptions {
  memos: readonly MemoRow[];
  onOpenMemoInFocusedSplitPane: (memo: MemoRow) => void;
  onOpenScheduleInboxPanel: () => void;
  onOpenViewAsTab: (view: MemoSplitPaneView) => void;
  onSelectMemo: (memo: MemoRow) => void;
  scheduleInbox: readonly ScheduleInboxRow[];
}

export const useGlobalSearchNavigation = ({
  memos,
  onOpenMemoInFocusedSplitPane,
  onOpenScheduleInboxPanel,
  onOpenViewAsTab,
  onSelectMemo,
  scheduleInbox,
}: UseGlobalSearchNavigationOptions) => {
  const openGlobalSearchResult = useCallback(
    (item: GlobalSearchItem) => {
      if (item.kind === 'memo') {
        const memo = memos.find(candidate => candidate.id === item.id);
        if (memo) {
          onSelectMemo(memo);
          onOpenMemoInFocusedSplitPane(memo);
        }
        return;
      }

      if (item.kind === 'topic') {
        onOpenViewAsTab('topics');
        window.requestAnimationFrame(() => {
          window.dispatchEvent(
            new CustomEvent('subnota:show-topic-folder', {
              detail: { topicId: item.id },
            }),
          );
        });
        return;
      }

      if (item.kind === 'inbox') {
        // 전역 검색의 링크 결과는 현재 작업을 유지한 채 참고로 연다.
        // Inbox 자체를 탐색할 때만 네비게이션에서 Inbox 탭을 연다.
        window.dispatchEvent(
          new CustomEvent('subnota:open-inbox-source', {
            detail: { inboxSessionId: item.id },
          }),
        );
        return;
      }

      if (item.kind === 'calendar') {
        onOpenViewAsTab('calendar');
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('subnota:open-calendar-block', {
              detail: { blockId: item.id },
            }),
          );
        }, 0);
        return;
      }

      const suggestion = scheduleInbox.find(
        candidate => candidate.id === item.id,
      );
      onOpenViewAsTab('calendar');
      if (suggestion && hasScheduledDate(suggestion)) {
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('subnota:open-schedule-suggestion', {
              detail: { itemId: item.id },
            }),
          );
        }, 0);
        return;
      }

      onOpenScheduleInboxPanel();
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('subnota:open-schedule-inbox-item', {
            detail: { itemId: item.id },
          }),
        );
      }, 0);
    },
    [
      memos,
      onOpenMemoInFocusedSplitPane,
      onOpenScheduleInboxPanel,
      onOpenViewAsTab,
      onSelectMemo,
      scheduleInbox,
    ],
  );

  return { openGlobalSearchResult };
};
