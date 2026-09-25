# Preview

## 역할

검색·그래프·주변 메모에서 선택한 결과를 참조 패널로 보여 주고, 필요할 때
실제 메모 또는 수집함 탭으로 승격하는 흐름을 담당한다.

## 현재 경계

- `PreviewPanel.tsx`: 미리보기 패널 화면
- `usePreviewPanelResize.ts`: 패널 폭 드래그와 최종 폭 저장
- `usePreviewPanelActions.ts`: 패널 열기와 메모/Inbox 승격 이벤트
- App: 패널 상태와 split-pane 상태 소유

## 불변 조건

- 패널 열기·닫기와 폭 조절의 DOM/CSS 및 사용자 동작을 변경하지 않는다.
- 승격 custom event 이름과 `beside`/`focused` target 계산을 유지한다.
- 드래그 중 pointer cleanup과 body cursor/user-select 복원을 항상 수행한다.

## 관련 테스트

- `src/__tests__/preview-panel.test.tsx`

## Windows 주의사항

pointer 이벤트가 `pointerup`, `pointercancel`, `blur` 어느 경로로 끝나도 전역
listener와 body style이 정리되어야 다음 입력이 막히지 않는다.
