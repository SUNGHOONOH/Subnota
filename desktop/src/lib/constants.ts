// 초기 릴리스에서는 다크 모드를 전면 비활성화한다(UI 불일치 정리 전까지).
// 복원: 이 값을 true로 바꾸고 MemoSplitWorkspace 상단바에 ThemeToggle을 되돌린다.
export const DARK_MODE_ENABLED = false;

export const AMBIENT_HEADING_DELAY_MS = 3000;
export const AMBIENT_BOUNDARY_DELAY_MS = 3000;
export const AMBIENT_IDLE_DELAY_MS = 4000;
export const AMBIENT_EMPTY_NOTICE_MS = 2200;
export const AMBIENT_MIN_CHARS = 12;
// [이력] 아래 0.75/0.70은 bge-m3 + 원본 코사인 기준이었다. KLUE-STS 519쌍을
// 당시 배포 스택(Transformers.js + ONNX q8, 단건)으로 측정했고, 무관(0~1점)의
// 중앙값도 0.612라 0.58은 필터 역할을 못 했다. 0.75는 정밀도 66.9%/재현율
// 95.5%, 실제 메모 노출률 29.2%였다. 더보기 목록은 사용자가 명시적으로 열므로
// 고스트보다 넓게, 거의 무관(1~2점)의 중앙값 0.694보다 높은 0.70에서 시작했다.
//
// 지금 점수는 중심화+CSLS다. 0~1이 아니라 대략 -0.5 ~ 1.5라 위 숫자는 더
// 이상 의미가 없다. KLUE-STS 로 잡았던 0.15 도 버렸다 — KLUE 문장은 사용자
// 질의 분포 밖이라 CSLS 의 허브 벌점을 거의 안 받아 척도가 다르다.
//
// 0.10 은 실제 크기 메모(사용자 메모 89개 + 관계를 설계한 테스트 메모 38개,
// 청크 898개, 질의 16건)로 직접 재서 얻었다. 두 모델 모두 여기서 갈린다:
//
//              완전 동일 최저   최선의 오답 최고
//   bge-m3        0.113           -0.005
//   e5-small      0.102            0.023
//
// 이 틈이 이 데이터에서 **유일하게 깨끗한 경계**다. 그 아래로는 유사함
// (-0.179~0.084)·관련됨(-0.502~-0.079)·오답(-0.260~0.023)이 전부 겹쳐서
// 어떤 값으로도 못 가른다. 그래서 자동검색은 이 위만 띄우고(정밀도 우선),
// 관련 경로는 수동 검색과 수동 목록에서만 별도 순위로 보여 준다.
export const AMBIENT_MIN_SIMILARITY = 0.1;
// 더보기 목록도 유사 결과에는 같은 문턱을 적용한다. 관련 결과는 점수
// 문턱 없이 수동 검색에서만 순위로 보여 준다.
// 주변 메모는 중심화한 메모 평균끼리의 코사인이다(원래 코사인과 척도가 다르다).
// 메모 73개 손라벨 측정: 다른 주제 쌍 90%가 0.17 아래, 같은 주제 중앙값 0.23.
// 사용자가 직접 연 목록이라 넉넉하게 0.10부터 보여 준다.
export const NETWORK_MIN_SIMILARITY = 0.1;

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
