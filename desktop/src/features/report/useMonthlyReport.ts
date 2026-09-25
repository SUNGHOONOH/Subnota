import { useMemo, useState } from 'react';

import type {
  MemoRow,
  MemoSimilarityEdge,
  TopicCluster,
  TopicMembership,
} from '../../types';
import type { ActivityCompletion } from './growthTypes';
import {
  MIN_MEMOS_FOR_REPORT,
  buildMonthlyReport,
  loadSeenReportMonth,
  monthKeyOf,
  reportMonthKey,
  saveSeenReportMonth,
} from './monthlyReport';

interface UseMonthlyReportOptions {
  activities: ActivityCompletion[];
  currentOwnerId: string | null;
  edges: MemoSimilarityEdge[];
  initialOwnerId: string | null;
  memberships: TopicMembership[];
  memos: MemoRow[];
  topicClusters: TopicCluster[];
}

export const useMonthlyReport = ({
  activities,
  currentOwnerId,
  edges,
  initialOwnerId,
  memberships,
  memos,
  topicClusters,
}: UseMonthlyReportOptions) => {
  const [isReportOpen, setReportOpen] = useState(false);
  const [reportMonth, setReportMonth] = useState(() => reportMonthKey());
  const [seenReportMonth, setSeenReportMonth] = useState<string | null>(() =>
    loadSeenReportMonth(initialOwnerId),
  );
  const monthlyReport = useMemo(
    () =>
      buildMonthlyReport(
        {
          activities,
          clusters: topicClusters,
          edges,
          memberships,
          memos,
        },
        reportMonth,
      ),
    [activities, edges, memberships, memos, reportMonth, topicClusters],
  );
  const latestReportMonth = reportMonthKey();
  const hasNewReport =
    seenReportMonth !== latestReportMonth &&
    memos.filter(
      (memo) => monthKeyOf(new Date(memo.created_at)) === latestReportMonth,
    ).length >= MIN_MEMOS_FOR_REPORT;

  const openReport = () => {
    setReportMonth(latestReportMonth);
    setReportOpen(true);
    setSeenReportMonth(latestReportMonth);
    saveSeenReportMonth(currentOwnerId, latestReportMonth);
  };

  return {
    hasNewReport,
    isReportOpen,
    latestReportMonth,
    monthlyReport,
    openReport,
    reportMonth,
    setReportMonth,
    setReportOpen,
    setSeenReportMonth,
  };
};
