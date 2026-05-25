# Subnota Release Checklist

Last updated: 2026-05-22

이 문서는 실제 배포 및 출시 전에 해야 할 일을 순서대로 정리한다. 기준은 현재 코드 흐름이다.

## 0. 원칙

- 앱은 local-first다. 메모 작성, 수정, 수동 일정 등록은 네트워크 없이 동작해야 한다.
- 온라인 기능은 로그인된 사용자와 Supabase sync 이후에만 정상 동작한다.
- 로그인은 Kakao / Google OAuth를 우선 연결한다. 비로그인 사용자는 메모장과 로컬 캘린더 최소 기능만 사용한다.
- 앱 번들에는 `SUPABASE_ANON_KEY` 외 secret을 넣지 않는다.
- backend service role, HF token, Gemini key, admin/cron key는 서버/Edge Function secret으로만 관리한다.
- 알림은 v1에서 브리핑 알림과 캘린더 블럭 알림만 허용한다. 메모 작성 중 추천/네트워크 알림은 만들지 않는다.
- 위젯 확장 가능성을 고려해 브리핑 요약과 오늘/내일 블럭 데이터 구조를 분리해 둔다.
- 출시 전 랜딩 페이지용 도메인을 구매하고, 소개 웹페이지와 개인정보처리방침 URL을 준비한다.
- 출시 전 노출된 key는 모두 회전한다.

## 1. Supabase DB 확정

1. Supabase SQL Editor에서 최종 schema를 적용한다.
   - 파일: `supabase/migrations/20260519_final_schema.sql`

2. 이미 schema를 적용한 DB라면 GRANT 블록이 포함됐는지 확인한다.

```sql
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.memos to authenticated;
grant select, insert, update, delete on public.calendar_blocks to authenticated;
grant select, update on public.schedule_inbox to authenticated;
grant select on public.memo_chunks to authenticated;
grant select on public.briefings to authenticated;
grant select on public.topic_clusters to authenticated;
grant select on public.topic_cluster_memos to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant execute on function public.match_memo_chunks(uuid, vector(1024), int, uuid) to authenticated, service_role;
```

3. service role 접근을 확인한다.

```sh
cd /Users/sunghoon/Projects/memo/MemoApp
set -a
source supabase/.env.local
set +a

curl -i "$SUPABASE_URL/rest/v1/profiles?select=id&limit=1" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

성공 기준:

- HTTP `200`
- 테이블이 비어 있으면 `[]`

## 2. Secret 회전 및 정리

출시 전 아래 key를 새로 발급하거나 새 값으로 교체한다.

- `SUPABASE_SERVICE_ROLE_KEY`
- `SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `HF_TOKEN`
- `BACKEND_ADMIN_KEY`
- `DAILY_BRIEFING_CRON_KEY`

`BACKEND_ADMIN_KEY`와 `DAILY_BRIEFING_CRON_KEY`는 shell/curl/Cloud Scheduler 헤더에서 escaping 문제가 없도록 특수문자 없이 영문자만 사용하는 커스텀 키로 만든다.

로컬 파일 위치:

- 앱: `.env`
- backend: `backend/.env`
- Supabase Edge Function: `supabase/.env.local`

앱 `.env`에는 아래만 둔다.

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
MEMO_BACKEND_URL=
```

## 3. Supabase Edge Function 배포

1. Supabase secrets를 업로드한다.

```sh
cd /Users/sunghoon/Projects/memo/MemoApp

supabase secrets set \
  --env-file supabase/.env.local \
  --project-ref kwrbbxctutngcoqtccjv
```

`SUPABASE_`로 시작하는 값이 skip되어도 정상이다. 중요한 값은 아래다.

- `SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `DAILY_BRIEFING_CRON_KEY`

2. `daily-briefing`을 배포한다.

```sh
supabase functions deploy daily-briefing \
  --project-ref kwrbbxctutngcoqtccjv \
  --no-verify-jwt
```

3. 수동 호출을 확인한다.

```sh
set -a
source supabase/.env.local
set +a

curl -X POST https://kwrbbxctutngcoqtccjv.supabase.co/functions/v1/daily-briefing \
  -H "x-daily-briefing-key: $DAILY_BRIEFING_CRON_KEY"
```

