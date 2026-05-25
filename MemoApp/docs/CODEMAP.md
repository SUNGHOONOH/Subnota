# MemoApp Code Map

Last updated: 2026-05-25

이 문서는 현재 코드에 존재하는 구조만 설명한다. 이전 `network.md`, `state_A.md`, `state_B.md`의 계획성 내용은 폐기했고, 실제 파일과 현재 연결된 흐름만 남겼다.

## App Entry

| File | Role |
| --- | --- |
| `App.tsx` | 앱 최상위 엔트리. `GestureHandlerRootView`, `SafeAreaProvider`, `Navigation`을 감싼다. Zustand persist hydration 이후 첫 sync를 실행하고, 앱 active/background 전환 및 Supabase 로그인/토큰 갱신 시 로컬 변경 sync를 시도한다. |
| `index.js` | React Native 런타임에 앱을 등록한다. |
| `src/app/Navigation.tsx` | 하단 탭 내비게이션. 현재 탭은 `메모`, `캘린더`, `브리핑`이며 탭 전환 시 키보드를 닫는다. |

## Memo Feature

| File | Role |
| --- | --- |
| `src/features/memo/MemoScreen.tsx` | 메모 탭 컨테이너. 메모 생성/선택/삭제/고정, 날짜 anchor, 선택 텍스트 수동 일정 등록, `...` 메뉴 수동 네트워크 그래프, idle 기반 Ambient Mirror 상태를 조율한다. |
| `src/features/memo/components/MemoEditor.tsx` | 메모 입력 UI. 따뜻한 종이 배경, 날짜 하이라이트 레이어, 날짜 tooltip, 선택 텍스트 일정 등록 버튼, iOS keyboard accessory 연결을 담당한다. |
| `src/features/memo/components/MemoSidebar.tsx` | 메모 목록. 시간순/무의식 지도 모드, 고정/최근/오늘/이전 7일/이전 30일/월별/연도별 섹션, 카테고리 필터를 렌더링한다. |
| `src/features/memo/components/DateQuickActions.tsx` | 키보드 위 빠른 입력 바. 오늘/내일/모레, 날짜 선택, 키보드 닫기 액션을 제공한다. |
| `src/features/memo/components/MiniCalendarPopover.tsx` | 메모 화면의 날짜 선택 팝오버. 날짜와 시간 입력을 받아 토큰 삽입 또는 선택 텍스트 일정 등록에 사용된다. |
| `src/features/memo/components/MemoNetworkPanel.tsx` | `... > 네트워크 보기` 수동 모달. 기존 State B SVG 그래프를 유지한다. |
| `src/features/memo/components/LocalKnnGraph.tsx` | State B 수동 그래프 렌더러. backend `/network/search` 결과를 중심 chunk와 주변 chunk 노드로 SVG 표시한다. |
| `src/features/memo/components/AmbientNetworkCard.tsx` | 입력 idle 후 뜨는 자동 State B peek 카드. 가장 유사한 과거 문장 1개만 흐리게 보여준다. |
| `src/features/memo/components/AmbientNetworkDetailPanel.tsx` | Ambient 카드 탭 시 열리는 작은 세부 창. 현재 문장, 유사 문장, 과거 메모 전체를 세로 스크롤로 보여주고 유사 문장만 임시 초록 하이라이트한다. |
| `src/features/memo/components/GlobalNetworkGraph.tsx` | 사이드바 무의식 지도. Supabase `topic_clusters`를 우선 사용하고, topic 클릭 시 빠른 보기/관계 보기 detail panel을 연다. 관계 보기는 `topic_memo_edges`가 있으면 실제 edge를, 없으면 membership 기반 fallback edge를 쓴다. |

## Calendar Feature

| File | Role |
| --- | --- |
| `src/features/calendar/CalendarScreen.tsx` | 캘린더 탭 컨테이너. 월/주 모드, 주차 이동, 블럭 추가/삭제/편집, 드래그 이동, 모바일 슬롯 교환을 조율한다. |
| `src/features/calendar/components/MonthGrid.tsx` | 월별 캘린더 그리드. 날짜별 일정 미리보기와 날짜 탭 일정 목록 모달 진입을 담당한다. |
| `src/features/calendar/components/WeekBoard.tsx` | 주간 블럭 보드. 모바일에서는 요일 행과 04/08/12/16/20 시간 슬롯, 데스크톱에서는 요일 컬럼을 렌더링한다. |
| `src/features/calendar/components/DraggableBrick.tsx` | 개별 캘린더 블럭. 탭, 드래그, 길게 누르기 삭제 요청, drop preview 전달을 담당한다. |
| `src/features/calendar/components/CalendarBrickEditor.tsx` | 블럭 note 편집 모달. memo 블럭과 일반 calendar brick 모두에 사용된다. |
| `src/features/calendar/components/AddBrickButton.tsx` | 캘린더 블럭 추가 버튼. 주간 보드 상단과 요일별 compact 버튼에 쓰인다. |
| `src/features/calendar/components/DayScheduleModal.tsx` | 월별 캘린더에서 특정 날짜를 눌렀을 때 뜨는 일정 목록 모달. |

