# Subnota 출시 및 배포 체크리스트 (Release Checklist)

이 문서는 Subnota 서비스를 프로덕션 환경에 성공적으로 배포하고 출시하기 위해 수행해야 할 모든 태스크를 단계별(Phase)로 정갈하게 정리한 마스터 체크리스트입니다.

---- 모바일 웹페이지 별로임 ----

## 0. 배포 및 개발 원칙

- **로컬 퍼스트 (Local-first)**: 핵심 기능(메모 작성, 수정, 수동 일정 등록)은 네트워크 연결이 끊겨도 로컬에서 완전하게 동작해야 합니다.
- **로그인 우선 진입**: 출시 버전은 앱 시작 시 로그인을 요구합니다. Google 및 Kakao OAuth를 기본 로그인 경로로 제공하며, 로그인 이후 메모 동기화, 캘린더, AI 분석, 브리핑 기능을 사용할 수 있게 합니다.
- **후발 동기화 (Post-login Sync)**: 향후 비로그인 로컬 작성 흐름을 다시 허용할 경우, 로그인 시 기존 로컬 메모와 캘린더 블럭을 Supabase로 업서트하는 병합 플로우를 별도 구현합니다.
- **동기화 (Sync)**: 온라인 동기화 및 AI 분석 기능은 로그인 완료 후 Supabase와 연동되었을 때만 백그라운드에서 동작합니다.
- **인증 보안**: 클라이언트 앱 번들에는 절대 마스터 비밀 키를 주입하지 않으며, 오직 `SUPABASE_ANON_KEY`만 포함합니다.
- **서버 보안**: Supabase Service Role Key, Hugging Face Token, Gemini API Key, Backend Admin Key 등 민감한 자격 증명은 오직 서버(Cloud Run) 및 Supabase Edge Function Secret 환경변수로만 제어합니다.
- **알림 최소화**: 1차 출시 버전(v1)에서는 아침 브리핑 알림과 캘린더 일정 리마인드 알림만 지원합니다. 타이핑 도중에 실시간으로 추천 알림이 와서 작성 흐름을 끊는 일은 없어야 합니다.
- **단일 도메인 통합**: 랜딩 페이지(`subnota.com`)와 PWA 웹앱(`subnota.com/app`)은 하나의 통합 도메인과 서브패스(Subpath) 구조로 Vercel에서 라우팅 처리합니다.

### 0.1. 플랫폼별 출시 전략

- **iOS**: Apple Developer Program 결제 후 App Store 출시를 목표로 합니다. PWA는 iOS의 자동 설치 팝업 제약이 크므로, iOS 사용자는 네이티브 앱 출시를 주력 경로로 둡니다.
- **macOS**: Apple Developer Program 결제 후 Developer ID 서명, notarization, `.dmg` 배포를 준비합니다. 심사/서명 준비가 끝나기 전까지는 `subnota.com/app` PWA를 임시 사용 경로로 둡니다.
- **Windows**: v1은 네이티브 exe가 아니라 `subnota.com/app` PWA 설치 경로로 출시합니다. Chrome/Edge에서는 가능한 경우 브라우저 네이티브 PWA 설치 프롬프트를 사용하고, 불가능한 환경에서는 설치 안내 모달을 보여줍니다.
- **랜딩 다운로드 버튼 정책**: 다운로드 버튼 클릭 시 가능한 브라우저에서는 즉시 PWA 설치 프롬프트를 호출하고, Safari/iOS처럼 프롬프트가 불가능한 환경에서는 플랫폼별 설치 안내 또는 출시 예정 안내로 분기합니다.
- **자동 설치 제한**: 모든 플랫폼에서 버튼 클릭 즉시 설치 완료는 불가능합니다. 브라우저/OS 정책상 사용자의 명시적인 설치 승인 액션이 필요하므로, 제품 문구는 "즉시 설치 시작" 또는 "앱으로 열기" 수준으로 표현합니다.

---

## 1단계: Supabase 데이터베이스 및 서버 환경 구축 (Database & Edge Functions)

