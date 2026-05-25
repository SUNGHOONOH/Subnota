# Subnota Desktop PWA 출시 순서

이 폴더는 Mac/Windows 데스크톱 사용자를 위한 설치형 PWA입니다. iOS/macOS React Native 앱과 같은 Supabase 프로젝트를 사용하고, 데스크톱에서는 `subnota.com/app` URL을 Chrome/Edge/Safari에서 설치하는 방식으로 배포합니다.

## 1. 로컬 실행

```bash
cd /Users/sunghoon/Projects/memo/MemoApp/pwa
corepack pnpm install
corepack pnpm dev
```

브라우저에서 `http://localhost:5173/app/`을 엽니다.

## 2. 환경변수

로컬 개발은 `.env.local`을 사용합니다. 이 파일은 git에 올리지 않습니다.

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-anon-key>
VITE_MEMO_BACKEND_URL=https://<cloud-run-backend-url>
```

주의:

- PWA에는 `SUPABASE_SERVICE_ROLE_KEY`, `SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `HF_TOKEN`을 넣지 않습니다.
- 브라우저 번들에 들어가는 값은 사용자에게 노출됩니다.
- Supabase anon key는 RLS 정책과 함께 쓰는 공개 클라이언트 키입니다.

## 3. Supabase Auth 설정

Supabase Dashboard에서 다음 URL을 등록합니다.

- Site URL: `https://subnota.com/app/`
- Redirect URLs:
  - `http://localhost:5173/app/`
  - `https://subnota.com/app/`

Google/Kakao OAuth를 켜면 PWA의 로그인 버튼이 바로 같은 흐름을 사용합니다.

## 4. 빌드 검증

```bash
cd /Users/sunghoon/Projects/memo/MemoApp/pwa
corepack pnpm build
corepack pnpm preview
```

`preview`는 프로덕션 빌드 결과를 로컬에서 확인하는 단계입니다.

## 5. Vercel 배포

Vercel에서 새 프로젝트를 만들 때 root directory를 아래로 지정합니다.

```text
pwa
```

Build command:

```bash
corepack pnpm build
```

Output directory:

```text
dist
```

`pwa/vercel.json`은 `/app/*` 요청을 `dist/*` 파일로 rewrite합니다. 그래서 빌드 결과물은 `dist/assets`에 있어도 브라우저에서는 `/app/assets/...`로 접근합니다.

Environment variables:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_MEMO_BACKEND_URL
```

Cloud Run backend에는 PWA origin을 CORS에 넣어야 State B 네트워크 검색이 브라우저에서 막히지 않습니다.

```bash
CORS_ALLOW_ORIGINS=https://subnota.com,http://localhost:5173,http://127.0.0.1:5173
```

## 6. PWA 설치 확인

배포 후 Chrome/Edge에서 `https://subnota.com/app/`을 열고 다음을 확인합니다.

- 주소창 또는 메뉴에 설치 버튼이 보이는지
- 설치 후 Windows 시작 메뉴 또는 macOS Dock에서 Subnota가 열리는지
- 주소창 없는 standalone 창으로 실행되는지
- 로그인, 메모 작성, 캘린더 블럭 추가, 브리핑 조회가 동작하는지
- 메모 화면의 `무의식 지도`, `네트워크`, `일정 등록`이 동작하는지
- 브리핑 일정 후보의 등록/수정/무시가 동작하는지
- 오프라인에서 앱 shell이 열리는지
- Chrome/Edge는 설치 prompt가 뜨는지, macOS Safari는 Dock 추가 안내가 자연스러운지

## 7. 랜딩 페이지 연결

랜딩 페이지의 데스크톱 CTA는 `https://subnota.com/app/`으로 연결합니다.

권장 문구:

```text
Mac/Windows에서 설치
```

브라우저가 설치 조건을 만족하면 PWA 설치 버튼이 나타납니다. 조건을 만족하지 않는 경우에도 웹앱으로 바로 사용할 수 있습니다.

## 8. Microsoft Store 확장

초기 출시는 PWA URL 배포로 충분합니다. Store 배포가 필요해지면 PWABuilder 또는 Microsoft Store PWA 패키징을 검토합니다.

Store 전 준비:

- PNG 아이콘 세트 추가
- 개인정보처리방침 URL 준비
- 앱 설명/스크린샷 준비
- 알림 권한 사용 여부 명확화
- OAuth redirect URL에 Store/PWA 도메인 유지

## 9. 현재 포함 기능

- 로그인 필수 시작 화면
- 이메일/비밀번호 로그인 및 회원가입
- Google/Kakao OAuth 버튼
- 메모 세션 목록, 새 메모, 자동 저장, 삭제
- 메모 빠른 날짜 입력, 날짜 감지, 선택 텍스트 일정 등록
- State A 무의식 지도: Supabase `topic_clusters` 기반 topic graph, `최근 1달 / 최근 6개월 / 최근 1년 / 전체` 필터, topic 선택 시 빠른 보기/관계 보기 detail panel
- State B 네트워크: 수동 그래프 검색, idle 3초 Ambient Mirror, 유사 문장 detail panel, 과거 메모 임시 초록 하이라이트
- 월별/주간 캘린더 블럭 조회/추가/수정/삭제, 날짜별 일정 목록
- 데일리 브리핑 메인 카드 및 과거 브리핑 인박스
- 일정 추천 inbox 등록/수정/무시
- PWA manifest/service worker/설치 버튼

## 10. 다음 구현 후보

- 데스크톱 웹 푸시 알림
- PWA Store 패키징
- 오프라인 작성 후 로그인 시 후발 업로드 UX 강화