성공 기준:

- 유저가 없으면 `{"briefing_date":"YYYY-MM-DD","results":[]}`
- 유저가 있으면 `results`에 대상 user id가 포함된다.

## 4. Backend 로컬 검증

1. backend를 실행한다.

```sh
cd /Users/sunghoon/Projects/memo/MemoApp/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. health check를 확인한다.

```sh
curl http://localhost:8000/health
```

성공 기준:

```json
{"status":"ok"}
```

3. Kiwi chunking을 확인한다.

```sh
curl -X POST http://localhost:8000/memo-chunks/split \
  -H "Content-Type: application/json" \
  -d '{"text":"내일 3시 팀장님 미팅. 다음 주에는 제품 회의 준비하기.","cursor_index":5}'
```

성공 기준:

- `sentence_chunks`가 반환된다.
- `cursor_sentence_chunk`가 선택된다.
- `cursor_network_chunk`가 선택된다.

## 5. Cloud Run 배포 준비

1. Google Cloud 프로젝트를 만든다.
2. Billing account를 연결한다.
3. `gcloud` CLI를 설치하고 로그인한다.

```sh
gcloud auth login
gcloud config set project <GCP_PROJECT_ID>
gcloud config set run/region asia-northeast3
```

4. 필요한 API를 활성화한다.

```sh
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable cloudscheduler.googleapis.com
```

5. Cloud Run에 넣을 secret을 준비한다.

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
HF_TOKEN=
BACKEND_ADMIN_KEY=<letters-only-custom-key>
```

6. 배포 후 backend URL을 앱 `.env`에 반영한다.

```text
MEMO_BACKEND_URL=https://<cloud-run-service-url>
```

## 6. Backend 배포 후 검증

1. Cloud Run health check를 확인한다.

```sh
curl https://<cloud-run-service-url>/health
```

2. daily maintenance를 수동 호출한다.

```sh
curl -X POST https://<cloud-run-service-url>/maintenance/daily-all \
  -H "x-backend-admin-key: <BACKEND_ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

성공 기준:

- HTTP `200`
- `profiles`가 비어 있으면 처리 대상 없음
- 유저와 메모가 있으면 schedule/index/topic 결과가 반환된다.

3. Supabase에서 아래 테이블 변화를 확인한다.

- `schedule_inbox`
- `memo_chunks`
- `chunk_embedding_cache`
- `topic_clusters`
- `topic_cluster_memos`
- `memos.indexed_content_hash`
- `memos.schedule_scanned_hash`

## 7. Login / OAuth / Sync 검증

1. Supabase Auth에서 Google provider를 활성화한다.
2. Google Cloud Console에서 iOS OAuth client와 redirect URL을 설정한다.
3. Kakao Developers에서 앱을 만들고 iOS bundle id, redirect URL, 동의항목을 설정한다.
4. Supabase Auth에서 Kakao provider를 활성화한다.
5. 앱에서 Kakao / Google 로그인 버튼을 노출한다.
6. 비로그인 상태에서 온라인 기능을 누르면 로그인 요청 팝업이 뜨는지 확인한다.
7. 로그인 후 Supabase `profiles` row가 생성되는지 확인한다.
8. 로그인 전 작성한 로컬 메모와 캘린더 블럭이 후발 sync되는지 확인한다.
9. 새 메모를 작성한다.
10. 브리핑 탭 진입, 앱 재진입, background 진입, auth `SIGNED_IN` 이벤트 중 하나를 통해 pending memo를 sync한다.
11. Supabase `memos` row를 확인한다.

확인 필드:

- `content`
- `content_hash`
- `sync_status`
- `schedule_scan_status`
- `topic_dirty`

성공 기준:

- 빈 메모는 sync되지 않는다.
- 내용 있는 메모는 `memos`에 upsert된다.
- 로컬 캘린더 블럭은 `calendar_blocks`에 upsert된다.
- 로그인 전 작성한 데이터가 로그인 직후 서버에 올라간다.
- sync 실패 시 로컬 메모는 유지된다.
- 로그아웃 후에도 로컬 메모 작성과 로컬 일정 등록은 가능하다.

## 8. 자동 일정 추천 E2E

1. 메모 예시를 작성한다.

```text
내일 3시 팀장님 미팅
5월 30일 병원 예약
다음 주 화요일 회의 준비
```

2. 메모 sync를 확인한다.
3. backend daily maintenance를 수동 호출한다.
4. `schedule_inbox`에 후보가 생겼는지 확인한다.
5. 앱 브리핑 탭에서 `흩어진 일정 모아보기`를 연다.
6. 각 액션을 테스트한다.

테스트할 액션:

- `캘린더에 등록`
- `시간 / 제목 수정`
- `무시`

성공 기준:

- 등록 시 local `calendarBricks`에 반영된다.
- Supabase 상태가 `accepted` 또는 `dismissed`로 바뀐다.
- Supabase 업데이트 실패 시에도 local 등록은 유지된다.

## 9. Daily Briefing E2E

1. Supabase에 유저, 메모, 일정, memo chunks가 있는 상태를 만든다.
2. `daily-briefing` Edge Function을 수동 호출한다.

```sh
curl -X POST https://kwrbbxctutngcoqtccjv.supabase.co/functions/v1/daily-briefing \
  -H "x-daily-briefing-key: $DAILY_BRIEFING_CRON_KEY"