### 1.1. 최종 DB 스키마 확정
- [x] Supabase SQL Editor를 열고 최종 스키마 스크립트를 실행 및 적용합니다.
  * 파일 위치: `supabase/migrations/20260519_final_schema.sql`
- [x] 권한(GRANT) 설정이 프로덕션 DB에 바르게 부여되었는지 확인합니다.
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
- [ ] 로컬 환경에서 Service Role Key를 활용한 프로덕션 DB 조회가 정상 작동하는지 연결 확인합니다.
  cd /Users/sunghoon/Projects/memo/MemoApp
set -a
source supabase/.env.local
set +a

# SERVICE_ROLE_KEY 대신 SUPABASE_SERVICE_ROLE_KEY 로 수정된 명령입니다.
curl -i "$SUPABASE_URL/rest/v1/profiles?select=id&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
  * **성공 기준**: HTTP 상태코드 `200` 반환 (데이터가 없을 시 빈 배열 `[]` 반환)

### 1.2. 프로덕션용 비밀 키(Secrets) 회전 및 정리
- [ ] 출시 직전 아래의 개발용 키를 폐기하고 프로덕션 전용 키로 전면 재발급하여 회전(Rotation)시킵니다.
  * `SUPABASE_SERVICE_ROLE_KEY`
  * `GEMINI_API_KEY`
  * `HF_TOKEN`
- [x] `BACKEND_ADMIN_KEY`와 `DAILY_BRIEFING_CRON_KEY`를 새로 발급합니다.
  * **주의**: 외부 셸 스크립트나 curl 요청에서 오작동을 피하기 위해 특수문자 없이 **영문 알파벳과 숫자만 조합**된 커스텀 키로 발급합니다.
- [ ] 각 컴포넌트별로 배포 파일 내 환경변수 적용 상태를 체크합니다.
  * **클라이언트 PWA 앱 (`.env`)**: 오직 아래의 공용 키 3개만 유지해야 합니다.
    ```text
    SUPABASE_URL=
    SUPABASE_ANON_KEY=
    MEMO_BACKEND_URL=
    ```
  * **파이썬 백엔드 (`backend/.env`)**
  * **Supabase Edge Function (`supabase/.env.local`)**

