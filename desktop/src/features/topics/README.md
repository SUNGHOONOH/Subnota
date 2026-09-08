# Topics

## 역할

자동 생성된 Topic 지도 데이터를 화면 상태로 반영한다.
`useTopicRegeneration.ts`는 사용자가 명시적으로 누른 전면 재생성 요청을 서버에서
수행하고, 새 지도 fetch → owner별 로컬 캐시 저장 → 화면 state 적용 순서를 담당한다.

## 불변 조건

- 서버·로컬 캐시의 TopicMapData를 받는 순서와 저장 시점은 regeneration hook이 유지한다.
- 지도 상태를 비울 때 모든 Topic 관련 배열과 업데이트 시각을 함께 초기화한다.
- 그래프·Topic rail·탭 UI는 이 Hook에 포함하지 않는다.
- 자동 재생성은 하지 않으며, 로그인 상태에서 사용자가 누른 명시적 요청만 실행한다.