```

3. `briefings` row를 확인한다.

확인 필드:

- `user_id`
- `type = daily`
- `briefing_date`
- `content`
- `metadata.past_chunk_source`
- `metadata.past_chunk_count`
- `metadata.tomorrow_block_count`
- `metadata.recent_memo_count`
- `metadata.model`

4. 앱 브리핑 탭에서 확인한다.

성공 기준:

- 최신 브리핑 카드가 상단에 표시된다.
- `과거 브리핑 인박스` 목록이 열린다.
- 항목을 누르면 상세 modal이 열린다.

## 10. State B 네트워크 E2E

1. 메모 여러 개를 sync한다.
2. backend daily maintenance로 `memo_chunks`를 만든다.
3. 앱에서 메모 문장 중간에 커서를 둔다.
4. `... > 네트워크 보기`를 누른다.
5. Ambient Mirror도 확인한다.

성공 기준:

- 수동 네트워크 그래프가 열린다.
- 결과가 없거나 backend 실패 시 앱이 죽지 않는다.
- Ambient Mirror는 타이핑 중 보이지 않는다.
- 입력이 3초 멈춘 뒤 유사 문장 1개만 표시된다.
- 상세 창 하이라이트는 저장되지 않는다.

## 11. State A 무의식 지도 E2E

1. 내용 있는 메모를 여러 개 sync한다.
2. `topic_dirty = true`가 있는지 확인한다.
3. backend daily maintenance를 호출한다.
4. `topic_clusters`, `topic_cluster_memos` 생성 여부를 확인한다.
5. 앱 메모 사이드바에서 `무의식 지도`를 연다.

성공 기준:

- topic data가 있으면 Supabase topic graph를 표시한다.
- topic data가 없으면 local category fallback graph를 표시한다.
- 필터는 `최근 1달 / 최근 6개월 / 최근 1년 / 전체`만 제공한다.

## 12. Cron 설정

권장 순서:

```text
21:30 KST backend /maintenance/daily-all
22:00 KST Supabase Edge Function /daily-briefing
```

Cloud Scheduler 예시:

```sh
gcloud scheduler jobs create http memoria-daily-maintenance \
  --location asia-northeast3 \
  --schedule "30 12 * * *" \
  --uri "https://<cloud-run-service-url>/maintenance/daily-all" \
  --http-method POST \
  --headers "Content-Type=application/json,x-backend-admin-key=<BACKEND_ADMIN_KEY>" \
  --message-body "{}"
```

```sh
gcloud scheduler jobs create http memoria-daily-briefing \
  --location asia-northeast3 \
  --schedule "0 13 * * *" \
  --uri "https://kwrbbxctutngcoqtccjv.supabase.co/functions/v1/daily-briefing" \
  --http-method POST \
  --headers "x-daily-briefing-key=<letters-only-daily-briefing-cron-key>"