### 1.3. Supabase Edge Function 배포 및 확인
- [x] 프로덕션용 비밀 키(Secrets)를 Supabase 클라우드 서버에 업로드합니다.
  ```sh
  cd /Users/sunghoon/Projects/memo/MemoApp
  
  supabase secrets set \
    --env-file supabase/.env.local \
    --project-ref kwrbbxctutngcoqtccjv
  ```
  * `SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `DAILY_BRIEFING_CRON_KEY`가 올바르게 주입되었는지 확인합니다. (`SUPABASE_` 접두사 변수 제외)
- [x] `daily-briefing` 엣지 펑션을 배포합니다.
  ```sh
  supabase functions deploy daily-briefing \
    --project-ref kwrbbxctutngcoqtccjv \
    --no-verify-jwt
  ```
- [x] 외부망에서 인증 키를 활용하여 해당 API를 수동 테스트해봅니다.
  ```sh
  curl -X POST https://kwrbbxctutngcoqtccjv.supabase.co/functions/v1/daily-briefing \
    -H "x-daily-briefing-key: $DAILY_BRIEFING_CRON_KEY"
  ```
  * **성공 기준**: 유저가 없을 경우 `{"briefing_date":"YYYY-MM-DD","results":[]}` 반환

---

## 2단계: AI 및 형태소 분석 파이썬 백엔드 배포 (GCP Cloud Run)

### 2.1. 로컬 통합 기능 검증 (Kiwi & Chunking)
- [x] 로컬 백엔드를 가동합니다.
  ```sh
  cd /Users/sunghoon/Projects/memo/MemoApp/backend
  source .venv/bin/activate
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```
- [x] 헬스 체크 API를 호출합니다.
  ```sh
  curl http://localhost:8000/health
  ```
  * **성공 기준**: `{"status":"ok"}`
- [x] 한글 형태소 분석기(Kiwi) 및 텍스트 쪼개기(Chunking) 기능이 이상 없이 동작하는지 테스트합니다.
  ```sh
  curl -X POST http://localhost:8000/memo-chunks/split \
    -H "Content-Type: application/json" \
    -d '{"text":"내일 3시 팀장님 미팅. 다음 주에는 제품 회의 준비하기.","cursor_index":5}'
  ```
  * **성공 기준**: 형태소별 문장 및 텍스트 덩어리가 알맞게 분리되어 반환되는지 확인

### 2.2. GCP Cloud Run 빌드 및 배포
- [x] GCP 콘솔에서 프로덕션용 Google Cloud 프로젝트를 개설하고 결제 계정(Billing)을 연동합니다.
- gcd /Users/sunghoon/Projects/memo/MemoApp/backend
- [x] 로컬 셸에 `gcloud` CLI 툴을 구성하고 타겟 프로젝트 및 리전을 설정합니다.
  ```sh
  gcloud auth login
  gcloud config set project subnota-backend
  gcloud config set run/region us-central1
  ```
- [x] 배포 및 기능 제어에 필수적인 Google API들을 활성화합니다.
  ```sh
  gcloud services enable run.googleapis.com \
                         cloudbuild.googleapis.com \
                         artifactregistry.googleapis.com \
                         secretmanager.googleapis.com \
                         cloudscheduler.googleapis.com \
                         iam.googleapis.com \
                         cloudresourcemanager.googleapis.com
  ```
- [x] GCP Secret Manager에 백엔드 구동용 환경변수들을 등록합니다.
  * 필수 보안 변수: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `HF_TOKEN`, `BACKEND_ADMIN_KEY`
- [x] Cloud Run의 기본 서비스 계정이 Secret Manager의 보안 환경변수를 읽을 수 있도록 IAM 접근 권한을 부여합니다.
  ```sh
  gcloud projects add-iam-policy-binding <GCP_PROJECT_ID> \
    --member="serviceAccount:<GCP_PROJECT_NUMBER>-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
  ```
- [x] 컨테이너 빌드를 올리고 Cloud Run 배포를 마무리합니다.
- [x] 배포된 최종 프로덕션 백엔드 URL을 복사하여 클라이언트 PWA 앱 설정 파일(`.env`)의 `MEMO_BACKEND_URL`에 덮어씌웁니다.
  ```text
  MEMO_BACKEND_URL=https://<cloud-run-service-url>
  ```

### 2.3. 프로덕션 백엔드 검증 및 캘린더 처리 확인
- [x] 배포 완료된 Cloud Run 서버의 헬스체크 주소를 확인합니다.
  ```sh
  curl https://<cloud-run-service-url>/health
  ```
- [x] 일일 정기 데이터 정돈 작업(Daily Maintenance)을 관리자 권한으로 수동 강제 구동해 봅니다.
  ```sh
  curl -X POST https://subnota-backend-197147115380.us-central1.run.app/maintenance/daily-all \
    -H "x-backend-admin-key: GBEDtkFUZfRVflctyxdItrzCmhXZRlYRjShmLseKyqbofTCI" \
    -H "Content-Type: application/json" \
    -d '{}'
  ```
  * **성공 기준**: HTTP 상태코드 `200` 반환 및 Supabase 상의 `schedule_inbox`, `memo_chunks`, `topic_clusters` 테이블에 정리된 데이터가 정상적으로 캐싱/적재되는지 관측

---

## 3단계: 클라이언트 배포 및 도메인 연동 (Vercel & DNS)

### 3.1. Windows용 PWA 웹앱 배포 및 환경변수 주입
- [x] Vercel 대시보드에서 신규 프로젝트를 생성하고 연동된 저장소를 연결합니다.
- [x] **Root Directory**를 `MemoApp/pwa` 폴더로 타겟 지정합니다.
- [x] **Environment Variables** 항목에 Supabase 연동 변수를 기재합니다.
  * Key: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_MEMO_BACKEND_URL` (배포 완료된 Cloud Run URL 주소)
