# Inbox

## 역할

수집한 링크·이미지·텍스트 Inbox 항목의 화면과 로컬/원격 병합 규칙을 담당한다.
`useInboxLikeActions.ts`는 좋아요 optimistic 반영, 원격 응답 reconciliation,
최신 revision 보호와 로컬 캐시 반영을 담당한다. `useInboxRefresh.ts`는 로컬
queue와 원격 Inbox 새로고침, 요청 최신성 보호를 담당하고, `useInboxSummaryActions.ts`는
선택한 항목의 요약 재생성과 캐시 반영을 담당한다. `useInboxItemActions.ts`는 사용자의
저장·삭제 요청을 담당하고, App은 이 action과 화면 상태를 조립한다. 보류 중인
생성·삭제 재전송은 `syncPendingInboxItems.ts`가 담당한다.
`useInboxTombstoneActions.ts`는 느린 원격 생성·목록 응답이 삭제된 항목을 되살리지
못하도록 client-id tombstone 재시도와 서버 삭제 후 로컬 정리를 담당한다.
`useInboxCaptureSubscription.ts`는 Electron 메뉴바·전역 단축키 캡처 이벤트를
최신 저장/탭 이동 callback으로 연결하고 OS 알림을 표시한다.

## 현재 경계

- `syncPendingInboxItems.ts`: 세션 활성화 때 Web Inbox tombstone과 로컬 생성 큐를 client id 기반으로 재전송
- `inboxState.ts`: 원격·로컬 항목 병합, 삭제 대기 항목 제외, stale 좋아요 응답 보정
- `useInboxLikeActions.ts`: 좋아요 optimistic 동작과 응답 보정
- `useInboxRefresh.ts`: Inbox 목록 새로고침과 요청 최신성 보호
- `useInboxSummaryActions.ts`: 선택 항목 요약 재생성 및 캐시 반영
- `useInboxItemActions.ts`: 링크 저장·삭제, 로컬 우선 반영, 삭제 tombstone과 서버 동기화
- `useInboxTombstoneActions.ts`: pending-delete tombstone 대기·재시도와 server/client id 정리
- `useInboxCaptureSubscription.ts`: Electron 웹 캡처 구독, 저장 결과 알림, 수집함 열기 연결
- `InboxWorkspace.tsx`: Inbox 화면
- App: React 상태와 각 Inbox action의 wiring

## 불변 조건

- pending-delete tombstone은 서버 삭제가 확인될 때까지 로컬에서 숨겨 두며, client id로 느린 생성 요청과 삭제 race를 안전하게 마무리한다.
- 로컬 생성 큐는 서버 생성 후 캐시에 먼저 저장하고, 생성·캐시·큐 제거 사이마다 삭제 여부를 다시 확인한다.
- 한 Inbox 항목의 실패는 다른 항목의 재시도를 막지 않으며, 실패한 큐와 tombstone은 다음 연결에서 다시 시도한다.
- 원격에 반영되지 않은 로컬 항목은 최신 생성 시각 순으로 보인다.
- `pending_delete`인 항목은 원격 결과가 다시 도착해도 화면에 되살아나지 않는다.
- 사용자의 아직 반영되지 않은 좋아요 의도는 오래된 원격 응답으로 덮어쓰지 않는다.
- 원격 저장·로컬 캐시·삭제 재시도 순서는 이 단계에서 바꾸지 않는다.
- tombstone은 서버 삭제가 확인된 뒤에만 client-id/server-id 매핑과 로컬 캐시에서 제거한다.

## 관련 테스트

- `src/__tests__/inbox-state.test.ts`
- `src/__tests__/inbox-service.test.ts`
- `src/__tests__/inbox-item-actions.test.ts`
- `src/__tests__/inbox-tombstone-actions.test.ts`
- `src/__tests__/inbox-capture-subscription.test.ts`

## Windows 주의사항

캡처 구독은 Electron listener를 한 번만 설치하고 ref로 최신 callback을 사용한다.
Windows 전역 단축키나 트레이에서 들어온 payload를 렌더러가 직접 재구독하거나
중복 저장하지 않도록 이 경계를 유지한다.