## Briefing Feature

| File | Role |
| --- | --- |
| `src/features/briefing/BriefingScreen.tsx` | 브리핑 탭 컨테이너. 최신 데일리 브리핑, 로컬 우선순위/다가오는 일정, `schedule_inbox` 일정 인박스, `briefings` 과거 브리핑 인박스를 정리한다. |
| `src/features/briefing/components/PriorityQueue.tsx` | scheduled memo, pinned memo, 일반 memo 순서로 계산된 우선순위 목록을 표시한다. |
| `src/features/briefing/components/TodayContextPanel.tsx` | 다가오는 scheduled memo 목록을 시간 라벨과 함께 보여준다. |
| `src/features/briefing/components/briefingFormat.ts` | 메모 제목 추출과 일정 라벨 포맷 유틸. |

## Store

| File | Role |
| --- | --- |
| `src/store/useMemoStore.ts` | 로컬 우선 상태 저장소. Zustand persist v6 + AsyncStorage로 `memos`, `calendarBricks`, `deletedMemoIds`를 저장한다. 메모 UUID, `contentHash`, `syncStatus`, `scheduleScanStatus`, `topicDirty`, calendar brick sync 상태를 관리한다. |

현재 store 원칙:

- 메모 작성/수정은 네트워크 없이 즉시 로컬 반영된다.
- 수동 일정 등록은 `calendarBricks`에 바로 저장된다.
- 새 메모에 실제 내용이 들어가면 `topicDirty`가 true로 잡힌다.
- 삭제된 synced memo는 `deletedMemoIds` tombstone으로 남아 다음 sync 때 Supabase에서도 삭제된다.
- 삭제된 synced calendar brick은 `deletedAt` 상태로 숨겨지고, 다음 sync 때 Supabase `calendar_blocks`에서도 삭제된다.
- sync 관련 필드는 온라인 기능의 대상 판별용이며, 메모 작성 자체를 막지 않는다.

## Lib

| File | Role |
| --- | --- |
| `src/lib/dateParser.ts` | 한국어/단축 날짜 표현을 `DateMatch`로 파싱한다. 현재 메모 tooltip과 수동 일정 등록에 쓰인다. |
| `src/lib/calendarUtils.ts` | 캘린더 계산 유틸. 요일 기준 날짜, 월 기준 주차, 시간 입력 정규화 등을 담당한다. |
| `src/lib/constants.ts` | 앱 조절 상수. Ambient delay/cooldown/result count, State A 시간 필터와 노드 감쇠 기준을 모은다. |
| `src/lib/contentHash.ts` | 로컬 sync 판단용 hash, UUID 생성, UUID 검증 유틸. |
| `src/lib/memoChunker.ts` | RN 로컬 fallback chunker. backend Kiwi를 쓰지 못할 때 커서 주변 문장 계산에 쓸 수 있다. |
| `src/lib/scheduleParser.ts` | RN 로컬 일정 후보 파서. 현재 자동 일정 추천의 정식 실행은 backend batch가 담당하므로 보조 유틸로 남아 있다. |

## Services

