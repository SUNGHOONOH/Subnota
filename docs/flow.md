# MemoApp Flow

Last updated: 2026-05-25

이 문서는 현재 코드에 존재하는 실행 흐름만 설명한다. 오래된 계획성 문서는 기준으로 삼지 않는다.

## 1. Local-First Memo Flow

```mermaid
flowchart TD
  A["사용자가 메모 입력"] --> B["MemoScreen local text state"]
  B --> C["useMemoStore.updateMemo / addMemo"]
  C --> D["AsyncStorage persist"]
  C --> E["contentHash 갱신"]
  C --> F["syncStatus = pending"]
  C --> G["scheduleScanStatus = pending"]
  C --> H["내용 변경 또는 새 메모면 topicDirty = true"]
```

현재 원칙:

- 타이핑 중 backend 호출은 없다.
- 타이핑 중 Supabase write를 남발하지 않는다.
- 메모 작성/수정은 오프라인에서도 가능하다.
- 빈 메모는 store 정리 흐름에서 제거된다.

## 2. Manual Schedule Flow

```mermaid
flowchart TD
  A["사용자가 메모 텍스트 선택"] --> B["일정 등록 버튼"]
  B --> C["dateParser 또는 날짜 팝오버"]
  C --> D["useMemoStore.addScheduleFromSelection"]
  D --> E["calendarBricks에 로컬 저장"]
  E --> S["syncStatus = pending"]
  E --> F["CalendarScreen 월/주 화면에 표시"]
```

현재 원칙:

- 수동 일정 등록은 로그인 없이 동작한다.
- 수동 일정은 `calendarBricks`에 로컬 저장된다.
- 메모 삭제가 이미 만든 calendar brick을 자동 삭제하지 않는다.

## 3. Optional Sync Flow

```mermaid
flowchart TD
  A["사용자 로그인 상태 존재"] --> B["앱 시작 / active 복귀 / background 진입 / BriefingScreen 진입"]
  B --> C["syncLocalData"]
  C --> D["syncPendingMemos"]
  C --> E["syncPendingCalendarBricks"]
  D --> F["profiles upsert"]
  E --> F
  F --> G["pending memo를 Supabase memos upsert"]
  F --> H["pending calendarBricks를 Supabase calendar_blocks upsert/delete"]
  G --> I["markMemoSynced 또는 deletedMemoIds 정리"]
  H --> J["markCalendarBrickSynced 또는 deleted brick purge"]
```

현재 호출 위치:

- `App.tsx`가 Zustand persist hydration 후 첫 sync를 실행한다.
- Supabase auth가 `SIGNED_IN` 또는 `TOKEN_REFRESHED` 상태가 되면 기존 로컬 메모와 캘린더 pending 데이터를 강제 sync한다.
- 앱이 active로 돌아오면 cooldown을 두고 sync를 시도한다.
- 앱이 background로 갈 때는 강제 sync를 시도한다.
- `BriefingScreen`이 schedule inbox를 불러오기 전에 `syncLocalData({ force: true })`를 호출한다.
- schedule inbox 항목을 캘린더에 등록할 때도 강제 sync를 한 번 더 시도한다.

현재 원칙:

- 로그인은 메모 작성의 필수 조건이 아니다.
- 로그인된 경우에만 기기 연동/온라인 기능이 동작한다.
- 비로그인 상태에서 온라인 기능을 직접 누르면 로그인 필요 팝업을 띄운다. 현재 팝업은 Kakao/Google OAuth 연결 전 placeholder다.
- 비로그인으로 쓰던 기존 로컬 메모와 캘린더 블럭은 나중에 로그인하는 시점에 Supabase로 후발 sync된다.
- sync 실패 시 로컬 데이터는 유지되고 `syncStatus = failed` 또는 pending tombstone으로 남아 다음 sync에서 재시도된다.
- 내용이 바뀐 memo만 backend 분석 dirty 필드를 `pending/true`로 리셋한다. 내용이 안 바뀐 단순 sync는 서버가 batch로 갱신한 hash를 다시 덮어쓰지 않는다.

## 4. Automatic Schedule Inbox Flow

```mermaid
flowchart TD
  A["저녁 batch 또는 수동 backend 호출"] --> B["/maintenance/daily-all 또는 /schedule-inbox/run"]
  B --> C["fetch_memos_needing_schedule_scan"]
  C --> D["Kiwi split_into_sents"]
  D --> E["schedule_parser 날짜/시간 후보 추출"]
  E --> F["schedule_inbox upsert"]
  F --> G["schedule_scanned_hash 갱신"]
  G --> H["BriefingScreen bottom sheet에서 조회"]
```

관련 파일:

- `backend/app/schedule_batch.py`
- `backend/app/schedule_parser.py`
- `src/services/supabase/scheduleInboxService.ts`
- `src/features/briefing/BriefingScreen.tsx`

현재 원칙:

- 자동 일정 추천은 온라인 기능이다.
- 앱 작성 화면에서 실시간 추천 UI를 띄우지 않는다.
- backend batch 결과만 `schedule_inbox`에 쌓고, 브리핑 탭이 pending 항목을 보여준다.

