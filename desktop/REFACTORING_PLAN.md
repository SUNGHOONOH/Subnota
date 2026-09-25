# Desktop 무동작 구조 분리 계획 및 진행 상태

> 문서 기준일: 2026-09-08
>
> 현재 상태: 기능 단위 구조 분리는 완료했고, UI/UX와 저장 계약에 직접 영향을
> 줄 수 있는 고결합 경계는 보류한다.

## 목표

`desktop`의 큰 파일을 기능 단위 경계로 나누되 사용자 동작, UI, 저장 형식,
네트워크 계약을 변경하지 않는다. 목표는 파일 줄 수의 최소화가 아니라 책임과
검증 경계를 분리하는 것이다. 한 번에 한 기능만 이동하고 검증을 통과한 뒤
다음 단계로 진행한다.

## 불변 조건

- 기능, UI, 문구, 스타일을 추가하거나 제거하지 않는다.
- Supabase 스키마, API 요청 형식, SQLite 레코드 형식을 변경하지 않는다.
- 패키지를 추가하거나 상태 관리 방식을 교체하지 않는다.
- 기존 공개 export와 Electron 진입점은 호환 facade로 유지한다.
- 리팩터링 중 발견한 별도 버그는 같은 단계에서 수정하지 않는다.
- Effect와 Hook의 호출 순서를 유지한다.
- 단계마다 전체 테스트 수가 줄지 않았는지 확인한다.
- CSS 선언 순서·토큰 값·선택자 결과를 변경하지 않는다.
- 분리 후에도 parent는 도메인 조립 역할을 유지하며 wrapper-only 파일을 만들지 않는다.

## 단계별 검증

작은 기능 또는 함수 이동마다 아래 최소 검증을 통과해야 다음 단계로 진행한다.

```bash
cd desktop
pnpm exec tsc --noEmit
pnpm exec vitest run <관련 테스트>
pnpm exec eslint <변경한 ts/tsx 파일>
git diff --check
```

전체 Vitest는 저위험 기능이 누적됐을 때와 고위험 기능을 이동했을 때 실행한다.
프로덕션 번들은 import 경계, 정적 asset, Electron entry/preload를 변경했을
때와 각 대형 파일 분리 완료 시 실행한다.

다음 항목은 매 이동마다 전체 테스트를 실행하는 고위험 영역이다.

- 메모 로컬·클라우드 동기화와 삭제
- 작업 공간 복원
- Electron `main.ts`와 `preload.ts`
- SQLite Worker와 백업 복원
- Supabase 및 로컬 저장소 facade
- CSS 선언 순서 변경

역사적 기준선은 2026-09-07 현재 Vitest 98개 파일, 834개 테스트 통과였다.
ESLint에는 기존 `renderer.tsx`의 `posthog` import 경고 1개가 있으며 오류는 없다.

현재 검증 스냅샷(2026-09-08): Vitest 166개 파일, 1,170개 테스트가 통과했다.
따라서 현재 테스트 규모는 "테스트 파일 1,000개"가 아니라 테스트 파일 166개와
테스트 케이스 1,170개로 구분해서 기록한다.

백엔드 전체 검증 스냅샷(2026-09-08): pytest 36개 테스트가 통과했다.

## 구현 순서

### 1. `App.tsx`

- [x] 앱 업데이트 상태와 동작
- [x] 임베딩 모델 다운로드
- [x] 설정과 단축키
- [x] Inbox
- [x] 월간 리포트 상태와 계산
- [x] 주변 메모 검색
- [x] Topics
- [x] 사용자 폴더
- [x] 탭과 분할 화면 핵심 action·lifecycle·pane UI
- [x] 작업 공간 저장과 종료 전 저장
- [x] 작업 공간 복원
- [x] 메모 CRUD
- [x] 메모 로컬·클라우드 동기화
- [ ] 최종 App shell 조립 (wrapper-only extraction은 보류)

메모 동기화·작업 공간 복원 경계는 데이터 유실 위험이 가장 크므로 이동 후에도
전체 Vitest와 build를 다시 실행했다. 추가로 저장 facade 자체를 쪼개는 작업은
현재 범위에서 진행하지 않는다.

### 2. 대형 화면 컴포넌트

- [x] `MemoSplitWorkspace.tsx` 기능별 pane·메뉴·overlay·action 분리
- [x] `SettingsModal.tsx` 섹션·primitive·스타일·dialog 분리
- [x] `CalendarWorkspace.tsx` 월간 화면·header·editor·action 분리
- [x] `MemoWorkspace.tsx` 폴더·시간순 사이드바·메뉴 분리

각 parent 파일에는 여러 기능을 조립하는 코드가 남아 있다. 주간 시간 그리드와
Tiptap 본문처럼 상태·effect·DOM 이벤트가 하나의 흐름으로 결합된 부분은
추가 분리하지 않는다.

### 3. Electron과 데이터 계층

- [ ] `main.ts` (lifecycle·tray 설치 경계 보류)
- [ ] `services/local/offlineStore.ts` (로컬 저장 계약 보류)
- [ ] `services/supabase/data.ts` (facade 계약 보류)
- [ ] `local-database.ts` (Worker·종료 안전성 보류)