| File | Role |
| --- | --- |
| `src/services/supabase/client.ts` | Supabase client 초기화. 앱 `.env`의 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 사용한다. |
| `src/services/supabase/authGate.ts` | 온라인 기능 진입 전 Supabase session을 확인하고, 비로그인 상태면 로그인 필요 안내 팝업을 띄운다. Kakao/Google OAuth 연결 전까지는 placeholder gate 역할을 한다. |
| `src/services/supabase/syncService.ts` | 앱 공통 sync coordinator. 메모 sync와 캘린더 sync를 묶어 실행하고, 짧은 cooldown과 in-flight 재실행을 관리한다. |
| `src/services/supabase/memoSyncService.ts` | 로그인된 사용자의 로컬 pending memo를 Supabase `memos`로 upsert한다. 내용 변경 시 backend 분석 dirty 필드를 리셋하고, 삭제 tombstone을 서버에 반영한다. 타이핑 중 자동 호출하지 않는다. |
| `src/services/supabase/calendarSyncService.ts` | 로컬 `calendarBricks`를 Supabase `calendar_blocks`로 upsert/delete한다. daily briefing이 로컬 수동 일정을 볼 수 있게 하는 sync 경계다. |
| `src/services/supabase/briefingService.ts` | Supabase `briefings` daily 항목을 최신순으로 조회해 과거 브리핑 인박스에 제공한다. |
| `src/services/supabase/scheduleInboxService.ts` | Supabase `schedule_inbox` pending 항목 조회와 `accepted/dismissed` 상태 업데이트를 담당한다. |
| `src/services/supabase/topicService.ts` | State A client. `topic_clusters`, `topic_cluster_memos`를 읽어 무의식 지도에 제공한다. |
| `src/services/backend/networkService.ts` | State B client. 현재 텍스트와 cursor index를 backend `/network/search`로 보내고 pgvector 검색 결과와 memo timestamp를 받는다. Supabase bearer token이 필요하다. |
| `src/services/ml/categorizeMemo.ts` | 로컬 규칙 기반 카테고리 분류. |

## Backend

| File | Role |
| --- | --- |
| `backend/app/main.py` | FastAPI 엔트리. health, chunk split/index, network search, schedule inbox batch, topic discovery, daily maintenance endpoint를 노출한다. |
| `backend/app/auth.py` | Supabase bearer token 검증과 batch endpoint admin key 검증. |
| `backend/app/config.py` | backend `.env` 설정. service role, HF token, admin key 등 서버 전용 secret을 읽는다. |
| `backend/app/constants.py` | embedding 모델, chunk 크기, topic clustering 기준 상수. |
| `backend/app/db.py` | Supabase service-role DB 접근 레이어. memo 조회, schedule inbox upsert, memo chunk 저장, pgvector RPC 호출, topic 저장을 담당한다. |
| `backend/app/memo_chunking.py` | Kiwi 기반 문장 분리와 network chunk 생성. cursor index가 속한 chunk를 찾는다. |
| `backend/app/schedule_parser.py` | backend 일정 후보 파서. Kiwi sentence chunk에서 날짜/시간/제목 후보를 만든다. |
| `backend/app/schedule_batch.py` | 자동 일정 추천 batch. scan 대상 memo를 파싱해 `schedule_inbox`에 upsert하고 scanned hash를 갱신한다. |
| `backend/app/memo_indexing.py` | dirty memo를 chunk로 쪼개고 HF embedding을 생성해 `memo_chunks`에 저장한다. |
| `backend/app/network_search.py` | State B 검색. 현재 cursor chunk 1개를 embedding하고 `match_memo_chunks` RPC로 유사 chunk를 찾는다. |
| `backend/app/topic_discovery.py` | State A topic discovery. `topic_dirty`가 있는 사용자만 embedding clustering을 실행하고 topic tables 및 topic 내부 memo edge를 저장한다. |
| `backend/app/maintenance.py` | daily batch 조합. schedule inbox, memo chunk indexing, topic discovery를 사용자별 또는 전체 사용자 대상으로 실행한다. |
| `backend/app/hashing.py` | backend hash 유틸. |
| `backend/pyproject.toml` | FastAPI, Supabase, Kiwi, Hugging Face, scikit-learn 의존성 정의. |

## Supabase

| File | Role |
| --- | --- |
| `supabase/migrations/20260519_final_schema.sql` | 현재 통합 schema. `profiles`, `memos`, `calendar_blocks`, `schedule_inbox`, `memo_chunks`, `chunk_embedding_cache`, `briefings`, `topic_clusters`, `topic_cluster_memos`, `topic_memo_edges`, RLS, `match_memo_chunks` RPC를 정의한다. |
| `supabase/migrations/20260525_topic_memo_edges_patch.sql` | 이미 적용된 Supabase 프로젝트에 State A detail relation edge table을 추가하는 patch SQL. |
| `supabase/functions/daily-briefing/index.ts` | Gemini 기반 daily briefing Edge Function. 내일 일정, 최근 메모, 한 달 전쯤의 과거 chunk를 엮어 `briefings`에 upsert한다. |
| `supabase/functions/deno.json` | Supabase Edge Function용 Deno 설정. |

## Desktop PWA

