import { splitNoteContent } from '../../lib/noteTitle';
import {
  MemoRow,
  MemoSimilarityEdge,
  TopicCluster,
  TopicMembership,
} from '../../types';
import { ActivityCompletion } from './growthTypes';

// 리포트를 띄우기 위한 최소 기록량. 이보다 적으면 0만 늘어놓게 되어 뿌듯함이
// 아니라 자책감을 준다.
export const MIN_MEMOS_FOR_REPORT = 5;

// 대표 주제는 3개까지. 더 늘리면 원이 작아지고 라벨이 겹친다.
const TOPIC_SLICE_LIMIT = 3;
// 이보다 적으면 "대표"라 부를 게 없어 섹션을 숨긴다.
const MIN_TOPICS_TO_SHOW = 2;
const NEW_TOPIC_CHIP_LIMIT = 3;

export interface TopicSlice {
  label: string;
  current: number;
  previous: number;
  isNew: boolean;
}

export interface MonthlyReport {
  monthKey: string;
  // 잔디 — index 0이 1일. 값은 그날 (쓴 메모 + 완료한 일정) 수.
  dailyCounts: number[];
  memoCount: number;
  memoDelta: number;
  activeDays: number;
  activeDaysDelta: number;
  completedCount: number;
  completedDelta: number;
  topics: TopicSlice[];
  newTopics: string[];
  newTopicOverflow: number;
  newEdgeCount: number;
  totalEdgeCount: number;
  hubMemo: { id: string; title: string; degree: number } | null;
}

export interface MonthlyReportInput {
  memos: MemoRow[];
  activities: ActivityCompletion[];
  clusters: TopicCluster[];
  memberships: TopicMembership[];
  edges: MemoSimilarityEdge[];
}

export const monthKeyOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const monthKeyOfIso = (iso: string) => monthKeyOf(new Date(iso));

export const shiftMonthKey = (monthKey: string, delta: number) => {
  const [year, month] = monthKey.split('-').map(Number);
  return monthKeyOf(new Date(year, month - 1 + delta, 1));
};

// 리포트가 다루는 달 = 직전 달. 진행 중인 달은 아직 "해낸 것"이 아니다.
export const reportMonthKey = (now: Date = new Date()) =>
  shiftMonthKey(monthKeyOf(now), -1);

export const formatMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  return `${year}년 ${Number(month)}월`;
};

export const monthMeta = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return {
    daysInMonth: new Date(year, month, 0).getDate(),
    firstWeekday: new Date(year, month - 1, 1).getDay(),
  };
};

// 대표 주제 섹션을 그릴 만한지. 주제가 하나뿐이면 비교가 안 된다.
export const hasTopicSection = (report: MonthlyReport) =>
  report.topics.length >= MIN_TOPICS_TO_SHOW;

export const hasKnowledgeSection = (report: MonthlyReport) =>
  report.newTopics.length > 0 || report.newEdgeCount > 0;

const localDateOfIso = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
};

