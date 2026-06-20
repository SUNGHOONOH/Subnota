export const AMBIENT_IDLE_DELAY_MS = 3000;
export const AMBIENT_COOLDOWN_MS = 60000;
export const AMBIENT_MAX_RESULT_COUNT = 1;
export const AMBIENT_MIN_CHARS = 12;

export type TopicTimeFilterKey = '1m' | '6m' | '1y' | 'all';

export const TOPIC_TIME_FILTERS: Array<{
  days: number | null;
  key: TopicTimeFilterKey;
  label: string;
}> = [
  { days: 30, key: '1m', label: '최근 1달' },
  { days: 183, key: '6m', label: '최근 6개월' },
  { days: 365, key: '1y', label: '최근 1년' },
  { days: null, key: 'all', label: '전체' },
];

export const DEFAULT_TOPIC_TIME_FILTER: TopicTimeFilterKey = '6m';
export const TOPIC_NODE_MIN_OPACITY = 0.34;
export const TOPIC_NODE_MAX_OPACITY = 1;
export const TOPIC_NODE_ACTIVE_BOOST = 0.24;
export const TOPIC_NODE_MIN_RADIUS = 12;
export const TOPIC_NODE_MAX_RADIUS = 30;