```

성공 기준:

- 수동 실행이 먼저 성공해야 한다.
- 이후 scheduler 실행 로그에서 HTTP 200을 확인한다.

## 13. Notification 범위 검증

v1 알림 범위:

- 데일리 브리핑 알림
- 캘린더 블럭 알림

명시적으로 제외:

- 메모 작성 중 실시간 추천 알림
- 네트워크/Ambient Mirror 알림
- topic discovery 완료 알림
- 마케팅성 푸시

검증 항목:

- 브리핑 알림은 `briefings` 생성 이후에만 발송 대상으로 잡는다.
- 캘린더 블럭 알림은 `calendar_blocks.start_date` 기준으로만 잡는다.
- 알림 권한을 거부해도 메모 작성, 로컬 일정 등록, 브리핑 탭 진입이 막히지 않는다.
- 알림 payload에는 민감한 메모 전문을 넣지 않는다. 제목/시간 또는 짧은 preview만 허용한다.
- 알림 설정은 나중에 브리핑 / 캘린더 블럭을 각각 끌 수 있도록 분리한다.

## 14. Widget 확장성 점검

v1에서 당장 위젯을 출시하지 않더라도 아래 구조를 막지 않는다.

위젯 후보:

- 오늘/내일 캘린더 블럭 요약
- 최신 브리핑 한 줄 preview
- 흩어진 일정 inbox count

출시 전 점검:

- 브리핑 데이터는 `briefings`에서 날짜별로 조회 가능해야 한다.
- 캘린더 블럭은 `calendar_blocks.start_date` 기준으로 오늘/내일 필터가 가능해야 한다.
- 위젯에 보여줄 텍스트는 앱 내부 메모 전문이 아니라 요약/제목 중심이어야 한다.
- iOS Widget Extension을 추가할 경우 app group, shared storage, 개인정보 고지를 별도 체크한다.

## 15. Landing Page / 도메인 준비

1. 랜딩 페이지용 도메인을 구매한다.
2. 앱 이름과 도메인명이 충돌하지 않는지 확인한다.
3. 소개 웹페이지를 만든다.
4. 개인정보처리방침 URL을 만든다.
5. 계정 삭제 안내 페이지 또는 섹션을 만든다.
6. App Store 심사용 support URL을 준비한다.
7. AI/자동 분석 기능 안내 문구를 넣는다.
8. 로그인 제공자 Kakao / Google 사용 사실을 개인정보처리방침에 반영한다.

랜딩 페이지 최소 구성:

- 앱 한 줄 소개
- local-first 메모장 설명
- 브리핑 / 캘린더 블럭 / 무의식 지도 소개
- 로그인과 동기화는 선택 기능이라는 설명
- 개인정보처리방침 링크
- 문의 이메일

## 16. App UI Regression

메모 탭:

- 새 메모 생성
- 빈 새 메모 목록 진입 후 다시 선택
- 메모 작성/수정/삭제/고정
- 키보드 열린 상태에서 탭 이동
- DateQuickActions 위치
- 날짜 tooltip 위치
- 선택 텍스트 수동 일정 등록
- 네트워크 수동/자동 UI

캘린더 탭:

- 월별 일정 미리보기
- 날짜 탭 일정 목록 modal
- 이번 주 블럭 한눈에 보기
- 주차 이동
- 블럭 추가
- 블럭 탭 편집
- 블럭 드래그 이동/교환
- 블럭 삭제

브리핑 탭:

- 최신 브리핑 카드
- 과거 브리핑 인박스
- 일정 인박스
- 일정 등록/수정/무시
- 로그인 안 된 상태에서 온라인 기능 클릭 시 로그인 요청 팝업

로그인:

- Kakao 로그인 버튼
- Google 로그인 버튼
- 로그인 성공 후 후발 sync
- 로그아웃 후 local-first 최소 기능 유지

## 17. Build / Device Test

1. TypeScript 확인

```sh
corepack pnpm exec tsc --noEmit
```

2. backend syntax 확인

```sh
backend/.venv/bin/python -m compileall backend/app
```

3. Metro 실행

```sh
corepack pnpm start --reset-cache
```

4. Xcode 실행

```sh
open ios/*.xcworkspace || open ios/*.xcodeproj
```

5. 실제 기기 테스트 시 확인

- 앱 `.env`의 `MEMO_BACKEND_URL`이 Cloud Run URL인지 확인
- 로컬 네트워크 IP가 들어가 있으면 출시 빌드 전 수정
- 강제종료 로그 확인
- Xcode Release build 확인

## 18. macOS DMG Direct Distribution

현재 macOS 직접 배포 기준은 기존 `macos/` React Native macOS 프로젝트를 사용한다.

1. 앱 `.env`를 배포값으로 맞춘다.

```text
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
MEMO_BACKEND_URL=https://<cloud-run-service-url>
```

`MEMO_BACKEND_URL`이 `localhost`, `127.0.0.1`, `0.0.0.0`이면 DMG 빌드 스크립트가 중단된다. 로컬 설치 테스트만 할 때는 `ALLOW_LOCALHOST_BACKEND=1`을 붙인다.

2. 로컬 테스트용 unsigned DMG를 만든다.

```sh
corepack pnpm macos:dmg
```

3. 공개 배포용 signed/notarized DMG를 만든다.

```sh
export DEVELOPER_ID_APPLICATION="Developer ID Application: <Team Name> (<TEAM_ID>)"
export NOTARYTOOL_PROFILE="<notarytool-keychain-profile>"
corepack pnpm macos:dmg
```

스크립트 동작:

- TypeScript, Jest, ESLint 검증
- `MemoApp-macOS` Release 빌드
- `Subnota.app`을 DMG staging 폴더에 복사
- `/Applications` symlink 포함
- Developer ID가 있으면 app/DMG 서명
- Notary profile이 있으면 notarization과 staple 실행

출력 위치:

```text
dist/macos/Subnota-<version>-<timestamp>/Subnota-<version>.dmg
```

## 19. Windows Distribution

현재 Windows native project는 아직 없다. Windows 출시는 `docs/windows-release.md`를 기준으로 별도 진행한다.

```sh
corepack pnpm windows:check
```

현재 차단 조건:

- Windows 패키징은 Windows + Visual Studio Build Tools 환경에서 진행해야 한다.
- `windows/` 프로젝트가 아직 없다.
- `react-native-windows`가 아직 설치되지 않았다.
- `react-native`와 `react-native-windows`의 major/minor 버전이 맞아야 한다.

macOS DMG 준비 과정에서 iOS 프로젝트는 수정하지 않는다.

## 20. App Store 준비

- 앱 이름 확정
- bundle id 확정
- 앱 아이콘
- 스플래시
- 랜딩 페이지용 도메인
- 개인정보처리방침 URL
- 소개 웹페이지
- 계정 삭제 방법
- Kakao / Google 로그인 심사 관련 고지
- 알림 권한 사용 목적 고지
- 위젯 확장 예정 시 개인정보 노출 범위 검토
- AI 기능 안내
- 데이터 동기화/분석 고지
- TestFlight 내부 테스트
- TestFlight 외부 테스트

## 21. 출시 전 최종 판단

출시 전 최소 통과 기준:

- local memo/calendar 기능이 로그인 없이 안정적이다.
- Kakao / Google 로그인 후 `profiles`, `memos`, `calendar_blocks` sync가 된다.
- 로그인 전 작성한 로컬 데이터가 로그인 후 후발 sync된다.
- backend deployed URL의 `/health`가 정상이다.
- backend daily maintenance가 HTTP 200이다.
- Supabase `daily-briefing`이 HTTP 200이다.
- 브리핑 탭이 latest briefing과 inbox를 보여준다.
- 네트워크 실패가 앱 크래시로 이어지지 않는다.
- 브리핑 알림과 캘린더 블럭 알림 외 알림 범위가 늘어나지 않았다.
- 랜딩 페이지, 개인정보처리방침, 계정 삭제 안내 URL이 준비됐다.
- 위젯 확장 시 필요한 데이터 경계가 막히지 않았다.
- 노출된 secret이 모두 회전됐다.