이 네 항목은 현재 기능 단위 구조 분리의 다음 단계가 아니다. 별도 장애 재현,
계약 테스트, Electron 종료 시나리오 검증을 먼저 마련한 뒤 독립 과제로 다룬다.

### 4. 스타일

- [x] 디자인 토큰 partial 유지 (`_color-tokens.scss`, `_variables.scss`, `_fonts.scss`, `_keyframe-animations.scss`)
- [x] 독립 컴포넌트 스타일 유지 (`features/mini/MiniComposer.scss`, Tiptap 구성요소별 SCSS)
- [x] Settings 모달 전용 스타일 경계 분리 (`features/settings/SettingsStyles.ts`)
- [ ] `styles/subnota-workspace.scss`를 기능별 partial로 이동 (선언 순서·시각 회귀 검증 필요)

`index.scss`는 `fonts → variables → keyframe-animations → subnota-workspace`
순서로 import한다. `subnota-workspace.scss`는 약 11,500줄의 전역 workspace
스타일을 포함하므로, 이 파일의 전체 partial화는 별도의 시각 회귀 검증 없이는
진행하지 않는다. 스타일 선언을 옮기더라도 토큰 값·선언 우선순위·선택자 결과는
변경하지 않는 것이 불변 조건이다.

현재 스타일 계층은 다음과 같다.

1. 디자인 토큰: 색상·변수·폰트·keyframe partial
2. 전역 workspace: `subnota-workspace.scss`
3. 기능/컴포넌트 전용: Mini Composer, Settings modal, Tiptap 구성요소 SCSS

따라서 스타일은 토큰과 독립 컴포넌트까지 분리되어 있고, 전역 workspace
partial화만 시각 회귀 검증 대기 상태다.

## 추가 분리 보류 판단 (2026-09-08)

현재까지 기능 단위로 안전하게 이동할 수 있는 경계를 우선 분리했다. 다음 영역은
코드가 크다는 이유만으로 더 쪼개면 prop 전달량과 effect 의존성이 급격히 늘어
UI·UX 또는 동작 보존 조건을 위반할 가능성이 높아 보류한다.

| 영역 | 보류 이유 |
|---|---|
| `CalendarWorkspace.tsx` 주간 시간 그리드 | `ResizeObserver`, DOM 좌표, pointer/drag 상태, 일정 저장 callback이 한 기능 흐름으로 강하게 결합되어 있다. |
| `MemoSplitWorkspace.tsx` Tiptap 본문 | Tiptap, ambient 검색, 선택 영역, 일정 등록, 저장 상태, 탭 메뉴가 같은 effect·ref를 공유한다. |
| `App.tsx` 최종 Shell wrapper | App은 이미 기능 조립을 담당하는 composition root다. wrapper만 추가하면 구조 이득 없이 prop/context 경계가 늘어난다. |
| `main.ts`, `local-database.ts`, `offlineStore.ts`, Supabase facade | Electron lifecycle, Worker 종료 안전성, 저장 계약과 직접 연결되어 있어 별도 동작 검증 없이는 이동하지 않는다. |
| 전체 SCSS partial화 | import·선언 순서가 곧 화면 결과이므로 구조 분리 완료 후 별도 시각 회귀 검증이 필요하다. |

따라서 위 영역은 기능을 잃지 않고 유지보수성을 높이는 이번 범위의 안전한 다음
단계로 보지 않는다. 새 기능 변경이나 별도 회귀 재현이 생길 때 해당 경계를
독립적으로 다룬다.

## 기능 문서 규칙

분리되는 각 기능 폴더에는 `README.md`를 두고 다음 내용을 기록한다.

1. 역할과 범위
2. 소유하는 상태와 ref
3. 외부 입력과 반환 API
4. 로컬 DB, Supabase, Backend 의존성
5. 주요 데이터 흐름
6. 깨지면 안 되는 불변 조건
7. 관련 테스트
8. Windows에서 주의할 동작

## 전체 진행 요약

| 구분 | 상태 | 근거 |
|---|---|---|
| 기능 단위 이동 | 완료 | 진행 기록의 124개 기능 경계가 모두 완료 상태 |
| `App.tsx` 조립 경계 | 완료에 가까움 | 업데이트·검색·Inbox·Topics·폴더·탭/split·동기화 Hook과 화면 조립 분리 |
| 대형 화면 내부 경계 | 완료에 가까움 | Memo·Settings·Calendar의 독립 pane/section/action/component 분리 |
| 스타일 구조 | 부분 완료 | 토큰·독립 컴포넌트·Settings 스타일 분리, 전역 SCSS partial화는 보류 |
| Electron·저장 계층 | 보류 | lifecycle·Worker·저장 계약과 결합되어 별도 과제로 유지 |
| UI/UX 보존 | 확인 완료 | renderer build 및 정적 회귀 테스트 통과 |

주요 parent 파일은 기능 조립을 위해 남겨두며, 줄 수 자체를 0에 가깝게 만드는
것을 완료 기준으로 삼지 않는다.

| 파일 | 기준선 | 현재 | 이동 후 남은 역할 |
|---|---:|---:|---|
| `App.tsx` | 5,829줄 | 1,800줄 | 전역 상태 연결·기능 조립 |
| `features/settings/SettingsModal.tsx` | 2,804줄 | 800줄 | 설정 섹션 조립·모달 생명주기 |
| `features/calendar/CalendarWorkspace.tsx` | 2,337줄 | 1,469줄 | 보기 전환·주간 그리드 조립 |
| `features/memo/components/MemoSplitWorkspace.tsx` | 3,095줄 | 1,549줄 | pane·Tiptap 본문 조립 |
| `features/memo/MemoWorkspace.tsx` | 601줄 | 278줄 | 메모 화면 조립 |

