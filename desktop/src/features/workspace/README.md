# Workspace

## 역할

현재 메모, 탭, 분할 패널, 사이드바 상태를 사용자별 로컬 작업 공간 세션으로
저장하고 복원한다.

`AppSidePanel.tsx`는 프리뷰/일정 저장함 사이드 패널의 화면 조립과
축소·확장 애니메이션만 담당한다. 실제 패널 상태와 저장·동기화는 App에 남아 있다.

`AppNavRail.tsx`는 앱 네비게이션 rail과 접힌 상태의 reveal zone, 보기 방식 선택,
업데이트·설정 버튼을 조립한다. 현재 탭·단축키·업데이트 상태와 콜백의 소유권은
App에 남아 있다.

`AppOverlayCluster.tsx`는 전역 검색, 로컬 색인 진행, 트레이 안내, 모델 다운로드,
월간 리포트, 설정 모달의 화면 조립만 담당한다. 각 모달의 상태와 비동기 동작은
App에 남아 있다.

`AppEntryGate.tsx`는 부팅 브랜드 화면, 셸 스켈레톤, 계정 전환 게이트, 로그인
화면의 표시 순서만 담당한다. 부팅·세션 상태와 실제 작업 공간은 App이 소유한다.

`appShellPresentation.ts`는 사이드 패널의 열림·push 여부, 셸 class 순서와
표시 폭을 순수하게 계산한다. 패널 state와 resize 동작은 App에 남아 있다.

`useWindowViewport.ts`는 창 resize listener, 180ms idle timer와
`isWindowResizing` 상태를 담당한다. `windowWidth` 초기 state는 React hook 순서와
SSR fallback을 보존하기 위해 App에 남아 있다.

`useSessionSidebarToggle.ts`는 세션 사이드바 접기/펼치기와 collapse-ready timer를
담당한다. 공유 timer ref는 App과 작업 공간 복원 경로가 함께 사용하므로 App이
소유하고 hook에 주입한다.

`useScheduleInboxPanelNavigation.ts`는 일정 저장함 사이드 패널을 열고 토글하는
공통 navigation 동작을 담당한다. preview 닫기와 접힘 해제 순서를 유지한다.

`useRestoreLocalData.ts`는 명시적인 로컬 데이터 복원 요청에서 write guard, flush,
원자적 Electron 교체와 실패 시 unlock을 담당한다.

`useLocalWriteGuard.ts`는 창 닫기·백업·복원 요청에서 renderer를 inert 상태로
잠그고, 보류 중인 로컬 write를 flush한 뒤 Electron 취소 신호로 해제한다.

`syncPendingLocalWorkspace.ts`는 세션 재연결 시 성장 기록, 메모, 캘린더, 폴더,
일정 저장함, Web Inbox의 local-first outbox를 기존 도메인 순서로 조율한다.
`useLocalWorkspaceHydration.ts`는 계정별 로컬 메모·캘린더·Inbox·일정 저장함·Topics·
폴더 캐시를 병렬로 읽고, stale owner/load 결과를 버린 뒤 화면 state를 채운다.
`useWorkspaceLoader.ts`는 프로필 확인, 로컬 outbox 선행 동기화, 원격 workspace
snapshot 조회, 메모 충돌·활성 편집 보호, Inbox/Topics/폴더 tombstone 병합과 실패 시
로컬 fallback을 하나의 원격 로딩 경계로 조율한다.
`useBootLifecycle.ts`는 브랜드 단계, hard upper bound, 로컬 workspace 준비 후 화면
전환 timer만 담당한다. 인증 세션 확인과 auth subscription은 Auth 경계에 남아 있다.

## 현재 경계

`useWorkspacePersistence`는 저장만 담당한다. `useWorkspaceRestoration`은 저장된
탭·패널·사이드바·핀 상태를 App이 소유한 state에 복원한다. 계정 전환과 로컬
캐시 로드는 App에 남아 있다. 보류 outbox의 실제 도메인 처리는 각 feature hook에
남고, workspace 파일은 재연결 진입점만 조립한다.

## 불변 조건

- 부팅 중에는 작업 공간을 저장하지 않는다.
- 상태 변경 뒤 250ms 뒤에 저장한다.
- 창 종료 전에는 가장 최신 상태를 한 번 더 저장한다.
- 사용자 owner마다 별도 세션을 사용한다.
- 복원은 기존 state 초기화 순서와 기본값을 보존한다.
- 로컬 데이터 복원은 write guard를 먼저 획득하고, maintenance 표시는 원자적 교체 호출 동안에만 유지한다.
- Electron의 종료/백업 flush는 동시 guard 요청을 합치고, 모든 로컬 outbox가 비워질
  때까지 기다리며, 14초 timeout 또는 취소 시 renderer를 다시 해제한다.
- 보류 outbox는 성장 기록 → 메모 → 캘린더 → 폴더 → 일정 저장함 → Web Inbox 순서를 유지하며, 한 항목의 실패가 다른 항목의 재시도를 막지 않는다.
- workspace 동기화 coordinator는 React state나 화면을 소유하지 않고, 각 도메인의 기존 local-first 저장·tombstone·retry 규칙을 그대로 호출한다.
- 로컬 hydrate는 계정 owner와 workspace load ID를 확인한 뒤에만 state를 쓰고,
  pending 메모·Inbox tombstone 보호와 active memo 1회 복원을 유지한다.
- 원격 workspace load는 profile 확인과 local outbox flush를 먼저 수행하고, 모든 원격
  snapshot 적용 지점에서 현재 owner/load인지 재검증한다.
- 부팅은 브랜드 단계와 최대 상한을 유지하되, 로컬 workspace 준비가 끝나면 필요한
  모션만 마친 뒤 화면으로 전환하고 각 timer를 cleanup한다.
- 원격 메모 snapshot은 pending write와 활성 편집 pane을 보호하며, 늦게 도착한
  로컬 snapshot을 복구한 뒤에만 React와 SQLite에 병합한다.
- Inbox/Topics/폴더 fetch 실패(null)는 기존 로컬 캐시를 덮어쓰지 않으며, 전체 load
  실패 시에도 로컬 workspace fallback으로 화면을 유지한다.

## 관련 테스트

- `src/__tests__/workspace-session.test.ts`
- `src/__tests__/workspace-shell-layout.test.ts`
- `src/__tests__/split-pane-tabs.test.ts`
- `src/__tests__/restore-local-data.test.ts`
- `src/__tests__/local-write-guard.test.ts`
- `src/__tests__/local-workspace-hydration.test.ts`
- `src/__tests__/workspace-loader.test.ts`
- `src/__tests__/sync-pending-local-workspace.test.ts`

## Windows 주의사항

이 Hook은 종료 전 SQLite flush를 대체하지 않는다. 실제 로컬 쓰기 완료는
Electron main process의 별도 종료 보호 경로가 담당한다.
