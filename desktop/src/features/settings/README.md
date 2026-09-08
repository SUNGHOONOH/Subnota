# Settings

## 역할

설정 화면, 앱 설정, 데스크톱 단축키와 Electron 설정 열기 요청을 담당한다.

`SettingsNav.tsx`는 설정 섹션 목록과 active 탐색 UI만 담당한다.
`SettingsPrimitives.tsx`는 설정 카드·행·행 동작·접기/펼치기 표시 primitive만 담당한다.
`SettingsShortcutRecorder.tsx`는 단축키 값·녹음·충돌·복원 컨트롤 표시만 담당한다.
`SettingsHotkeysSection.tsx`는 앱·빠른 실행 단축키 섹션과 저장/복원 액션을 조립한다.
`SettingsAboutSection.tsx`는 버전·오픈소스·약관·문의 정보를 표시한다.
`SettingsAccountSection.tsx`는 로그인 방식(제공자 아이콘 포함)·비밀번호 재설정·세션·계정 삭제 진입 표시를 담당한다.
`SettingsDeleteAccountDialog.tsx`는 계정 삭제 확인 입력·진행 상태·취소/삭제 버튼 표시를 담당한다.
`SettingsAppearanceSection.tsx`는 테마와 편집기 글자 크기·줄 간격 설정 표시를 담당한다.
`SettingsBackupSection.tsx`는 SQLite 전체 백업·복원과 캘린더·Inbox JSON 내보내기 표시를 담당한다.
`SettingsGeneralSection.tsx`는 언어·창 시작 동작·알림·메모 작성 관련 설정 표시를 담당한다.
`SettingsSyncSection.tsx`는 동기화 상태·로컬 저장소·검색 모델 상태/표시와 작업 버튼을 담당한다.
`SettingsStyles.ts`는 설정 모달의 inline CSS 문자열과 선언 순서를 보존한다.
`useDesktopPreferences.ts`는 Electron 데스크톱 설정·로컬 저장소 정보의 초기 조회와
설정 저장·저장소 선택 callback의 상태 반영을 담당한다.

## 단축키 상태

`useShortcutSettings`는 렌더러 단축키 설정과 앱 단축키 설정을 소유한다.
Electron의 전역 단축키 등록 결과와 변경 이벤트를 로컬 설정에 반영하고,
검색 및 설정 열기 요청을 기존 App 상태 setter로 전달한다.

`syncStatus.ts`는 메모·캘린더·수집함의 local-first 동기화 상태를 설정 화면에
표시할 대기/실패 숫자로 집계한다. 저장소나 네트워크를 호출하지 않는다.
`useDesktopPreferences.ts`는 데스크톱 설정과 로컬 저장소 정보의 Electron lifecycle
및 설정 화면 callback을 소유한다.

## 외부 의존성

- Electron: 전역 단축키 등록, 단축키 변경, 설정 열기 IPC
- Local storage: 단축키 설정 저장
- Supabase, Backend API, SQLite에는 직접 접근하지 않음

## 불변 조건

- Electron이 정규화한 단축키 설정을 로컬 저장소에 저장한다.
- 검색 단축키는 브라우저 기본 동작을 막고 전역 검색을 연다.
- Electron의 설정 열기 요청은 기존 설정 모달을 연다.
- 단축키 변경 구독은 unmount 시 해제한다.
- 메모·캘린더의 `pending*`과 수집함의 정확한 `pending` 판정을 기존과 동일하게 유지한다.

## 관련 테스트

- `src/__tests__/shortcut-settings.test.ts`
- `src/__tests__/global-shortcuts-main.test.ts`
- `src/__tests__/settings-grouping.test.ts`
- `src/__tests__/settings-delete-dialog.test.ts`
- `src/__tests__/hotkey-hint.test.ts`
- `src/__tests__/sync-status.test.ts`

## Windows 주의사항

전역 단축키 등록 실패 여부는 Electron이 반환한 결과를 기준으로 표시한다.
Windows 예약 단축키를 렌더러에서 임의로 성공 처리하면 안 된다.
