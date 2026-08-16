// 초기 릴리스에서는 다크 모드를 전면 비활성화한다(UI 불일치 정리 전까지).
// 복원: 이 값을 true로 바꾸고 MemoSplitWorkspace 상단바에 ThemeToggle을 되돌린다.
export const DARK_MODE_ENABLED = false;

export const AMBIENT_HEADING_DELAY_MS = 5000;
export const AMBIENT_BOUNDARY_DELAY_MS = 5000;
export const AMBIENT_IDLE_DELAY_MS = 5000;
export const AMBIENT_EMPTY_NOTICE_MS = 2200;
export const AMBIENT_MAX_RESULT_COUNT = 1;
export const AMBIENT_MIN_CHARS = 12;
// KLUE-STS 519쌍을 배포 스택(Transformers.js + ONNX q8, 단건)으로 측정했다.
// 무관(0~1점)의 중앙값도 0.612라 0.58은 필터 역할을 못 했다. 0.75는
// 정밀도 66.9%/재현율 95.5%, 실제 메모 노출률 29.2%로 주제 연관성을 보존한다.
export const AMBIENT_MIN_SIMILARITY = 0.75;
// 더보기 목록은 사용자가 명시적으로 열므로, 고스트보다 조금 넓게 보여 준다.
// 거의 무관(1~2점) 문장쌍의 중앙값 0.694보다 높은 0.70에서 시작한다.
export const AMBIENT_LIST_MIN_SIMILARITY = 0.7;
export const NETWORK_MIN_SIMILARITY = 0.35;

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
