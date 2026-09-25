# App Update

## 역할

데스크톱 앱의 업데이트 확인, 다운로드 시작, 설치 이벤트 구독과 사용자에게
표시할 업데이트 상태 전이를 담당한다.

## 소유 상태

현재 `App.tsx`가 `UpdateState`와 업데이트 팝오버 표시 상태를 소유한다.
`useAppUpdate`는 이 상태의 setter를 받아 기존 상태 전이를 그대로 실행한다.
React Hook 호출 순서를 보존하기 위한 과도기적 경계다.
`updateActionPresentation.ts`는 상태를 네비게이션용 표시값으로만 변환한다.

## 외부 입력과 반환 API

- 입력: 자동 확인 설정, Windows 배포 여부, UI 언어, 업데이트 상태와 setter
- 반환: `checkForAvailableUpdate`, `startAvailableUpdate`

## 외부 의존성

`window.electronAPI`의 업데이트 확인, 다운로드, 설치 및 이벤트 구독 API를
사용한다. Supabase, Backend API, SQLite에는 접근하지 않는다.

## 데이터 흐름

1. 자동 확인 설정 또는 설정 화면의 수동 확인으로 새 버전을 조회한다.
2. 새 버전이 있으면 `available` 상태로 전환한다.
3. 사용자가 업데이트를 누르면 `downloading`으로 전환한다.
4. Electron이 다운로드 완료를 알리면 `installing`으로 전환하고 설치한다.
5. 실패하면 기존 업데이트 정보와 함께 `error` 상태를 표시한다.

## 불변 조건

- 업데이트가 없으면 팝오버를 열지 않는다.
- 동일한 Electron 이벤트 구독과 해제 순서를 유지한다.
- Windows와 macOS의 설치 불가 안내 문구를 유지한다.
- 설치 이벤트를 받기 전에는 `installUpdate`를 호출하지 않는다.

## 관련 테스트

- `src/__tests__/update-checker.test.ts`
- `src/__tests__/auto-updater.test.ts`
- `src/__tests__/workspace-shell-layout.test.ts`

## Windows 주의사항

설치본이 자동 업데이트를 지원하지 않을 때 EXE 재설치 안내를 표시한다.
이 분기와 문구는 macOS DMG 안내와 합치지 않는다.