- [x] 배포를 실행하고 최종 부여된 Vercel 임시 URL(예: `https://subnota-pwa.vercel.app`)을 기록합니다.
- [ ] Windows Chrome/Edge에서 `https://subnota.com/app` 접속 후 PWA 설치 프롬프트가 정상 노출되는지 확인합니다.
- [ ] 설치 후 Windows 시작 메뉴/작업 표시줄에서 Subnota PWA가 독립 앱처럼 실행되는지 확인합니다.

### 3.2. Next.js 랜딩 페이지 배포 및 프록시 설정
- [x] `web/vercel.json` 파일을 작성하여 `/app` 하위 주소로 들어온 트래픽을 위에서 확보한 PWA 주소로 우회시키는 리라이트(Rewrite) 룰을 선언합니다.
  ```json
  {
    "rewrites": [
      {
        "source": "/app/:path*",
        "destination": "https://subnota-app.vercel.app/app/:path*"
      }
    ]
  }
  ```
- [x] Vercel에 두 번째 프로젝트를 만들고 **Root Directory**를 `web` 폴더로 지정합니다.
- [x] 이 `web` 프로젝트는 다운로드 파일 대신 `/app` 경로로 연결되도록 하드코딩 교체되었으므로 **별도의 Vercel 환경변수 세팅 없이 바로 배포**합니다.
- [x] 배포된 `web` 프로젝트 설정에서 구매하신 최종 도메인인 **`subnota.com`**을 추가합니다.
- [x] 도메인 구입처(대행업체) 관리자 창을 열고, Vercel이 지시하는 DNS 설정값(A 레코드 혹은 CNAME)을 입력하여 네임서버 및 도메인 목적지를 세팅합니다.
- [x] 잠시 기다린 후 `https://subnota.com` 및 `https://subnota.com/app`에 자물쇠(HTTPS SSL 인증)가 안전하게 풀려 모든 기능이 접속되는지 확인합니다.
- [ ] 랜딩페이지의 모든 다운로드 버튼이 플랫폼별 정책에 맞게 동작하는지 확인합니다.
  * Windows: `/app` 진입 및 PWA 설치 프롬프트
  * macOS: `.dmg` 출시 전에는 PWA 설치/안내, 출시 후에는 `.dmg` 다운로드
  * iOS: App Store 출시 전에는 출시 예정/대기 안내, 출시 후에는 App Store 링크

