# Calendar

## 역할

캘린더 화면, 일정 카테고리, 드래그·리사이즈·날짜 변환 규칙을 담당한다.

## 현재 경계

- `syncPendingCalendarBlocks.ts`: 재연결·세션 활성화 때 보류 중인 일정 저장/삭제를 keyed queue로 재전송
- `useCalendarCompletionActions.ts`: 일정 완료 optimistic 저장과 활동·일일 성장 기록 생성/동기화
- `useDeleteCalendarBlock.ts`: 일정 삭제 확인·optimistic tombstone·Cloud queue와 실패 원복
- `useSaveCalendarBlock.ts`: 일정 draft 정규화, local-first 저장, keyed Cloud upsert와 실패 표시
- `useCalendarCategoryActions.ts`: 카테고리 생성·정렬과 일정 재분류 후 카테고리 삭제
- `CalendarWorkspace.tsx`: 캘린더 화면과 사용자 입력
- `components/CalendarHeader.tsx`: 캘린더 보기 전환·이동·저장함·월간 기록 헤더
- `components/CalendarMonthTodoArea.tsx`: 월간 할 일 요약 패널과 상세 overlay
- `components/CalendarCategoryPicker.tsx`: 일정 편집기의 카테고리 선택·생성·삭제와 색상 picker 표시
- `components/CalendarEventEditorModal.tsx`: 일정·일정 제안 편집 모달의 표시와 입력 이벤트 연결
- `components/CalendarMonthView.tsx`: 월간 날짜 셀·일정/제안 표시와 overflow 조립
- `calendarUtils.ts`: 날짜·시간·드래그 위치, 날짜별 일정 projection, 이벤트 표시·레이아웃의 순수 계산
- `calendarCategories.ts`: 카테고리 표시 규칙
- App: 일정 action과 화면 상태의 wiring

## 불변 조건

- 보류 일정은 id별 keyed mutation queue에 등록하며, 최신 mutation이 아니면 Cloud 결과를 로컬에 반영하지 않는다.
- `pending_delete` 일정은 삭제 후 로컬 행을 제거하고, 그 외 일정은 서버 upsert 후 로컬 상태를 `synced`로 전진시킨다.
- 한 일정의 실패는 다른 일정의 재시도를 막지 않으며 실패한 행은 다음 연결 시 다시 시도할 수 있다.
- 완료 기록은 로컬 durable write가 먼저 끝난 뒤 Cloud를 best-effort로 전달하며, 완료 취소나 일정 삭제로 기존 성장 기록을 제거하지 않는다.
- 일정 삭제는 사용자 확인 뒤 로컬 tombstone을 먼저 기록하고, 로컬 저장 실패 시 화면을 원복하며 Cloud 삭제 실패 시 tombstone을 유지한다.
- 일정 저장은 기존 ID·종일 날짜·종료 시각을 정규화한 뒤 로컬 pending 행을 먼저 반영하고, 같은 일정의 Cloud upsert는 keyed queue와 최신/session guard 뒤에서 수행한다.
- 종일 일정 날짜는 사용자의 로컬 날짜 기준 `YYYY-MM-DD`로 저장한다.
- 드래그·리사이즈 계산은 저장된 실제 시간값을 임의로 반올림하지 않는다.
- 화면과 저장소 호출은 이 유틸 파일에 두지 않는다.
- 이벤트 레이아웃과 표시 톤 계산은 입력값만으로 결과를 반환하며 React 상태나 DOM을 직접 읽지 않는다.
- 날짜별 일정·제안 필터와 드롭 충돌 계산은 로컬 날짜 판정, 기존 정렬 순서, 종일/시간 일정 구분을 보존한다.

## 관련 테스트

- `src/__tests__/calendar-move.test.ts`
- `src/__tests__/calendar-completion-actions.test.ts`
- `src/__tests__/delete-calendar-block.test.ts`
- `src/__tests__/save-calendar-block.test.ts`
- `src/__tests__/calendar-category-actions.test.ts`
- `src/__tests__/calendar-completion.test.ts`
- `src/__tests__/calendar-category-picker.test.ts`

## Windows 주의사항

날짜 변환은 OS 로컬 시간대를 사용한다. UTC 문자열의 날짜 부분만 잘라 저장하면
서머타임 또는 시간대 차이로 종일 일정이 하루 밀릴 수 있다.