## 진행 기록

| 단계 | 상태 | 검증 | 비고 |
|---|---|---|---|
| 기준선 | 완료 | 98 files / 834 tests | 기능 변경 전 기준 |
| 앱 업데이트 분리 | 완료 | 98 files / 834 tests, typecheck, lint, renderer build | `features/update/useAppUpdate.ts` |
| 임베딩 모델 다운로드 분리 | 완료 | 관련 4 files / 89 tests, typecheck, changed-file lint | `features/search/useEmbeddingModelDownload.ts` |
| 단축키 상태·구독·저장 분리 | 완료 | 98 files / 834 tests, typecheck, lint, renderer build | `features/settings/useShortcutSettings.ts` |
| 월간 리포트 상태와 계산 분리 | 완료 | 관련 2 files / 21 tests, typecheck, changed-file lint | `features/report/useMonthlyReport.ts` |
| 작업 공간 저장과 종료 전 저장 분리 | 완료 | 관련 4 files / 35 tests, 누락 3 files / 48 tests, typecheck, lint, renderer build | `features/workspace/useWorkspacePersistence.ts` (전체 병렬 Vitest는 시스템 임시 저장소 ENOSPC로 3 suite 미시작, 해당 suite는 단일 워커로 재통과) |
| Inbox 병합·삭제 대기 상태 계산 분리 | 완료 | 관련 3 files / 24 tests, typecheck, changed-file lint | `features/inbox/inboxState.ts` |
| 분할 패널 상태 규칙 분리 | 완료 | 관련 3 files / 22 tests, typecheck, changed-file lint | `features/memo/splitPaneState.ts` |
| 메모 Cloud 동기화 입력 규칙 분리 | 완료 | 관련 4 files / 19 tests, typecheck, changed-file lint, 전체 100 files / 839 tests | `features/memo/memoCloudSync.ts` |
| 인증 세션 확인·초기 동기화 대기 분리 | 완료 | 관련 4 files / 58 tests, typecheck, changed-file lint | `features/auth/bootSession.ts` |
| Calendar 종일 일정 날짜 변환 분리 | 완료 | 관련 4 files / 34 tests, typecheck, changed-file lint | `features/calendar/calendarUtils.ts` |
| 작업 공간 복원 콜백 분리 | 완료 | 관련 5 files / 80 tests, typecheck, changed-file lint, 전체 100 files / 840 tests, lint, renderer build | `features/workspace/useWorkspaceRestoration.ts` |
| Inbox 오래된 좋아요 응답 보정 분리 | 완료 | 관련 3 files / 26 tests, typecheck, changed-file lint | `features/inbox/inboxState.ts` |
| 현재 인증 세션 판정 분리 | 완료 | 관련 4 files / 13 tests, typecheck, changed-file lint | `features/auth/sessionIdentity.ts` |
| Topics 지도 상태 적용·초기화 분리 | 완료 | 관련 6 files / 59 tests, typecheck, changed-file lint | `features/topics/useTopicMapState.ts` |
| 사용자 폴더 메타데이터 동작 분리 | 완료 | 관련 3 files / 37 tests, typecheck, 전체 101 files / 843 tests, lint, renderer build | `features/memo/useMemoFolderMetadataActions.ts` |
| 사용자 폴더 수동 membership 동작 분리 | 완료 | 관련 3 files / 37 tests, typecheck, changed-file lint, 전체 101 files / 843 tests | `features/memo/useMemoFolderMembershipActions.ts` |
| MemoSplitWorkspace TopicsPane 분리 | 완료 | 관련 4 files / 95 tests, typecheck, 전체 lint, renderer build | `features/memo/components/TopicsPane.tsx` |
| MemoSplitWorkspace NearbyNotesPane 분리 | 완료 | 관련 5 files / 108 tests, typecheck, 전체 101 files / 843 tests, lint, renderer build | `features/memo/components/NearbyNotesPane.tsx` |
| MemoSplitWorkspace 상단 명령 바 분리 | 완료 | 관련 4 files / 72 tests, typecheck, 변경 파일 lint, diff check | `features/memo/components/SplitWorkspaceCommandBar.tsx` |
| App 사이드 패널 화면 조립 분리 | 완료 | 관련 3 files / 57 tests, typecheck, 변경 파일 lint, diff check | `features/workspace/AppSidePanel.tsx` |
| App 네비게이션 rail 분리 | 완료 | 관련 2 files / 17 tests, typecheck, 변경 파일 lint, diff check | `features/workspace/AppNavRail.tsx` |
| App 오버레이·모달 조립 분리 | 완료 | 관련 4 files / 43 tests, typecheck, 변경 파일 lint, diff check | `features/workspace/AppOverlayCluster.tsx` |
| MemoWorkspace 표시 규칙 유틸 분리 | 완료 | 관련 3 files / 16 tests, typecheck, 변경 파일 lint, diff check | `features/memo/memoWorkspaceUtils.ts` |
| Calendar 표시·레이아웃 유틸 통합 | 완료 | 관련 4 files / 37 tests, typecheck, 변경 파일 lint, diff check | `features/calendar/calendarUtils.ts` |
| MemoSplitWorkspace 탭·에디터 순수 유틸 분리 | 완료 | 관련 6 files / 82 tests, typecheck, 변경 파일 lint, diff check, 전체 103 files / 853 tests | `features/memo/memoSplitWorkspaceUtils.ts` |
| MemoWorkspace 메모 컨텍스트 메뉴 분리 | 완료 | 관련 5 files / 38 tests, typecheck, 변경 파일 lint, diff check, 전체 103 files / 853 tests | `features/memo/components/MemoContextMenu.tsx` |
| Calendar 날짜별 표시 projection 분리 | 완료 | 관련 4 files / 69 tests, typecheck, 변경 파일 lint, diff check | `features/calendar/calendarUtils.ts` |
| App editor 생성·pane patch 유틸 연결 | 완료 | 관련 6 files / 43 tests, typecheck, 변경 파일 lint, diff check, 전체 104 files / 861 tests, lint, renderer build | `features/memo/memoSplitWorkspaceUtils.ts` |
| 설정 동기화 상태 집계 분리 | 완료 | 관련 4 files / 43 tests, typecheck, 변경 파일 lint, diff check, 전체 104 files / 861 tests, lint, renderer build | `features/settings/syncStatus.ts` |
| MemoSplitWorkspace 출처 본문 분리 | 완료 | 관련 5 files / 95 tests, typecheck, 변경 파일 lint, diff check, 전체 104 files / 862 tests | `features/memo/components/SourcePaneBody.tsx` |
| MemoSplitWorkspace 관련 문장 카드 분리 | 완료 | 관련 3 files / 76 tests, typecheck, 변경 파일 lint, diff check | `features/memo/components/RelatedSentenceCard.tsx` |
| MemoSplitWorkspace 새 탭 보기 선택 UI 분리 | 완료 | 관련 3 files / 63 tests, typecheck, 변경 파일 lint, diff check, 전체 104 files / 865 tests | `features/memo/components/MemoSplitPaneViewPicker.tsx` |
| MemoWorkspace 폴더 작업 메뉴 분리 | 완료 | 관련 3 files / 71 tests, typecheck, 변경 파일 lint, diff check, 전체 104 files / 866 tests | `features/memo/components/MemoFolderActionsMenu.tsx` |
| MemoWorkspace 폴더 추천·검토 UI 분리 | 완료 | 관련 3 files / 72 tests, typecheck, 변경 파일 lint, diff check, 전체 104 files / 867 tests | `features/memo/components/MemoFolderRecommendations.tsx` |
| MemoWorkspace 시간순 메모 사이드바 분리 | 완료 | 관련 5 files / 84 tests, typecheck, 변경 파일 lint, diff check, 전체 104 files / 869 tests | `features/memo/components/MemoTimeSidebar.tsx` |
| MemoSplitWorkspace 탭 메뉴 드롭다운 분리 | 완료 | 관련 3 files / 79 tests, typecheck, 변경 파일 lint, diff check, 전체 104 files / 870 tests | `features/memo/components/MemoSplitPaneMenu.tsx` |
| Calendar 현지화 표시 규칙 분리 | 완료 | 관련 4 files / 44 tests, typecheck, 변경 파일 lint, diff check, 전체 104 files / 872 tests | `features/calendar/calendarUtils.ts` |
| Calendar 헤더·보기 전환 툴바 분리 | 완료 | 관련 6 files / 69 tests, typecheck, 변경 파일 lint, diff check, 전체 105 files / 874 tests | `features/calendar/components/CalendarHeader.tsx` |
| Calendar 월간 할 일 영역·상세 overlay 분리 | 완료 | 관련 5 files / 63 tests, typecheck, 변경 파일 lint, diff check, 전체 106 files / 876 tests | `features/calendar/components/CalendarMonthTodoArea.tsx` |
| Calendar 기간 제목 계산 규칙 분리 | 완료 | 관련 4 files / 62 tests, typecheck, 변경 파일 lint, diff check, 전체 106 files / 878 tests, lint, renderer build | `features/calendar/calendarUtils.ts` |
| 업데이트 네비게이션 표시 계산 분리 | 완료 | 관련 4 files / 34 tests, typecheck, 변경 파일 lint, diff check, 전체 107 files / 884 tests, lint, renderer build | `features/update/updateActionPresentation.ts` |
| App 부팅·세션 진입 게이트 분리 | 완료 | 관련 5 files / 74 tests, typecheck, 변경 파일 lint, diff check, 전체 108 files / 889 tests, lint, renderer build | `features/workspace/AppEntryGate.tsx` |
| App 사이드 패널 셸 표시 projection 분리 | 완료 | 관련 5 files / 34 tests, typecheck, 변경 파일 lint, diff check, 전체 109 files / 893 tests, lint, renderer build | `features/workspace/appShellPresentation.ts` |
| Inbox 좋아요 optimistic 동작 분리 | 완료 | 관련 4 files / 32 tests, typecheck, 변경 파일 lint, diff check, 전체 109 files / 893 tests, lint, renderer build | `features/inbox/useInboxLikeActions.ts` |
| Inbox 새로고침·최신성 보호 분리 | 완료 | 관련 4 files / 26 tests, typecheck, 변경 파일 lint, diff check, 전체 109 files / 893 tests, lint, renderer build | `features/inbox/useInboxRefresh.ts` |
| Inbox 요약 재생성 동작 분리 | 완료 | 관련 4 files / 27 tests, typecheck, 변경 파일 lint, diff check, 전체 109 files / 894 tests, lint, renderer build | `features/inbox/useInboxSummaryActions.ts` |
| Preview 패널 폭 조절 interaction 분리 | 완료 | 관련 2 files / 29 tests, typecheck, 변경 파일 lint, diff check, 전체 109 files / 894 tests, lint, renderer build | `features/preview/usePreviewPanelResize.ts` |
| Preview 열기·승격 action 분리 | 완료 | 관련 2 files / 30 tests, typecheck, 변경 파일 lint, diff check, 전체 109 files / 895 tests, lint, renderer build | `features/preview/usePreviewPanelActions.ts` |
| 전역 검색 결과 라우팅 분리 | 완료 | 관련 3 files / 18 tests, typecheck, 변경 파일 lint, diff check, 전체 110 files / 903 tests, lint, renderer build | `features/search/useGlobalSearchNavigation.ts` |
| 창 viewport resize lifecycle 분리 | 완료 | 관련 3 files / 35 tests, typecheck, 변경 파일 lint, diff check, 전체 111 files / 908 tests, lint, renderer build | `features/workspace/useWindowViewport.ts` |
| 주변 메모 검색 결과 표시 handler 분리 | 완료 | 관련 3 files / 37 tests, typecheck, 변경 파일 lint, diff check, 전체 111 files / 908 tests, lint, renderer build | `features/search/ambientSearchHandlers.ts` |
| Tabs/Split 패널 lifecycle action 분리 | 완료 | 관련 3 files / 31 tests, typecheck, 변경 파일 lint, diff check, 전체 112 files / 914 tests, lint, renderer build | `features/memo/useSplitPaneLifecycle.ts` |
| Tabs/Split editor 이동 action 분리 | 완료 | 관련 3 files / 30 tests, typecheck, 변경 파일 lint, diff check, 전체 113 files / 921 tests, lint, renderer build | `features/memo/useSplitPaneEditorMovement.ts` |
| 새 탭 생성·대상 pane 포커스 action 분리 | 완료 | 관련 4 files / 30 tests, typecheck, 변경 파일 lint, diff check, 전체 114 files / 926 tests, lint, renderer build | `features/memo/useOpenNewTab.ts` |
| 기존 메모 열기·중복 탭 포커스 action 분리 | 완료 | 관련 4 files / 31 tests, typecheck, 변경 파일 lint, diff check, 전체 115 files / 932 tests, lint, renderer build | `features/memo/useOpenMemoInFocusedSplitPane.ts` |
| 새 초안 열기·작성 상태 초기화 action 분리 | 완료 | 관련 4 files / 26 tests, typecheck, 변경 파일 lint, diff check, 전체 116 files / 938 tests, lint, renderer build | `features/memo/useOpenDraftInFocusedSplitPane.ts` |
| 상대 탭 포커스·메모 활성화 action 분리 | 완료 | 관련 4 files / 25 tests, typecheck, 변경 파일 lint, diff check, 전체 117 files / 943 tests, lint, renderer build | `features/memo/useRelativeTabFocus.ts` |
| 활성 탭 닫기·다음 editor 선택 action 분리 | 완료 | 관련 4 files / 28 tests, typecheck, 변경 파일 lint, diff check, 전체 118 files / 948 tests, lint, renderer build | `features/memo/useCloseActiveTab.ts` |
| 메모 네비게이션·기존 탭/신규 초안 선택 조립 분리 | 완료 | 관련 4 files / 17 tests, typecheck, 변경 파일 lint, diff check, 전체 119 files / 954 tests, lint, renderer build | `features/memo/useMemoNavigation.ts` |
| 메모 작업 공간 빈 pane 보장 effect 분리 | 완료 | 관련 4 files / 10 tests, typecheck, 변경 파일 lint, diff check, 전체 120 files / 959 tests, lint, renderer build | `features/memo/useEnsureMemoWorkspacePane.ts` |
| view 탭 열기·Inbox refresh callback 경계 분리 | 완료 | 관련 4 files / 27 tests, typecheck, 변경 파일 lint, diff check, 전체 121 files / 965 tests, lint, renderer build | `features/memo/useOpenViewAsTab.ts` |
| 활성 메모 선택·ID 탐색 action 분리 | 완료 | 관련 4 files / 25 tests, typecheck, 변경 파일 lint, diff check, 전체 122 files / 969 tests, lint, renderer build | `features/memo/useMemoSelection.ts` |
| 세션 사이드바 접기·펼치기 timer action 분리 | 완료 | 관련 4 files / 16 tests, typecheck, 변경 파일 lint, diff check, 전체 123 files / 973 tests, lint, renderer build | `features/workspace/useSessionSidebarToggle.ts` |
| 일정 저장함 패널 열기·토글 navigation 분리 | 완료 | 관련 4 files / 47 tests, typecheck, 변경 파일 lint, diff check, 전체 124 files / 977 tests, lint, renderer build | `features/workspace/useScheduleInboxPanelNavigation.ts` |
| MemoSplitWorkspace 일정 오버레이 조립 분리 | 완료 | 관련 4 files / 10 tests, typecheck, 변경 파일 lint, diff check, 전체 125 files / 980 tests, lint, renderer build | `features/memo/components/MemoSplitScheduleOverlay.tsx` |
| 주변 메모 목록 미리보기 action 분리 | 완료 | 관련 4 files / 51 tests, typecheck, 변경 파일 lint, diff check, 전체 126 files / 984 tests, lint, renderer build | `features/search/useAmbientListPreview.ts` |
| Calendar 월간 그리드 화면 분리 | 완료 | 관련 4 files / 62 tests, typecheck, 변경 파일 lint, diff check, 전체 126 files / 984 tests, lint, renderer build | `features/calendar/components/CalendarMonthView.tsx` |
| Settings 탐색 네비게이션 분리 | 완료 | 관련 4 files / 28 tests, typecheck, 변경 파일 lint, diff check, 전체 127 files / 987 tests, lint, renderer build | `features/settings/SettingsNav.tsx` |
| Settings 공통 표시 primitive 분리 | 완료 | 관련 4 files / 14 tests, typecheck, 변경 파일 lint, diff check, 전체 128 files / 989 tests, lint, renderer build | `features/settings/SettingsPrimitives.tsx` |
| Settings 단축키 표시·입력 컨트롤 분리 | 완료 | 관련 4 files / 15 tests, typecheck, 변경 파일 lint, diff check, 전체 129 files / 992 tests, lint, renderer build | `features/settings/SettingsShortcutRecorder.tsx` |
| Topic → 폴더 생성·동기화 action 분리 | 완료 | 관련 4 files / 66 tests, typecheck, 변경 파일 lint, diff check, 전체 130 files / 997 tests, lint, renderer build | `features/memo/useCreateMemoFolderFromTopic.ts` |
| 폴더 삭제·로컬 tombstone 동기화 action 분리 | 완료 | 관련 4 files / 65 tests, typecheck, 변경 파일 lint, diff check, 전체 131 files / 1001 tests, lint, renderer build | `features/memo/useDeleteMemoFolder.ts` |
| Schedule Inbox 배치·삭제·드롭 action 분리 | 완료 | 관련 6 files / 43 tests, typecheck, 변경 파일 lint, diff check, 전체 132 files / 1006 tests, lint, renderer build | `features/schedule/useScheduleInboxItemActions.ts` |
| 보류 중인 폴더 Cloud 동기화 경계 분리 | 완료 | 관련 4 files / 34 tests, typecheck, 변경 파일 lint, diff check, 전체 133 files / 1011 tests, lint, renderer build | `features/memo/syncPendingMemoFolders.ts` |
| 보류 중인 캘린더 일정 Cloud 동기화 경계 분리 | 완료 | 관련 4 files / 43 tests, typecheck, 변경 파일 lint, diff check, 전체 134 files / 1016 tests, lint, renderer build | `features/calendar/syncPendingCalendarBlocks.ts` |
| 보류 중인 Web Inbox 생성·삭제 동기화 경계 분리 | 완료 | 관련 5 files / 50 tests, typecheck, 변경 파일 lint, diff check, 전체 135 files / 1021 tests, lint, renderer build | `features/inbox/syncPendingInboxItems.ts` |
| Calendar 완료 처리·성장 기록 action 분리 | 완료 | 관련 4 files / 46 tests, typecheck, 변경 파일 lint, diff check, 전체 136 files / 1026 tests, lint, renderer build | `features/calendar/useCalendarCompletionActions.ts` |
| Calendar 일정 삭제 action 분리 | 완료 | 관련 5 files / 52 tests, typecheck, 변경 파일 lint, diff check, 전체 137 files / 1031 tests, lint, renderer build | `features/calendar/useDeleteCalendarBlock.ts` |
| Inbox 저장·삭제 action 분리 | 완료 | 관련 5 files / 33 tests, typecheck, 변경 파일 lint, diff check, 전체 138 files / 1036 tests, lint, renderer build | `features/inbox/useInboxItemActions.ts` |
| 메모 편집 저장·병합 persistence 분리 | 완료 | 관련 4 files / 21 tests, typecheck, 변경 파일 lint, diff check, 전체 139 files / 1041 tests, lint, renderer build | `features/memo/useMemoContentPersistence.ts` |
| Calendar 일정 저장 action 분리 | 완료 | 관련 4 files / 12 tests, typecheck, 변경 파일 lint, diff check, 전체 140 files / 1046 tests, lint, renderer build | `features/calendar/useSaveCalendarBlock.ts` |
| 메모 삭제 action 분리 | 완료 | 관련 5 files / 18 tests, typecheck, 변경 파일 lint, diff check, 전체 141 files / 1051 tests, lint, renderer build | `features/memo/useDeleteMemo.ts` |
| Calendar 카테고리 생성·삭제 action 분리 | 완료 | 관련 3 files / 5 tests, typecheck, 변경 파일 lint, diff check, 전체 142 files / 1056 tests, lint, renderer build | `features/calendar/useCalendarCategoryActions.ts` |
| 메모 편집기 초안·내용 action 분리 | 완료 | 관련 3 files / 5 tests, typecheck, 변경 파일 lint, diff check, 전체 143 files / 1061 tests, lint, renderer build | `features/memo/useMemoEditorActions.ts` |
| 메모 Cloud enqueue·충돌 병합 action 분리 | 완료 | 관련 4 files / 12 tests, typecheck, 변경 파일 lint, diff check, 전체 144 files / 1066 tests, lint, renderer build | `features/memo/useEnqueueMemoCloudSync.ts` |
| 계정 로그아웃·삭제 lifecycle 분리 | 완료 | 관련 3 files / 5 tests, typecheck, 변경 파일 lint, diff check, 전체 145 files / 1071 tests, lint, renderer build | `features/auth/useAccountActions.ts` |
| 보류 중인 메모 Cloud 동기화 loop 분리 | 완료 | 관련 4 files / 12 tests, typecheck, 변경 파일 lint, diff check, 전체 146 files / 1076 tests, lint, renderer build | `features/memo/syncPendingMemoRows.ts` |
| 로컬 데이터 복원 action 분리 | 완료 | 관련 4 files / 12 tests, typecheck, 변경 파일 lint, diff check, 전체 147 files / 1081 tests, lint, renderer build | `features/workspace/useRestoreLocalData.ts` |
| 메모 Cloud retry·즉시 sync controls 분리 | 완료 | 관련 3 files / 5 tests, typecheck, 변경 파일 lint, diff check, 전체 148 files / 1086 tests, lint, renderer build | `features/memo/useMemoCloudSyncActions.ts` |
| 세션 재연결 보류 outbox coordinator 분리 | 완료 | 관련 8 files / 47 targeted tests, typecheck, 변경 파일 lint, diff check | `features/workspace/syncPendingLocalWorkspace.ts` |
| 로컬 메모 색인 flush 경계 분리 | 완료 | 관련 3 files / 5 tests, typecheck, 변경 파일 lint, diff check | `features/search/useLocalMemoIndexFlush.ts` |
| 세션 activation/deactivation lifecycle 분리 | 완료 | 관련 4 files / 5 tests, typecheck, 변경 파일 lint, diff check | `features/auth/useSessionLifecycle.ts` |
| renderer local write guard·flush lifecycle 분리 | 완료 | 관련 4 files / 5 tests, typecheck, 변경 파일 lint, diff check | `features/workspace/useLocalWriteGuard.ts` |
| ambient 검색 interaction·runner lifecycle 분리 | 완료 | 관련 4 files / 6 tests, typecheck, 변경 파일 lint, diff check | `features/search/useAmbientSearchInteraction.ts` |
| 로컬 workspace hydration 경계 분리 | 완료 | 관련 4 files / 5 tests, typecheck, 변경 파일 lint, diff check | `features/workspace/useLocalWorkspaceHydration.ts` |
| 원격 workspace load·충돌 병합 경계 분리 | 완료 | 관련 4 files / 5 tests, typecheck, 변경 파일 lint, diff check | `features/workspace/useWorkspaceLoader.ts` |
| Inbox 삭제 tombstone 재시도 경계 분리 | 완료 | 관련 4 files / 5 tests, typecheck, 변경 파일 lint, diff check | `features/inbox/useInboxTombstoneActions.ts` |
| 최초 세션 확인·auth 구독 lifecycle 분리 | 완료 | 관련 4 files / 6 tests, typecheck, 변경 파일 lint, diff check | `features/auth/useAuthSessionBootstrap.ts` |
| 부팅 단계·로컬 준비 handoff lifecycle 분리 | 완료 | 관련 4 files / 5 tests, typecheck, 변경 파일 lint, diff check | `features/workspace/useBootLifecycle.ts` |
| 메모 Cloud retry scheduler 경계 분리 | 완료 | 관련 4 files / 5 tests, typecheck, 변경 파일 lint, diff check | `features/memo/useMemoCloudRetryScheduler.ts` |
| 명시적 Topics 재생성 action 분리 | 완료 | 관련 4 files / 5 tests, typecheck, 변경 파일 lint, diff check | `features/topics/useTopicRegeneration.ts` |
| MemoSplitWorkspace pane header 분리 | 완료 | 관련 5 files / 88 tests, typecheck, 변경 파일 lint, diff check, renderer build | `features/memo/components/MemoSplitPaneHeader.tsx` |
| MemoSplitWorkspace 노트 관리 메뉴 분리 | 완료 | 관련 5 files / 85 tests, typecheck, 변경 파일 lint, diff check | `features/memo/components/MemoSplitNoteMenu.tsx` |
| Settings 단축키 섹션 분리 | 완료 | 관련 4 files / 38 tests, typecheck, 변경 파일 lint, diff check | `features/settings/SettingsHotkeysSection.tsx` |
| Settings 정보 섹션 분리 | 완료 | 관련 3 files / 65 tests, typecheck, 변경 파일 lint, diff check | `features/settings/SettingsAboutSection.tsx` |
| MemoSplitWorkspace pane resize interaction 분리 | 완료 | 관련 3 files / 24 tests, typecheck, 변경 파일 lint, diff check | `features/memo/useSplitPaneResize.ts` |
| MemoSplitWorkspace 주변 메모 검색 요청 경계 분리 | 완료 | 관련 4 files / 관련 ambient·nearby·loading·split 테스트, typecheck, 변경 파일 lint, diff check | `features/memo/useNearbyNotesSearch.ts` |
| MemoSplitWorkspace 특수 view body 분리 | 완료 | 관련 5 files / 106 tests, typecheck, 변경 파일 lint, diff check, 전체 161 files / 1151 tests | `features/memo/components/MemoSplitSpecialView.tsx` |
| Settings 계정 섹션 표시 UI 분리 | 완료 | 관련 4 files / 25 tests, typecheck, 변경 파일 lint, diff check | `features/settings/SettingsAccountSection.tsx` |
| Settings 백업·복원·JSON 내보내기 섹션 분리 | 완료 | 관련 3 files / 23 tests, typecheck, 변경 파일 lint, diff check | `features/settings/SettingsBackupSection.tsx` |
| Settings 일반 설정 섹션 분리 | 완료 | 관련 4 files / 31 tests, typecheck, 변경 파일 lint, diff check | `features/settings/SettingsGeneralSection.tsx` |
| Calendar 일정 카테고리·색상 picker 표시 분리 | 완료 | 관련 4 files / 65 tests, typecheck, 변경 파일 lint, diff check | `features/calendar/components/CalendarCategoryPicker.tsx` |
| Settings 동기화·저장소·검색 모델 섹션 분리 | 완료 | 관련 6 files / 57 tests, typecheck, 변경 파일 lint, diff check | `features/settings/SettingsSyncSection.tsx` |
| Electron 트레이 표시·입력 정규화 순수 규칙 분리 | 완료 | 관련 3 files / 24 tests, typecheck, 변경 파일 lint, diff check, 전체 162 files / 1156 tests, lint, renderer build | `features/mini/trayPresentation.ts` |
| Settings 테마·편집기 타이포그래피 섹션 분리 | 완료 | 관련 settings grouping·loading·control density·chrome hover 테스트 101 tests, typecheck, 변경 파일 lint, diff check, 전체 162 files / 1156 tests, lint, renderer build | `features/settings/SettingsAppearanceSection.tsx` |
| MemoWorkspace 폴더 사이드바 표시·폼 분리 | 완료 | 관련 loading·workspace shell·empty state·folder 테스트 87 tests, typecheck, 변경 파일 lint, diff check, 전체 162 files / 1156 tests, lint, renderer build | `features/memo/components/MemoFolderSidebar.tsx` |
| Topics 순수 그래프 모델 계산 분리 | 완료 | 관련 Topics·knowledge graph 테스트 114 tests, typecheck, 변경 파일 lint, diff check, 전체 163 files / 1161 tests, lint, renderer build | `features/memo/topicsGraphModel.ts` |
| Topics 주제 영역 rail 표시·폴더 폼 분리 | 완료 | 관련 knowledge graph·loading·empty state 테스트 109 tests, typecheck, 변경 파일 lint, diff check, 전체 163 files / 1161 tests, lint, renderer build | `features/memo/components/TopicsCommunityRail.tsx` |
| Settings 계정 제공자 표시 경계 흡수 | 완료 | 관련 password-reset·settings grouping·loading·control density·chrome hover 테스트 87 tests, typecheck, 변경 파일 lint, diff check | `features/settings/SettingsAccountSection.tsx` |
| Calendar 일정 편집 모달 표시 분리 | 완료 | 관련 calendar move·schedule inbox·category picker·control density·empty state 테스트 80 tests, typecheck, 변경 파일 lint, diff check | `features/calendar/components/CalendarEventEditorModal.tsx` |
| App Electron Inbox 캡처 구독 분리 | 완료 | 관련 capture·clip notification·action failure·Inbox action·view navigation 테스트 25 tests, typecheck, 변경 파일 lint, diff check | `features/inbox/useInboxCaptureSubscription.ts` |
| App 데스크톱 설정·저장소 lifecycle 분리 | 완료 | 관련 desktop preferences·settings grouping·loading·control density·clip notification 테스트 80 tests, typecheck, 변경 파일 lint, diff check | `features/settings/useDesktopPreferences.ts` |
| Settings 모달 CSS 선언 경계 분리 | 완료 | 관련 settings grouping·control density·chrome hover 테스트 31 tests, typecheck, 변경 파일 lint, diff check | `features/settings/SettingsStyles.ts` |
| Settings 계정 삭제 확인 dialog 표시 분리 | 완료 | 관련 settings delete dialog·password reset·settings grouping 테스트 20 tests, typecheck, 변경 파일 lint, diff check | `features/settings/SettingsDeleteAccountDialog.tsx` |

## 현재 구조 요약

| 계층 | 책임 | 현재 상태 |
|---|---|---|
| `App.tsx` | 기능 조립과 전역 상태 연결 | composition root로 유지 |
| `features/*` | auth·calendar·inbox·memo·search·settings·workspace 등 도메인 기능 | 기능별 컴포넌트·Hook·순수 로직으로 분리 |
| `components/` | Tiptap 및 공통 UI | 구성요소와 전용 SCSS를 함께 보유 |
| `services/` | Backend·Supabase·로컬 저장소 facade | 저장 계약 보존을 위해 경계 유지 |
| `styles/` | 전역 토큰·workspace 화면 스타일 | 토큰은 분리, workspace 전역 파일은 보류 |
| `__tests__/` | 기능·경계 회귀 검증 | 166개 파일, 1,170개 테스트 |
