# Schedule

## 역할

일정 저장함(Schedule Inbox)에서 캘린더 일정으로 배치하거나 사용자가 dismiss하는 흐름을 담당한다.

## 현재 경계

- `scheduleInboxUtils.ts`: 일정 저장함 날짜·상태 partition과 표시용 projection
- `useScheduleInboxItemActions.ts`: 일정 배치·삭제·캘린더 드롭의 local-first action과 Cloud 상태 반영
- `ScheduleInboxWorkspace.tsx`: 일정 저장함 목록·편집 시트·배치 UI

## 불변 조건

- 일정 배치와 삭제는 로그인 세션이 없으면 실행하지 않는다.
- 배치·삭제는 로컬 outbox와 캐시를 먼저 반영한 뒤 현재 세션이 유효할 때만 화면에서 항목을 제거한다.
- Cloud 상태 반영은 기존 `updateScheduleInboxStatus`를 best-effort로 호출하고, 실패해도 로컬 action을 잃지 않는다.
- 캘린더 드롭은 일반 배치와 동일한 저장 흐름을 사용하며 1시간 기본 종료 시각과 timed 이벤트 규칙을 보존한다.

## 관련 테스트

- `src/__tests__/schedule-inbox-item-actions.test.ts`
- `src/__tests__/schedule-inbox-workspace.test.ts`
- `src/__tests__/schedule-from-selection.test.ts`
- `src/__tests__/schedule-confirm-selection.test.ts`

## Windows 주의사항

이 경계는 브라우저 입력과 로컬 저장소를 함께 사용하므로, 드롭 직후 창 전환·세션 만료에서도 로컬 action이 남는지 확인한다.