| File | Role |
| --- | --- |
| `pwa/src/app/App.tsx` | 데스크톱 PWA shell. Supabase auth, 메모/캘린더/브리핑 데이터 로딩, autosave, 선택 텍스트 일정 등록, State B ambient 검색 상태를 조율한다. |
| `pwa/src/features/auth/AuthScreen.tsx` | 로그인 필수 시작 화면. 이메일 로그인/회원가입과 Google/Kakao OAuth 버튼을 제공한다. |
| `pwa/src/features/memo/MemoWorkspace.tsx` | PWA 메모 화면. 시간순 세션 목록, State A topic map과 topic detail 빠른 보기/관계 보기, 날짜 quick action, 선택 텍스트 일정 등록, State B 수동 graph와 ambient detail panel을 렌더링한다. |
| `pwa/src/features/calendar/CalendarWorkspace.tsx` | PWA 캘린더 화면. 월별 요약, 날짜별 일정 modal, 주간 블럭, 블럭 추가/수정/삭제를 담당한다. |
| `pwa/src/features/briefing/BriefingWorkspace.tsx` | PWA 브리핑 화면. 최신 브리핑, 과거 브리핑 인박스, 일정 후보 등록/수정/무시를 담당한다. |
| `pwa/src/services/supabase/data.ts` | PWA Supabase data access. `memos`, `calendar_blocks`, `schedule_inbox`, `briefings`, `topic_clusters`를 읽고 쓴다. |
| `pwa/src/services/backend/networkService.ts` | PWA State B client. Supabase bearer token으로 Cloud Run backend `/network/search`를 호출한다. |
| `pwa/src/lib/dateParser.ts` | RN과 같은 날짜 파서 복사본. PWA 날짜 감지와 수동 일정 등록에 쓰인다. |
| `pwa/src/lib/memoChunker.ts` | RN과 같은 local chunker 복사본. 커서 주변 chunk fallback과 ambient trigger에 쓰인다. |
| `pwa/src/lib/constants.ts` | PWA State A/B 조절 상수. Ambient delay/cooldown, topic filter, node opacity/size 기준을 둔다. |
| `pwa/public/manifest.webmanifest` | 설치형 PWA manifest. macOS/Windows 설치 이름, 아이콘, theme color를 정의한다. |
| `pwa/public/service-worker.js` | 정적 shell과 아이콘 캐시용 service worker. |
| `pwa/pwa.md` | PWA 로컬 실행, Vercel 배포, 설치 검증 순서. |

## Environment Files

| File | Role |
| --- | --- |
| `.env` | React Native 앱 번들용. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MEMO_BACKEND_URL`을 둔다. |
| `.env.example` | 앱 환경변수 예시. secret 값은 넣지 않는다. |
| `backend/.env` | backend 로컬 실행용 secret. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HF_TOKEN`, `BACKEND_ADMIN_KEY`를 둔다. |
| `backend/.env.example` | backend 환경변수 예시. |
| `supabase/.env.local` | Supabase CLI/Edge Function 로컬 실행용 secret. |

## Current Runtime Boundaries

- 메모 작성, 메모 수정, 수동 일정 등록은 로컬에서 먼저 끝난다.
- Supabase sync와 온라인 기능은 사용자가 로그인한 경우에만 동작한다.
- 비로그인 상태에서 온라인 기능 버튼을 누르면 로그인 필요 안내 팝업을 띄우고, 메모 작성과 로컬 일정 등록은 막지 않는다.
- 비로그인 상태에서 작성한 기존 로컬 메모와 캘린더 블럭은 나중에 로그인하면 auth listener를 통해 후발 sync된다.
- 앱 시작/복귀/백그라운드 진입, 브리핑 진입, 일정 inbox 수락 시 메모와 캘린더의 pending 변경을 Supabase로 sync한다.
- 자동 일정 추천은 앱에서 실시간으로 돌지 않고 backend batch가 `schedule_inbox`에 쌓는다.
- 브리핑 탭은 `schedule_inbox` pending 항목을 읽어 등록/수정/무시 액션을 제공한다.
- 브리핑 탭은 `briefings` daily 항목을 별도 과거 브리핑 인박스로 보여준다.
- State B 수동 네트워크는 버튼 클릭 시 기존 그래프 모달을 연다.
- State B 자동 Ambient Mirror는 입력 idle 3초 후 현재 cursor chunk 기준으로 유사 문장 1개만 조용히 찾는다.
- State A 토픽은 `topic_dirty`가 있는 synced memo가 있을 때 backend batch에서 실행되고, 앱은 `topic_clusters`를 우선 표시한다.
- backend service role, HF token, admin key는 앱 번들에 들어가지 않는다.
