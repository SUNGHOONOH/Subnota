# Quick Subnota

## 역할

트레이와 Quick Subnota의 표시 규칙, 빠른 메모 입력 화면을 담당한다.

## 현재 경계

- `MiniComposer.tsx`: 빠른 메모·링크 입력 화면과 로컬 초안 표시
- `trayPresentation.ts`: 최근 Inbox 항목 정규화, 저장/실패 문구, 트레이 라벨 축약
- `mini-subnota.ts`: Quick Subnota 창과 브라우저 캡처 runtime
- `main.ts`: Electron 트레이 생성·메뉴 조립과 IPC wiring

## 불변 조건

- 최근 Inbox 항목은 웹 URL 정책과 제목·출처 길이 제한을 그대로 따른다.
- 저장 결과와 캡처 실패 문구의 한국어/영어 분기는 기존 UI 언어와 일치해야 한다.
- 트레이 라벨 축약은 한 글자의 줄임표를 포함해 기존 최대 길이를 보존한다.
- 트레이 표시 규칙은 Electron API나 전역 상태를 직접 읽지 않고 입력 인자로만 계산한다.
- Quick Subnota의 로컬 초안 키와 MiniSubnota 저장 카테고리는 변경하지 않는다.

## 관련 테스트

- `src/__tests__/tray-presentation.test.ts`
- `src/__tests__/web-clip-focus.test.ts`
- `src/__tests__/windows-link-capture.test.ts`
- `src/__tests__/mini-composer-layout.test.ts`

## Windows 주의사항

Windows에서는 현재 브라우저 자동 조회 대신 링크 입력 경로를 사용하며, 트레이 메뉴와
작업 표시줄 점프 리스트가 Quick Subnota의 진입점 역할을 한다. 이 경로의 IPC·창
생명주기는 `main.ts`와 `mini-subnota.ts`에 남겨 둔다.