export const buildMonthlyReport = (
  input: MonthlyReportInput,
  monthKey: string,
): MonthlyReport => {
  const { memos, activities, clusters, memberships, edges } = input;
  const previousKey = shiftMonthKey(monthKey, -1);
  const { daysInMonth } = monthMeta(monthKey);

  const monthMemos = memos.filter(
    memo => monthKeyOfIso(memo.created_at) === monthKey,
  );
  const monthMemoIds = new Set(monthMemos.map(memo => memo.id));
  const monthActivities = activities.filter(item =>
    item.local_date.startsWith(monthKey),
  );

  // 하루치 활동량 = 그날 쓴 메모 + 완료한 일정.
  const dailyCounts = Array.from({ length: daysInMonth }, () => 0);
  const bump = (localDate: string) => {
    const day = Number(localDate.slice(8, 10));
    if (day >= 1 && day <= daysInMonth) {
      dailyCounts[day - 1] += 1;
    }
  };
  monthMemos.forEach(memo => bump(localDateOfIso(memo.created_at)));
  monthActivities.forEach(item => bump(item.local_date));

  const previousMemos = memos.filter(
    memo => monthKeyOfIso(memo.created_at) === previousKey,
  );
  const previousActivities = activities.filter(item =>
    item.local_date.startsWith(previousKey),
  );
  const previousActiveDays = new Set([
    ...previousMemos.map(memo => localDateOfIso(memo.created_at)),
    ...previousActivities.map(item => item.local_date),
  ]).size;
  const monthActiveDays = new Set([
    ...monthMemos.map(memo => localDateOfIso(memo.created_at)),
    ...monthActivities.map(item => item.local_date),
  ]).size;

  // 토픽별 이번/지난 달 메모 수. 토픽에 생성 시각이 없어 소속 메모로 유추한다.
  const memoById = new Map(memos.map(memo => [memo.id, memo]));
  const perTopic = new Map<
    string,
    { current: number; previous: number; earliest: string | null }
  >();
  for (const membership of memberships) {
    const memo = memoById.get(membership.memoId);
    if (!memo) continue;
    const key = monthKeyOfIso(memo.created_at);
    const entry =
      perTopic.get(membership.topicId) ??
      { current: 0, previous: 0, earliest: null };
    if (key === monthKey) entry.current += 1;
    if (key === previousKey) entry.previous += 1;
    if (!entry.earliest || memo.created_at < entry.earliest) {
      entry.earliest = memo.created_at;
    }
    perTopic.set(membership.topicId, entry);
  }

  const labelOf = new Map(clusters.map(cluster => [cluster.id, cluster.label]));
  const isNewTopic = (earliest: string | null) =>
    Boolean(earliest) && monthKeyOfIso(earliest as string) === monthKey;

  const topics: TopicSlice[] = [...perTopic.entries()]
    .map(([topicId, entry]) => ({
      label: labelOf.get(topicId) ?? '',
      current: entry.current,
      previous: entry.previous,
      isNew: isNewTopic(entry.earliest),
    }))
    .filter(topic => topic.label && topic.current > 0)
    .sort((a, b) => b.current - a.current)
    .slice(0, TOPIC_SLICE_LIMIT);

  const allNewTopics = [...perTopic.entries()]
    .filter(([, entry]) => isNewTopic(entry.earliest))
    .map(([topicId]) => labelOf.get(topicId))
    .filter((label): label is string => Boolean(label));

  // 엣지에도 시각이 없어 "이번 달 메모가 걸린 연결"을 이번 달 증가분으로 센다.
  const degree = new Map<string, number>();
  let newEdgeCount = 0;
  for (const edge of edges) {
    const touchesMonth =
      monthMemoIds.has(edge.sourceMemoId) || monthMemoIds.has(edge.targetMemoId);
    if (!touchesMonth) continue;
    newEdgeCount += 1;
    for (const id of [edge.sourceMemoId, edge.targetMemoId]) {
      if (monthMemoIds.has(id)) {
        degree.set(id, (degree.get(id) ?? 0) + 1);
      }
    }
  }

  const [hubId, hubDegree] =
    [...degree.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const hubSource = hubId ? memoById.get(hubId) : undefined;

  return {
    monthKey,
    dailyCounts,
    memoCount: monthMemos.length,
    memoDelta: monthMemos.length - previousMemos.length,
    activeDays: monthActiveDays,
    activeDaysDelta: monthActiveDays - previousActiveDays,
    completedCount: monthActivities.length,
    completedDelta: monthActivities.length - previousActivities.length,
    topics,
    newTopics: allNewTopics.slice(0, NEW_TOPIC_CHIP_LIMIT),
    newTopicOverflow: Math.max(0, allNewTopics.length - NEW_TOPIC_CHIP_LIMIT),
    newEdgeCount,
    totalEdgeCount: edges.length,
    hubMemo: hubSource
      ? {
          id: hubSource.id,
          title: splitNoteContent(hubSource.content).title || '제목 없음',
          degree: hubDegree ?? 0,
        }
      : null,
  };
};

// ── 배지 상태 (읽음 표시) ────────────────────────────────────────
// ponytail: localStorage 로컬 전용 — 기기마다 한 번씩 뜨는 건 감수. 동기화가
// 필요해지면 profiles에 컬럼 추가.
const SEEN_KEY = 'subnota.monthlyReportSeen.v1';

const seenKey = (ownerId: string | null) =>
  `${SEEN_KEY}.${ownerId ? `user.${ownerId}` : 'guest'}`;

export const loadSeenReportMonth = (ownerId: string | null): string | null => {
  try {
    return window.localStorage?.getItem(seenKey(ownerId)) ?? null;
  } catch {
    return null;
  }
};

export const saveSeenReportMonth = (ownerId: string | null, monthKey: string) => {
  try {
    window.localStorage?.setItem(seenKey(ownerId), monthKey);
  } catch {
    // 저장 불가 환경에서는 배지가 매번 떠도 기능은 동작한다.
  }
};