## 5. Briefing Inbox Action Flow

```mermaid
flowchart TD
  A["브리핑 탭"] --> L{"로그인 상태?"}
  L -->|"아니오"| P["로그인 필요 팝업"]
  L -->|"예"| B["schedule_inbox pending 조회"]
  B --> C["흩어진 일정 모아보기 카드"]
  C --> D["Bottom Sheet"]
  D --> E["캘린더에 등록"]
  D --> F["시간 / 제목 수정"]
  D --> G["무시"]
  E --> H["useMemoStore.addCalendarBrick"]
  H --> S["syncLocalData(force)로 calendar_blocks 반영 시도"]
  S --> I["schedule_inbox status = accepted"]
  G --> J["schedule_inbox status = dismissed"]
```

현재 원칙:

- 비로그인 상태에서 일정 inbox를 열면 로그인 필요 안내만 보여준다.
- 등록 액션은 먼저 로컬 calendar brick을 만든다.
- 로그인 상태라면 등록 직후 Supabase `calendar_blocks` sync를 시도한다.
- Supabase 상태 업데이트가 실패해도 로컬 등록은 유지된다.

## 5-1. Daily Briefing Archive Flow

```mermaid
flowchart TD
  A["Supabase daily-briefing Edge Function"] --> B["내일 calendar_blocks 조회"]
  A --> C["최근 memos 10개 조회"]
  A --> D["한 달 전쯤 memo_chunks 후보 조회"]
  D --> E["없으면 90d / 21d / old_random fallback"]
  B --> F["Gemini briefing 생성"]
  C --> F
  E --> F
  F --> G["briefings upsert"]
  G --> H["BriefingScreen 과거 브리핑 인박스"]
```

관련 파일:

- `supabase/functions/daily-briefing/index.ts`
- `src/services/supabase/briefingService.ts`
- `src/features/briefing/BriefingScreen.tsx`
- `supabase/migrations/20260519_final_schema.sql`

현재 원칙:

- 과거 생각 기준은 `memos.created_at`이고 사용자에게는 “한 달 전쯤”처럼 표시한다.
- fallback 순서는 `30d -> 90d -> 21d -> old_random`이다.
- `briefings`는 `user_id, type, briefing_date` 기준으로 upsert한다.
- 일정 인박스와 과거 브리핑 인박스는 서로 다른 기능이다.

## 6. State B Network Search Flow

```mermaid
flowchart TD
  A["수동: 메모 ... 메뉴"] --> L{"로그인 상태?"}
  L -->|"아니오"| P["로그인 필요 팝업"]
  L -->|"예"| B["네트워크 보기"]
  Z["자동: 입력 idle 3초"] --> C["searchCursorNetwork"]
  B --> C["searchCursorNetwork"]
  C --> D["Supabase bearer token 포함 요청"]
  D --> E["backend /network/search"]
  E --> F["Kiwi로 현재 cursor chunk 계산"]
  F --> G["chunk_embedding_cache 확인"]
  G --> H["없으면 HF embedding 생성"]
  H --> I["match_memo_chunks RPC"]
  I --> J["유사 chunk 반환"]
  J --> K["수동은 LocalKnnGraph 렌더링"]
  J --> L["자동은 Ambient 카드 1개"]
  L --> M["탭하면 세부 창에서 과거 메모 전체 스크롤"]
```

관련 파일:

- `src/services/backend/networkService.ts`
- `src/features/memo/components/MemoNetworkPanel.tsx`
- `src/features/memo/components/LocalKnnGraph.tsx`
- `src/features/memo/components/AmbientNetworkCard.tsx`
- `src/features/memo/components/AmbientNetworkDetailPanel.tsx`
- `backend/app/network_search.py`
- `backend/app/memo_chunking.py`
- `supabase/migrations/20260519_final_schema.sql`

현재 원칙:

- 수동 버튼은 기존 그래프 UI를 유지한다.
- 자동 Ambient Mirror는 타이핑 중 보이지 않고, 입력이 3초 멈췄을 때 유사 문장 1개만 흐리게 보여준다.
- Ambient 세부 창의 초록 하이라이트는 임시 UI이며 메모에 저장하지 않는다.
- 전체 메모 재인덱싱은 버튼 클릭 시 하지 않는다.
- `/network/search`는 Supabase bearer token으로 사용자를 검증한다.

## 7. Memo Chunk Indexing Flow

```mermaid
flowchart TD
  A["backend daily maintenance"] --> B["fetch_memos_needing_chunk_index"]
  B --> C["Kiwi sentence split"]
  C --> D["network chunks 생성"]
  D --> E["HF embedding batch"]
  E --> F["memo_chunks replace"]
  F --> G["indexed_content_hash 갱신"]
```

관련 파일:

- `backend/app/memo_indexing.py`
- `backend/app/memo_chunking.py`
- `backend/app/topic_discovery.py`의 `encode_texts`
- `supabase`의 `memo_chunks`