### 3.3. 웍스모바일(네이버웍스) 도메인 소유권 확인 및 메일 연동 설정
- [x] 웍스모바일 Admin(https://admin.worksmobile.com/)에 로그인하여 **기본 설정 ➡️ 도메인 ➡️ 도메인 추가**를 진행하고 `subnota.com`을 등록합니다.
- [x] 소유권 확인 수단으로 **[TXT 레코드 등록]**을 선택하고, 제공된 **호스트 이름(`@` 혹은 빈값)**과 **TXT 레코드 값**(`works-site-verification=...`)을 복사합니다.
- [x] **Vercel 대시보드**의 도메인 관리 화면(`https://vercel.com/dashboard/domains` 혹은 Landing Page 프로젝트 설정의 Domains)으로 이동합니다.
- [x] `subnota.com` 도메인 우측의 **DNS Records** 또는 **Manage** 버튼을 클릭하고 다음 DNS 레코드들을 추가합니다:
  * **도메인 소유권 확인용 TXT 레코드**
    - **Type**: `TXT`
    - **Name**: `@` (또는 빈칸)
    - **Value**: 복사한 `works-site-verification=xxxx...`
  * **메일 수발신용 MX 레코드 (1차)**
    - **Type**: `MX`
    - **Name**: `@` (또는 빈칸)
    - **Target/Value**: `kr1-mail.worksmobile.com`
    - **Priority (우선순위)**: `10`
  * **메일 수발신용 MX 레코드 (2차)**
    - **Type**: `MX`
    - **Name**: `@` (또는 빈칸)
    - **Target/Value**: `kr2-mail.worksmobile.com`
    - **Priority (우선순위)**: `20`
- [x] Vercel DNS 설정 저장을 마치고, 웍스모바일 관리자 화면으로 돌아가 **[소유권 확인]** 또는 **[인증 완료]** 버튼을 클릭합니다.
  * *참고: DNS 전파에는 보통 1~10분 정도 소요되며, 상황에 따라 다소 지연될 수 있습니다.*

### 3.4. 검색엔진 최적화(SEO) 및 웹마스터 도구 등록
- [x] `web/public/robots.txt` 파일에 검색엔진 수집 정책(랜딩페이지 허용, `/app` 하위 PWA 차단)이 정상적으로 작성되어 배포되었는지 확인합니다.
- [x] **Google Search Console**(https://search.google.com/search-console)에 접속하여 `https://subnota.com`을 등록합니다.
  * 소유권 확인 시, Vercel DNS 설정에 Google에서 제공한 TXT 레코드를 추가하여 인증을 완료합니다.
- [ ] **네이버 서치어드바이저**(https://searchadvisor.naver.com/)에 접속하여 `https://subnota.com`을 등록합니다.
  * 소유권 확인 시, Vercel DNS 설정에 네이버에서 제공한 TXT 레코드를 추가하거나 HTML 소유확인 파일을 `web/public` 폴더에 임시 업로드 및 배포하여 인증을 완료합니다.

---

## 4단계: 로그인 플랫폼 API 연동 및 개인정보 처리방침 (Auth & OAuth)

### 4.1. Supabase Auth URL Configuration 업데이트
- [ ] Supabase 프로젝트 대시보드의 **Auth -> URL Configuration**으로 이동합니다.
- [ ] **Site URL** 항목을 `https://subnota.com/app`으로 교체합니다.
- [ ] **Redirect URLs** 목록에 PWA의 인증 리다이렉션을 위해 `https://subnota.com/app/*`를 화이트리스트로 신규 추가합니다.

### 4.2. 구글 / 카카오 소셜 로그인 Redirect URI 등록
- [ ] **Google Cloud Console**에 로그인한 뒤 API 및 서비스 ➡️ OAuth 동의 화면 및 사용자 인증 정보로 이동합니다.
  * 승인된 리디렉션 URI(Authorized redirect URIs)에 Supabase 인증 주소를 기입합니다.
    `https://kwrbbxctutngcoqtccjv.supabase.co/auth/v1/callback`
- [ ] **Kakao Developers**에 로그인한 뒤 내 애플리케이션 ➡️ 제품 설정 ➡️ 카카오 로그인으로 이동합니다.
  * 활성화 상태를 **ON**으로 켜고, 리디렉션 URI(Redirect URI)에 아래 Supabase 콜백 주소를 기입합니다.
    `https://kwrbbxctutngcoqtccjv.supabase.co/auth/v1/callback`
- [ ] Supabase Auth 대시보드 내 Providers 섹션에서 Google과 Kakao 설정에 발급받은 ID 및 Secret Key 값을 채워 넣어 인증 공급자를 활성화합니다.
- [ ] **Google OAuth 동의 화면** 설정에서 앱의 게시 상태(Publishing status)를 **[앱 게시(Publish App)]**로 변경하여 테스트 모드를 종료합니다.
  * *참고: 테스트 모드인 상태에서는 등록된 테스트 사용자만 소셜 로그인이 가능하며, 일반 사용자는 로그인 시 보안 경고(Unverified App) 창이 뜹니다.*
- [ ] **Kakao Developers** 설정에서 **카카오 로그인 ➡️ 동의항목**으로 이동하여 서비스에 필요한 항목(닉네임, 프로필 이미지, 이메일 등)의 설정 상태를 점검합니다.
  * 이메일 수집 등 필수 권한 설정이 개인정보 정책에 부합하는지 확인하고, 일반 가입자가 거부감 없이 가입할 수 있도록 항목을 다듬습니다. 필요시 개인 비즈니스 채널 인증을 받아 이메일 필수 동의 권한을 얻습니다.

### 4.3. 개인정보 처리방침 문서 게재
- [ ] 구글/카카오 OAuth 연동에 따른 **개인정보 처리방침(Privacy Policy)** 문서를 생성합니다.
  * 포함 필수 내용: 구글 및 카카오 로그인을 통한 이메일/닉네임 수집 목적, 제3자 제공 금지 조항, 회원 탈퇴 및 계정 정보 삭제 절차
- [ ] 작성한 문서를 노션(Notion)에 업로드 후 '웹에 게시' 기능을 켜거나, 깃허브 페이지에 업로드합니다.
- [ ] 확보한 웹 링크 주소를 푸터의 `개인정보 처리방침` 버튼 링크에 올바르게 연동합니다.

### 4.4. Apple Developer Program 및 iOS/macOS 배포 준비
- [ ] Apple Developer Program 결제를 완료합니다.
- [ ] Apple Developer 계정의 Team ID, Bundle ID, App ID를 정리합니다.
- [ ] iOS 앱 출시용 Bundle ID를 확정하고 Xcode Signing & Capabilities에 연결합니다.
- [ ] App Store Connect에 Subnota iOS 앱 레코드를 생성합니다.
- [ ] iOS 앱 아이콘, 스크린샷, 앱 설명, 개인정보 처리방침 URL, 지원 URL을 준비합니다.
- [ ] iOS TestFlight 내부 테스트 빌드를 업로드하고 로그인, 메모, 캘린더, 브리핑 핵심 플로우를 검증합니다.
- [ ] macOS `.dmg` 배포를 위한 Developer ID Application 인증서 발급 여부를 확인합니다.
- [ ] macOS 앱 패키징 방식(`.dmg` 직접 배포 또는 Mac App Store)을 최종 결정합니다.
- [ ] `.dmg` 직접 배포 시 코드 서명, notarization, Gatekeeper 경고 없는 실행까지 검증합니다.

---

## 5단계: 서비스 기능별 종단간 E2E 테스트 및 정밀 크론 등록 (Verification & Cron)

### 5.1. 가입 및 로컬-서버 데이터 동기화(Sync) 정밀 테스트
- [ ] 최초 앱 진입 시 로그인 화면이 먼저 노출되는지 확인합니다.
- [ ] 구글 또는 카카오 버튼을 눌러 로그인을 완료합니다.
- [ ] **로그인 완료 후 검증**:
  * Supabase `profiles` 테이블에 유저 레코드가 신규 생성되었는지 확인합니다.
  * 로그인 후 작성한 메모와 캘린더 일정 블럭이 서버의 `memos` 및 `calendar_blocks` 테이블로 업서트(Upsert)되는지 데이터베이스를 관측합니다.
  * 로그아웃 후 재로그인 시 서버에 저장된 메모와 캘린더 블럭이 다시 불러와지는지 테스트합니다.
  * 후발 동기화 기능을 다시 도입할 경우, 로그인 전 로컬 메모가 로그인 후 서버에 병합되는지 별도 회귀 테스트를 추가합니다.

### 5.2. AI 분석 기능 E2E 최종 확인
- [ ] 메모장에 `"내일 3시 미팅"`, `"다음 주 화요일 프로젝트 회고"` 등 자연어 약속을 포함한 메모를 작성합니다.
- [ ] 작성한 메모가 서버로 싱크된 것을 확인한 후, Cloud Run 백엔드 정기 정돈(`/maintenance/daily-all`)을 수동으로 호출해 봅니다.
- [ ] PWA 앱의 브리핑 화면 내 **'흩어진 일정 모아보기'**에서 AI가 감지한 미팅 일정이 알맞게 추천 목록에 등록되는지 검증합니다.
- [ ] 추천 목록에서 `캘린더에 등록` 버튼을 클릭했을 때 실제 캘린더 보드에 블럭이 옮겨지고, DB의 schedule_inbox 상태값이 `accepted`로 변하는지 검증합니다.

### 5.3. 아침 요약 브리핑 E2E 최종 확인
- [ ] Supabase Edge Function 배포 주소로 데일리 브리핑 강제 호출을 보냅니다.
  ```sh
  curl -X POST https://kwrbbxctutngcoqtccjv.supabase.co/functions/v1/daily-briefing \
    -H "x-daily-briefing-key: $DAILY_BRIEFING_CRON_KEY"
  ```
- [ ] DB의 `briefings` 테이블에 오늘 날짜(`type = daily`)로 요약된 내용 및 메타데이터 레코드가 잘 기록되었는지 확인합니다.
- [ ] PWA 앱의 브리핑 탭을 열었을 때, 생성된 최신 브리핑 카드가 첫 화면 상단에 잘 요약되어 노출되는지 최종 체크합니다.

### 5.4. 주기적 자동 실행을 위한 Cloud Scheduler 크론 등록
- [ ] 백엔드 정리 및 엣지 펑션 요약 연동이 매일 밤 자동으로 순차 실행되도록 크론 잡을 생성합니다.
  * 배포 권장 시각: **21:30 KST** 백엔드 연동 정리 ➡️ **22:00 KST** 데일리 브리핑 엣지 생성
- [ ] **백엔드 메인터넌스 스케줄러 등록**:
  ```sh
  gcloud scheduler jobs create http memoria-daily-maintenance \
    --location us-central1 \
    --schedule "30 12 * * *" \
    --uri "https://<cloud-run-service-url>/maintenance/daily-all" \
    --http-method POST \
    --headers "Content-Type=application/json,x-backend-admin-key=<BACKEND_ADMIN_KEY>" \
    --message-body "{}"
  ```
- [ ] **데일리 브리핑 생성 스케줄러 등록**:
  ```sh
  gcloud scheduler jobs create http memoria-daily-briefing \
    --location us-central1 \
    --schedule "0 13 * * *" \
    --uri "https://kwrbbxctutngcoqtccjv.supabase.co/functions/v1/daily-briefing" \
    --http-method POST \
    --headers "x-daily-briefing-key=<DAILY_BRIEFING_CRON_KEY>"
  ```
  *(주: 스케줄러 시간은 UTC 기준이므로 한국 시간 21시 30분은 `30 12 * * *`, 22시 정각은 `0 13 * * *`로 설정합니다.)*

---

## 6단계: 출시 전 최종 판단 기준 (Go / No-Go Checklist)

모든 배포가 성공적으로 완료되었음을 보장하기 위해 아래 6가지 기준을 전부 통과해야 출시(Go)를 선언합니다.

- [ ] **배포 주소 확인**: 브라우저 창에 `https://subnota.com` 입력 시 메인 페이지가 1.5초 내외로 열리고, `https://subnota.com/app`에 접속했을 때 로그인 및 PWA 설치 안내 팝업이 이상 없이 로드된다.
- [ ] **인증 연동 완료**: 구글 및 카카오 소셜 로그인이 실제 모바일 및 데스크톱 브라우저 환경에서 오류나 차단 경고 화면 없이 로그인 성공 및 후발 동기화(Sync)가 문제없이 체결된다.
- [ ] **플랫폼별 출시 경로 확정**: Windows는 PWA 설치 경로가 정상 동작하고, iOS는 App Store 출시 준비 상태가 명확하며, macOS는 PWA 임시 경로와 `.dmg` 출시 준비 상태가 문서화되어 있다.
- [ ] **오프라인 안정성**: 로그인 후 캐시된 데이터 기준으로 네트워크가 일시적으로 끊겨도 앱이 치명적으로 중단되지 않고, 다시 연결되었을 때 서버 데이터와 충돌 없이 동기화된다.
- [ ] **크론 스케줄 가동**: GCP Cloud Scheduler 실행 이력 로그에 에러(HTTP 4xx, 5xx)가 없으며, 정해진 시간대에 `briefings` 데이터가 안정적으로 새로고침된다.
- [ ] **보안 정보 검증**: 배포된 소스코드 번들을 뜯었을 때 Supabase 마스터 서비스 키나 외부 API 시크릿 값이 노출되어 있지 않다.
- [ ] **약관 정책 연결**: 랜딩 페이지 푸터의 개인정보 처리방침 링크를 누르면, 로그인 수집 목적 및 회원 탈퇴 방법이 명시된 노션/웹 문서 주소로 바르게 랜딩된다.