현재 원칙:

- chunk embedding은 batch에서 선처리한다.
- State B 버튼 검색은 선처리된 `memo_chunks`를 대상으로 한다.

## 8. State A Topic Discovery Flow

```mermaid
flowchart TD
  A["새 메모에 실제 내용 입력"] --> B["topicDirty = true"]
  B --> C["syncPendingMemos로 Supabase memos 반영"]
  C --> D["backend daily maintenance"]
  D --> E["has_topic_dirty_memos 확인"]
  E --> F["dirty 없으면 skip"]
  E --> G["dirty 있으면 topic_discovery 실행"]
  G --> H["HF embedding"]
  H --> I["Agglomerative 또는 HDBSCAN"]
  I --> J["keyword label 생성"]
  J --> K["topic_clusters / topic_cluster_memos 저장"]
  H --> E2["topic 내부 memo-memo similarity edge 계산"]
  E2 --> K2["topic_memo_edges 저장"]
  K --> L["topicDirty false"]
  K2 --> M["앱 무의식 지도에서 topic 우선 표시"]
  K --> M
  M --> N["topic 클릭"]
  N --> O["빠른 보기: membership 기반 메모 노드"]
  N --> P["관계 보기: topic_memo_edges 또는 fallback edge"]
```

관련 파일:

- `backend/app/topic_discovery.py`
- `backend/app/constants.py`
- `backend/app/db.py`
- `src/services/supabase/topicService.ts`
- `src/features/memo/components/GlobalNetworkGraph.tsx`
- `supabase`의 `topic_clusters`, `topic_cluster_memos`

현재 원칙:

- State A는 앱에서 실시간 실행하지 않는다.
- dirty memo가 없으면 backend가 skip한다.
- 결과는 Supabase topic tables에 저장된다.
- 앱은 `최근 1달 / 최근 6개월 / 최근 1년 / 전체` 필터를 제공하고, topic 데이터가 없으면 로컬 카테고리 그래프로 fallback한다.
- topic을 누르면 빠른 보기와 관계 보기를 모두 제공한다.
- 관계 보기는 `topic_memo_edges`가 있으면 실제 memo-memo similarity를 쓰고, 없으면 membership 점수 기반 fallback edge를 보여준다.

## 9. Daily Maintenance Flow

```mermaid
flowchart TD
  A["Cron 또는 수동 호출"] --> B["/maintenance/daily-all"]
  B --> C["profiles 전체 조회"]
  C --> D["사용자별 /maintenance/daily pipeline"]
  D --> E["schedule inbox batch"]
  D --> F["memo chunk indexing"]
  D --> G["topic discovery"]
```

backend endpoint:

- `POST /maintenance/daily`
- `POST /maintenance/daily-all`

보호 방식:

- `BACKEND_ADMIN_KEY`가 설정되어 있으면 `x-backend-admin-key` 헤더가 필요하다.

## 10. Desktop PWA Flow

```mermaid
flowchart TD
  A["사용자 subnota.com/app 접속"] --> B["PWA AuthScreen"]
  B --> C["Supabase email / Google / Kakao 로그인"]
  C --> D["App.tsx workspace load"]
  D --> E["memos / calendar_blocks / schedule_inbox / briefings / topic_clusters 조회"]
  E --> F["메모 PWA"]
  E --> G["캘린더 PWA"]
  E --> H["브리핑 PWA"]
  F --> I["메모 autosave -> Supabase memos"]
  F --> J["선택 텍스트 일정 등록 -> calendar_blocks"]
  F --> K["State A topic map 표시"]
  F --> L["State B 수동 graph / 3초 idle Ambient Mirror"]
  L --> M["Cloud Run /network/search"]
  H --> N["일정 후보 등록/수정/무시"]
```

현재 원칙:

- PWA는 로그인 필수로 시작한다.
- PWA에는 service role, Gemini key, HF token을 넣지 않는다.
- State B는 `VITE_MEMO_BACKEND_URL`이 가리키는 Cloud Run backend를 호출한다.
- Cloud Run backend는 `CORS_ALLOW_ORIGINS`에 PWA 도메인을 포함해야 한다.
- PWA State A는 Supabase `topic_clusters` 결과를 보여주며, topic 생성 자체는 backend batch가 담당한다.

## 11. Secret Boundary

```mermaid
flowchart LR
  A["RN 앱"] --> B["SUPABASE_URL / SUPABASE_ANON_KEY / MEMO_BACKEND_URL"]
  C["Python backend"] --> D["SUPABASE_SERVICE_ROLE_KEY / HF_TOKEN / BACKEND_ADMIN_KEY"]
  E["Supabase Edge Function"] --> F["SERVICE_ROLE_KEY / GEMINI_API_KEY"]
```

현재 원칙:

- 앱 번들에는 service role, HF token, Gemini API key를 넣지 않는다.
- backend batch는 service role로 Supabase를 읽고 쓴다.
- State B 사용자 요청은 Supabase bearer token으로 user id를 확정한다.
