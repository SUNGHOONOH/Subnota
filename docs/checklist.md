# Subnota 출시 · 기능점검 마스터 체크리스트

이 문서는 Subnota를 프로덕션에 배포·출시하기 위한 **기능 점검(QA)** 과 **배포(Release)** 체크리스트입니다.
과거 PWA 기반 점검 문서를 현재 아키텍처에 맞게 통합한 것으로, 이 문서를 단일 기준으로 사용합니다.

> 마지막 코드 대조: 2026-09-02. 구현이 바뀌면 이 문서의 체크 항목과
> `desktop/src/__tests__/` 회귀 테스트를 함께 갱신한다.

> 갱신 핵심: Windows/macOS는 더 이상 PWA가 아니라 **Electron 데스크톱 앱**입니다(`pwa/` 트리 제거됨). Supabase CLI 폴더는 레포 **루트 `supabase/`** 로 이동되었습니다(`--workdir mobile` 불필요).

> 2026-08-11 반영: Quick Subnota → **Quick Subnota** 로 표기 통일, 브랜드 마크(물망초)와
> 부팅 모션 도입, 로컬 임베딩 모델의 **명시적 다운로드 관문**, Ambient의 자동/수동
> 표시 정책 분리, 캘린더 일정 블록의 3단계 텍스트 규칙.

---

## 0. 원칙 & 아키텍처 현황

- **로컬 퍼스트**: 메모 작성/수정, 수동 일정 등록은 네트워크 없이도 완전 동작해야 한다. 타이핑은 절대 네트워크를 타지 않는다.
- **로그인 우선**: 출시 버전은 시작 시 로그인 요구(Google/Kakao OAuth). 동기화·AI·브리핑은 로그인 후 동작.
- **시크릿 경계**: 앱 번들엔 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MEMO_BACKEND_URL`만. service-role/HF/Gemini/YouTube/admin 키는 서버(Cloud Run)·Edge Function·Secret Manager에만.
- **플랫폼 전략(갱신)**
  - **iOS**: React Native(`mobile/`) → App Store.
  - **macOS/Windows**: 단일 Electron 앱(`desktop/`) → macOS `.dmg`(Developer ID 서명 + notarization), Windows Squirrel `.exe`.
  - **공유 정책**: 공통 UI/UX와 기능은 macOS 최신 구현을 기준으로 한 코드에서 관리. Quick Subnota는 양쪽 모두 지원한다.
  - **수집 정책**: Windows 수집함의 수동 URL 저장·동기화·열람은 지원한다. 현재 브라우저 페이지 자동 저장과 브라우저 확장 웹클리퍼만 Windows에서 추후 출시한다.
- **데이터/AI 백엔드**: FastAPI on Cloud Run(`subnota-backend`, `us-central1`) + Supabase(`kwrbbxctutngcoqtccjv`) + Edge Function(`daily-briefing`).
- **분석 정책**: 서버 일정 추천·Topics·메모 청킹/색인은 dirty-only 배치다. 단,
  데스크톱의 Ambient Mirror는 로컬 임베딩 색인과 별도로 로그인한 포그라운드
  에디터에서 5초 idle 후 현재 문맥을 검색한다.

---

## A. 기능 점검 (Feature QA)

빌드(또는 dev)에서 사람이 직접 확인. 데스크톱은 macOS·Windows **둘 다**.
사전 점검(코드 게이트): 데스크톱은 `desktop/`에서 Node 24를 사용해 `pnpm run lint` · `pnpm exec tsc --noEmit` · `pnpm test`를 실행한다. 모바일은 `corepack pnpm lint` · `corepack pnpm -s tsc --noEmit` · `corepack pnpm -s jest`를 실행한다.

### A.1 메모 / 에디터 (Tiptap)
- [ ] 새 메모 작성·수정·삭제, 마크다운(제목/목록/체크리스트/굵게/링크/코드블록/인용) 정상.
- [ ] 빈 메모(`""`)도 저장/유지.
- [ ] 네트워크 OFF에서 작성·수정 무중단(로컬 즉시 반영).
- [ ] 코드 블록 복사, 이미지 붙여넣기/업로드, frontmatter 블록, `/` 슬래시 명령이 정상.
- [ ] 날짜 자연어 하이라이트가 마크 경계와 줄바꿈을 가로질러도 본문 위치와 일치한다.
- [ ] 한글 IME 조합 중 글자가 유실되지 않고, 브라우저 자동 문장 교정이 원문을 바꾸지 않는다.
- [ ] 설정의 글자 크기(12–24px)·줄 간격(1.2–2.2)이 재시작 후에도 에디터 본문에 적용된다.
- [ ] 모바일 에디터 소스 변경 시 `corepack pnpm build:editor` 후 WebView 번들에 반영.
- [ ] 데스크톱 분할 탭에서 같은 메모 열기/탭 전환 시 내용 일관.
- [ ] 제목은 메모 첫 번째 비어 있지 않은 줄에서 파생되고, 제목/본문 왕복 저장 시 내용이 바뀌지 않는다.

### A.2 캘린더 / 일정 / 월간 기록
- [ ] 주/월 뷰 전환, `< 오늘 >` 네비, 일정 생성/수정/삭제/완료 토글.
- [ ] 종일 일정·시간 일정 모두 정상. 폼에서 입력한 분은 그대로 저장되고, 드래그는 15분 스냅(Shift 시 1분)만 적용된다.
- [ ] 시간 일정은 실제 시작·종료 길이를 유지하고, 5분 미만으로 줄어들지 않는다. 짧은 블록도 클릭하면 편집기가 열린다.
- [ ] 일정 블록의 텍스트는 높이에 따라 3단계다: `~24px` 제목 한 줄(15·30분) / `~43px` 제목 두 줄(45·60분) / `44px~` 제목 두 줄 + 시간. **공간은 제목이 먼저 가져가고 시간은 남을 때만 붙는다.** 길면 말줄임.
- [ ] 15분과 30분 블록의 높이가 서로 다르게 보인다(13px vs 18px). 하한이 두 값을 같게 만들지 않는다.
- [ ] 리사이즈 핸들이 클릭·이동 영역을 절반 넘게 먹지 않는다. 45분 이상 블록에서도 가운데를 잡아 옮길 수 있다.
- [ ] 드래그 이동·배치 시 겹치는 시간대를 자동으로 만들지 않고 가장 가까운 이전 빈 구간을 미리보기로 제시한다. 빈 날이 없으면 이동을 거부한다.
- [ ] 종일 일정을 주간 시간 그리드로 드래그하면 시간 일정으로 전환된다.
- [ ] **반응형**: 창 축소 시 [주/월]+`<오늘>`가 한 줄 유지, 우측 일정 저장함은 오버레이로 열리며 월간 Todo 요약은 하단에 남는다.
- [ ] **클립 정책**: 워크스페이스 가로 스크롤 없음. 노트 패널은 reflow, 콘텐츠 패널은 가장자리 클립. 캘린더만 예외로 그리드가 floor(360px) 이하일 때 내부 가로 스크롤(헤더+본문 함께 이동).
- [ ] **주간 겹침**: 일반 일정·고스트 일정 모두 대표 블록 하나를 세우고 나머지는 `+N개`로 표시한다. 같은 시간대에 가로 레인을 추가하지 않는다.
- [ ] **월 셀**: 창/컨테이너 높이에 따라 표시 개수를 1–5개로 동적으로 계산하고, 최소 한 일정은 표시한다. 초과분은 날짜 왼쪽의 `+N개`로 표시한다.
- [ ] 월 셀의 `+N개` 또는 날짜를 누르면 해당 날짜가 선택되고 하단 Todo 요약으로 이동한다. 상세 목록은 기존 하단 요약/오버레이에서 확인한다.
- [ ] 종일 영역도 일정이 많으면 한 건 + `+N개`로 접고, 펼침/접기가 동작한다.
- [ ] 완료 체크는 취소선과 완료시각을 남기고, 일정 정렬 순서는 시간순 후 종일순이며 완료 여부로 순서를 바꾸지 않는다.
- [ ] 월간 기록 버튼은 직전 달 리포트를 열고, 잔디·메모 수·완료 수·대표 주제·지식 연결을 표시한다. 기록이 부족하면 빈 상태를 표시한다.

#### A.2-1 자연어 날짜 기준일과 메모/캘린더 독립성
- [ ] `오늘`, `내일`, `월요일`, `내일 14시`, 숫자 날짜를 파싱하고 등록 확인 전에 해석된 절대 날짜·시간을 보여준다.
- [ ] **정책 검증**: 상대 날짜는 메모 작성/입력 기준일에 고정되어야 한다. 2026-05-05에 작성한 `내일`은 2026-05-06으로 남고, 앱을 다시 켜도 바뀌지 않는다.
- [ ] 기존 메모 문장을 수정하거나 다시 분석해도 이미 등록된 캘린더 일정의 날짜·시간·제목은 바뀌지 않는다.
- [ ] 캘린더 일정 수정/삭제는 원본 메모를 수정하지 않으며, 메모 삭제 후에도 독립적으로 등록된 일정의 정책을 확인한다.
- [ ] 메모를 삭제한 뒤 새 메모로 같은 상대 표현을 작성하면 새 메모 기준일로 다시 계산된다.

> **출시 전 확인 메모:** 현재 데스크톱의 `registerEditorSchedule`는 선택 문장을
> `Date.now()` 기준으로 재해석한다. 위의 “메모 기준일 고정” 정책을 유지한다면
> `created_at`/저장된 날짜 앵커를 넘기는 회귀 테스트가 통과하기 전까지 이 항목은
> 미완료로 둔다.

### A.3 분할 워크스페이스 / 네비게이션
- [ ] nav-rail 탭(메모/캘린더/수집함/일정 inbox/Topics) 전환 시 상단 탭바·툴바 항상 유지.
- [ ] **Topics 진입 시에도** 상단 탭바/툴바가 사라지지 않음(과거 버그 회귀 확인).
- [ ] split pane 추가/닫기(최대 2개), 리사이저 드래그, 패널 포커스.
- [ ] 각 pane의 다중 탭 추가/닫기/재정렬/다른 pane 이동, 마지막 탭 닫기, 작업 공간 복원이 정상.
- [ ] 메모·링크·캘린더·Topics로 이동하는 열기와, 주변 메모/Topics/원본 노트를 참고 패널로 여는 동작이 서로 섞이지 않는다.
- [ ] 3중/다중 상태에서 캘린더 탭 "x"로 닫아도 크래시 없음.

### A.4 수집함 (Inbox)
- [ ] URL 저장(YouTube/Instagram/웹) → 메타데이터+요약 표시.
- [ ] 폼 컴팩트 UI(검색/더보기 메뉴의 URL 입력/새로고침), 같은 URL 재저장 시 최상단 이동(중복 X).
- [ ] 전체/좋아요 필터, 제목·요약·키워드 검색, 페이지네이션, 카드의 자세히/좋아요/삭제가 정상.
- [ ] 상세 열기는 현재 작성 중인 pane을 빼앗지 않고 참고 패널에서 열리며, 원문 URL·요약·메타데이터를 확인할 수 있다.
- [ ] 백엔드 실패 시 로컬 큐 적재 → 재시도 시 동기화.
- [ ] 메타데이터만 성공해도 "저장 성공"으로 처리(요약 품질만 저하).

### A.5 일정 저장함 / 일정 추천 (데스크톱)
- [ ] 캘린더 우측의 일정 저장함 버튼이 앱 전역 우측 패널을 열고, 패널이 workspace를 밀어내거나 캘린더 폭을 강제로 줄이지 않는다.
- [ ] 날짜가 없는 후보만 일정 저장함 목록에 남고, 날짜가 있는 후보는 캘린더의 고스트 일정으로 표시된다. 날짜만 있으면 주간 뷰의 종일 영역에 표시한다.
- [ ] 카드 6개 단위 페이지네이션, 생성 상대시간, 원문, 수정/삭제/캘린더 배치가 정상이다. 모든 카드가 주간 캘린더로 드래그 가능하다.
- [ ] 시간이 없거나 날짜가 잘못된 후보는 배치 전에 날짜/시간 피커를 열고, 날짜·시간이 확정된 후보는 바로 배치한다.
- [ ] 캘린더 고스트는 점선 테두리·연한 배경으로 표시되고, hover 시 `＋ 등록` CTA가 나타난다. 클릭하면 제목·날짜·시간을 수정한 뒤 등록/삭제할 수 있다.
- [ ] 캘린더에 배치하면 후보는 즉시 로컬 목록에서 제거되고, 서버 `accepted`/`dismissed` 상태 변경은 로컬 action outbox가 재시도한다.
- [ ] **일일 브리핑 카드는 iOS 전용이다.** 데스크톱의 `briefing` 복원 탭과 캘린더 우측 패널은 동일한 일정 저장함 컴포넌트를 사용한다.

### A.6 네트워크 검색(State B) / Topics(State A)
- [ ] **State B**: 버튼으로 실행 → 현재 메모 중심의 `KnowledgeGraphView` ego graph. 백엔드 `/network/search`를 사용하고 텍스트 포함 기반으로 결과 위치를 해석한다(커서 오프셋 어긋남 없음).
- [ ] **State A**: Topics 탭에서 클러스터 그래프(`topic_clusters`) 표시. 클러스터 없으면 로컬 카테고리 그래프로 폴백.
- [ ] State B는 현재 메모 중심의 메모·저장 링크 ego graph와 결과 dock을 표시하고, Topics는 클러스터별 구분 색상과 memo/link 노드를 표시한다.
- [ ] 그래프 노드 선택은 참고 패널/토픽 폴더 열기로 이어지고, 같은 패널이 누적 생성되지 않는다.
- [ ] 전역 검색은 메모·Topics·링크 저장함·캘린더·일정 후보를 검색하고, 빈 검색어는 최신 항목부터 보여준다.
- [ ] 사전 조건: 배치(`memo-chunks/index-dirty-users` → `topic-discovery/run-dirty-users`)가 선행되어야 채워짐.

### A.6-1 Ambient Mirror (로컬 임베딩) · 미리보기 패널

State B와 달리 **네트워크를 타지 않는다.** 기기에서 임베딩하고 로컬 SQLite를 검색한다.

- [x] 모델(약 570MB)은 **명시적 관문(다운로드 팝업)** 을 거쳐야 내려받는다. 색인기가 몰래 받지 않는다. 팝업은 로그인 직후(메모 수와 무관) 또는 🔍를 처음 누를 때 뜬다.
- [x] 저장 공간이 모자라면 받기 전에 알리고 버튼을 막는다. 중단된 다운로드는 `.part`에서 이어받고, 실패는 진행 토스트의 `다시 시도`로 복구된다.
- [x] 진행 토스트는 **사용자가 시킨 실행에서만** 보인다: 로그인 후 첫 색인·다운로드·수동 🔍·네트워크 버튼. 에디터 blur 정리와 자동 ambient 검색은 성공도 실패도 조용하다.
- [x] 첫 준비만 완료·실패까지 남고(닫기·다시 시도), 버튼이 부른 짧은 증분 색인은 끝나면 알아서 사라진다. 재실행 시 캐시된 모델을 재다운로드하지 않는다.
- [ ] 글을 쓰다 멈추면 에디터 하단에 고스트 줄(`7일 전 · 문장`)이 스르륵 뜬다. 결과가 바뀔 때 퇴장 애니메이션도 보인다.
- [ ] 모든 쓰기 단계가 5초 idle 후 동작한다: 헤딩/빈 블록/문장 경계/일반 문맥 모두 5초.
- [ ] 입력·커서 이동·드래그 선택·에디터 이탈 시 이전 대기 타이머와 이전 검색 요청이 취소되고, 커서가 새 위치에 머문 경우에만 5초 후 새 문맥을 검색한다.
- [ ] 자동 검색은 로그인·포그라운드·자동 검색 설정 ON일 때만 실행되고, 같은 문맥은 한 번만 자동 실행한다. 12자 미만 문맥은 자동 검색하지 않는다.
- [ ] **자동 검색의 결과 없음·오류는 화면에 그리지 않는다.** 사용자가 요청한 적이 없기 때문이다. 수동 🔍에서만 "유사한 문장이 아직은 없습니다"와 오류 + `다시 시도`가 고스트 자리에 뜬다.
- [ ] ⌘⏎ 목록 열기가 실패하면 편집기가 아니라 **사이드 패널 안에서** 알리고 `다시 시도`를 받는다.
- [ ] **리스트 항목 안에서 Enter** → 리스트 앞 블록이 아니라 직전 항목을 질의한다.
- [ ] `⌘↩` 미리보기 상세, `⌘⇧↩` 목록. 에디터에 포커스가 있을 때 동작하고 Tiptap 단축키와 충돌하지 않는다.
- [ ] 추천이 없을 때 `⌘↩`을 눌러도 아무 일도 없다.
- [ ] **네트워크를 끊어도 ambient가 동작한다.**
- [ ] 로컬 색인은 앱 시작/메모·링크 변경 후 5초 debounce로 dirty hash만 증분 처리하고, 변경 없는 메모는 임베딩하지 않는다.
- [ ] 에디터 blur와 State B 검색 직전에 최신 로컬 저장을 flush하고 색인을 맞춘다. 색인 취소/실패 시 오래된 결과를 화면에 복원하지 않는다.
- [ ] 미리보기 패널: 남는 워크스페이스가 읽을 만하면 **밀어내고(push)**, 좁으면 **오버레이**로 뜬다. 폭 조절이 되고 앱 재시작 후에도 유지된다. 전환·리사이즈가 끊기지 않는다.
- [ ] `Esc`/`✕`로만 닫힌다. 계속 타이핑하거나 바깥을 클릭해도 닫히지 않는다.
- [ ] 청크 배경 하이라이트가 뜨고 해당 위치로 스크롤되며 잠시 뒤 옅어진다.
- [ ] **참조 7곳이 새 탭이 아니라 패널로 열린다**: ambient 1등·더보기, 주변메모 그래프(메모·웹요약), Topics 칩·그래프, 캘린더 원본 노트. 연달아 열어도 패널은 1개다.
- [ ] **이동 12곳은 기존대로 포커스 패널의 새 탭**: 사이드바 메모, 새 메모, 탭바 `+`, 메모 복제, 나브레일 4개, 전역 검색 4종, 웹 inbox 목록, 폴더 링크 행.
- [ ] 승격(`⧉`): 패널 1개면 그 패널에, 2개면 **포커스되지 않은** 패널에 열린다. 두 경우 모두 포커스가 이동하지 않는다.
- [ ] macOS·Windows 모두에서 단축키 표기가 각각 `⌘`·`Ctrl`로 나온다.

### A.7 동기화 / 오프라인 / 충돌
- [ ] 로그인 후 로컬 메모/캘린더가 `memos`/`calendar_blocks`로 업서트.
- [ ] 로그아웃→재로그인 시 서버 데이터 재로딩.
- [ ] 동기화 실패 시 `pending`/`failed`로 남고 다음 시도에 복구.
- [ ] 삭제: synced 메모 → `memo_tombstones`, synced 캘린더 → `deletedAt` 전파(삭제 부활 없음).
- [ ] 동시 편집 충돌 시 lost-update 없이 conflict-copy 처리.

### A.8 인증 (Auth)
- [ ] 최초 진입 시 로그인 화면 우선.
- [ ] Google/Kakao OAuth 성공, `profiles` 레코드 생성.
- [ ] 이메일 회원가입 OTP·비밀번호 정책·비밀번호 재설정 OTP가 정상이며, 잘못된 코드/만료 코드는 fail-closed 된다.
- [ ] OAuth callback은 `subnota://auth/callback`과 설정된 Supabase origin에서만 처리하고, 다른 origin/경로는 거부한다.
- [ ] 토큰 만료/갱신 시 재동기화.

### A.9 UI 품질
- [ ] 초기 출시 정책인 라이트 모드 고정이 유지되고, 설정에서 비활성화된 다크 모드 전환이 노출되지 않는다.
- [ ] 설정 → 일반 → 화면 언어에서 한국어/English를 바꾸면 인증·워크스페이스·캘린더·검색·Quick Subnota·설정·메뉴·로딩/오류 문구가 즉시 같은 언어로 바뀌고, 재시작 후에도 유지된다.
- [ ] 언어별 날짜 표시가 한국어에서는 `ko-KR`, 영어에서는 기기 영어 지역(`en-US`/`en-GB` 등)을 따르며, 메모 본문은 번역하지 않는다.
- [ ] 한국어·영어·혼합 문장과 날짜 표현을 각각 입력해 문장 분리·일정 제안이 과도하게 쪼개지지 않고, 영어 숫자 날짜(`6/10`)는 기기 로캘이 명확한 MDY/DMY일 때만 해석되며 YMD·지역 불명에서는 자동 등록하지 않는다.
- [ ] 앱 chrome은 semantic color token을 사용하고, 일정·그래프·브랜드 등 의도된 데이터 팔레트만 예외로 둔다.
- [ ] **브랜드 마크(물망초)는 `SubnotaMark` 한 곳에서만 그린다.** 앱 아이콘·부팅·로그인·설정·웹이 같은 path와 배치(-6·68·145·210·292°)를 쓴다. 색은 `--app-color-brand-mark`.
- [ ] **부팅 화면**: 앱을 껐다 켜면 조립 모션이 1.19초 끝까지 재생된다. 창만 다시 열거나 ⌘R 새로고침이면 스피너(무한 루프)라 중간에 끊겨도 자연스럽다. 상단 창 드래그 영역이 유지된다.
- [ ] 로컬이 늦으면 Phase B 앱 셸 스켈레톤으로 넘어가고, 어떤 경우에도 4초를 넘겨 전체 화면을 잡지 않는다. 서버 동기화를 기다리지 않는다.
- [ ] 스피너는 모두 물망초 체이스다. 회전하는 기본 아이콘이 남아 있지 않다.
- [ ] `prefers-reduced-motion`에서 부팅 조립·스피너·흩어짐 모션이 모두 멈춘다.
- [ ] 반응형: 작은 창에서 짓눌림/오버플로 없음.
- [ ] 접근성: 주요 버튼 aria-label, 키보드 포커스.

### A.10 데스크톱 플랫폼 정책 매트릭스
아래 항목은 macOS와 Windows에서 각각 실행해 확인한다. 공통 renderer의 UI/UX는 동일하고, 표에 적힌 시스템 표면과 기능 노출만 달라야 한다.

| 기능 | macOS 기대 결과 | Windows 기대 결과 |
|---|---|---|
| 메인 UI·메모·캘린더·인박스 | 사용 가능 | macOS와 동일하게 사용 가능 |
| 시스템 표면 | 메뉴바 | 알림 영역 트레이 |
| Quick Subnota·빠른 메모 | 사용 가능 | 사용 가능 |
| Quick Subnota 글로벌 단축키 | 등록·동작 | 등록·동작 |
| 수동 URL 입력·웹 수집함 | 저장·동기화·열람 | 저장·동기화·열람 |
| 현재 브라우저 페이지 자동 수집 | AppleScript 권한 후 동작 | 미출시, 메뉴·단축키 미노출 |
| 최근 수집 캡처 메뉴 | 메뉴바/Mini에서 노출 | 미노출 |
| 브라우저 확장 웹클리퍼 | 미출시 | 후속 출시, 미노출 |
| `subnota://capture` | 수집 경로로 동작 | 무시하거나 안전하게 종료 |

- [ ] macOS에서 Apple Events 권한을 허용했을 때 현재 페이지 수집이 동작한다.
- [ ] macOS에서 권한을 거부했을 때 앱이 멈추지 않고 안내 또는 안전한 실패를 보인다.
- [ ] Windows에서 웹클리퍼·현재 페이지 저장·최근 수집 메뉴가 실수로 노출되지 않는다.
- [ ] Windows에서 수동으로 붙여 넣은 URL은 기존 수집함에 저장·동기화·열람된다.
- [ ] macOS와 Windows의 레이아웃, 색상, 간격, 타이포그래피, 아이콘, 모달 크기, 애니메이션이 불필요하게 달라지지 않는다.

### A.11 설치·업데이트·복구 스모크 테스트
- [ ] 기존 버전에서 새 버전으로 업그레이드해 로컬 메모·설정·로그인 세션이 보존된다.
- [ ] 새로 설치한 환경에서 로그인부터 메모 작성·동기화까지 완료된다.
- [ ] 앱을 종료·재실행·강제 종료한 뒤에도 로컬 SQLite 데이터가 복구된다.
- [ ] 네트워크를 끊은 상태에서 작성한 메모가 네트워크 복귀 후 중복 없이 동기화된다.
- [ ] macOS DMG 설치 후 앱이 `/Applications`에서 실행되고, Windows 설치 후 시작 메뉴·알림 영역 트레이에서 실행된다.
- [ ] 이전 버전 설치 → 새 GitHub Release 게시 → 앱의 업데이트 확인 → 업데이트 설치 흐름을 실제로 확인한다.
- [ ] 업데이트 실패 또는 취소 시 기존 설치본과 로컬 데이터가 손상되지 않는다.
- [ ] `subnota://memo` Quick Subnota 메모, macOS의 `subnota://capture`, OAuth callback, 두 번째 앱 실행 시 기존 창 재사용이 동작한다. Windows에서 미출시 capture 링크는 안전하게 무시된다.
- [ ] 설정의 SQLite 백업 생성/복원과 캘린더·링크 저장함 JSON 내보내기가 동작하고, 복원 전 현재 데이터가 보호된다.
- [ ] macOS 메뉴바에서 창 닫기·앱 종료가 구분되고, Windows 트레이에서 닫기·종료 동작이 정책대로 동작한다.

---

## B. 데이터 / 백엔드 파이프라인

### B.1 Supabase 스키마 & 보안
- [ ] 마이그레이션과 프로덕션 history 매핑을 먼저 검토한다. 현재 `supabase/db.md`에 기록된 수동 적용/별칭이 있으므로 매핑 확인 전 blanket `db push`를 실행하지 않는다.
  ```sh
  supabase migration list --linked
  # 매핑 확인 후 필요한 migration만 적용
  supabase db push --linked          # 레포 루트에서 (구 --workdir mobile 불필요)
  ```
- [ ] GRANT 확인(요지):
  ```sql
  grant usage on schema public to anon, authenticated, service_role;
  grant select, insert, update, delete on public.memos to authenticated;
  grant select, insert, update, delete on public.calendar_blocks to authenticated;
  grant select, update on public.schedule_inbox to authenticated;
  grant select on public.memo_chunks, public.briefings, public.topic_clusters to authenticated;
  grant all privileges on all tables in schema public to service_role;
  ```
- [ ] 모든 public 테이블 RLS enabled. 소유자 정책은 `(select auth.uid())` + `TO authenticated`. 백엔드 전용 테이블은 deny-by-default(정책 0).
- [ ] DDL 후 advisor 실행(보안·성능), 의도된 예외만 `supabase/db.md`에 기록.

### B.2 백엔드 (Cloud Run)
- [ ] 헬스: `curl https://<cloud-run-url>/health` → `{"status":"ok"}`.
- [ ] 형태소/청킹: `POST /memo-chunks/split` 정상 분리.
- [ ] Secret Manager에 `SUPABASE_URL`,`SUPABASE_SERVICE_ROLE_KEY`,`HF_TOKEN`,`GEMINI_API_KEY`,`BACKEND_ADMIN_KEY`,`YOUTUBE_API_KEY` 등록 + Cloud Run SA에 `secretAccessor`.
- [ ] 최소권한 SA + VPC egress 적용 확인(`docs/CLOUD_RUN_EGRESS_VERIFICATION_CHECKLIST.md`).
- [ ] 유지보수 배치 수동 검증(관리자 키 필요):
  ```sh
  curl -X POST https://<cloud-run-url>/maintenance/memo-chunks/index-dirty-users \
    -H "Content-Type: application/json" -H "x-backend-admin-key: $BACKEND_ADMIN_KEY" -d '{}'
  curl -X POST https://<cloud-run-url>/maintenance/topic-discovery/run-dirty-users  -H "x-backend-admin-key: $BACKEND_ADMIN_KEY" -d '{}'
  curl -X POST https://<cloud-run-url>/maintenance/schedule-inbox/scan-dirty-users -H "x-backend-admin-key: $BACKEND_ADMIN_KEY" -d '{}'
  ```
  * 청킹은 호출당 batch 한도가 있어 dirty 0이 될 때까지 반복 호출. HF Inference는 콜드스타트 ReadTimeout이 날 수 있으니 실패 메모는 재호출로 회수.
  * 성공 기준: `memo_chunks`/`memo_chunk_edges`/`topic_clusters`/`schedule_inbox`에 데이터 적재.
- [ ] 일정 파서는 `memos.content_updated_at` → `created_at` → 손상된 레거시 데이터에만 현재 시각 순서로 기준일을 선택하고, 유지보수로 갱신되는 `updated_at`을 기준일로 사용하지 않는다.

### B.3 Edge Function (daily-briefing)
- [ ] 시크릿 업로드 + 배포:
  ```sh
  supabase secrets set --env-file supabase/.env.local --project-ref kwrbbxctutngcoqtccjv
  supabase functions deploy daily-briefing --project-ref kwrbbxctutngcoqtccjv
  ```
- [ ] 수동 호출 시 cron 키 없으면 fail-closed, 정상 키면 `{"briefing_date":...,"results":[...]}`.
- [ ] `push_token`을 읽거나 로깅하지 않음.
- [ ] 프로덕션 Cloud Scheduler에는 `daily-briefing`을 등록하지 않는다(현재는 수동/후속 기능).

### B.4 Cloud Scheduler 크론 (KST)
- [ ] `5 */6 * * *` (`Asia/Seoul`) memo-chunks index-dirty
- [ ] `20 3 * * *` (`Asia/Seoul`) schedule-inbox scan-dirty
- [ ] `50 3 * * *` (`Asia/Seoul`) topic-discovery dirty
- [ ] 위 세 endpoint가 dirty user가 없을 때 0건으로 종료하고, `row_scan_limit`이 상한 내에서 동작한다.
- [ ] `daily-briefing`은 현재 스케줄하지 않는다. 실행 이력에 4xx/5xx가 없다.
- [ ] `/maintenance/daily-all`은 수동 점검용으로만 유지한다.

---

## C. 데스크톱 패키징 / 서명 (Electron)

### C.0 출시 후보 빌드 공통 게이트
- [ ] `desktop/`이 저장소의 유일한 활성 데스크톱 소스이며, 레거시 `macos/`·`windows/`·PWA CI가 출시 파이프라인에 포함되지 않는다.
- [ ] 작업 트리가 깨끗하고 의도하지 않은 backend·supabase 변경, 개인 `.env`, 인증서, 앱 전용 암호가 커밋되지 않았다.
- [ ] `desktop/.nvmrc` 기준 Node 24와 `pnpm@11.1.1`을 사용한다.
- [ ] 다음 명령을 `desktop/`에서 실행한다.
  ```sh
  pnpm install --frozen-lockfile
  pnpm exec tsc --noEmit
  pnpm test
  pnpm run lint
  ```
- [ ] macOS와 Windows의 GitHub Actions가 모두 성공하고, 경고와 실패를 구분해 기록한다.
- [ ] 출시 버전(`desktop/package.json`)과 Git 태그 버전이 일치한다.

### C.1 macOS `.dmg`
- [ ] 개발 중 로컬 스모크는 `cd desktop && pnpm run build:mac`으로 확인한다. 이 명령의 로컬 재서명 결과를 배포 서명으로 간주하지 않는다.
- [ ] 배포 후보는 Apple 환경 변수를 설정한 뒤 `cd desktop && pnpm exec electron-forge make`으로 생성한다.
- [ ] `Developer ID Application` 인증서 서명, Hardened Runtime, notarization이 통과한다.
- [ ] 다음 검증이 모두 통과한다.
  ```sh
  codesign --verify --deep --strict --verbose=2 "/경로/Subnota.app"
  spctl --assess --type execute --verbose=4 "/경로/Subnota.app"
  xcrun stapler validate "/경로/Subnota.app"
  ```
- [ ] DMG 창에 브랜드 배경이 깔리고, 앱 아이콘과 `Applications` 별칭이 배경의 화살표 위치와 맞는다(`resources/dmg-background.png`).
- [ ] 앱 아이콘의 둥근 모서리가 **투명**하다(흰 사각형이 아니다). 메뉴바 아이콘도 실루엣 + 투명 배경이라 라이트/다크에서 모두 보인다.
- [ ] 래스터 자산은 `node scripts/generate-brand-assets.mjs`로 재생성한다(`icon.svg` 하나만 고치면 `.icns`·`.ico`·tray·DMG 배경이 함께 갱신).
- [ ] DMG를 다른 macOS 사용자 환경에 설치해 Gatekeeper 경고 없이 실행한다.
- [ ] 첫 실행 시 키체인·Apple Events 권한 안내가 의도대로 나타나고, 허용·거부 양쪽에서 앱이 멈추지 않는다.
- [ ] Bundle ID `com.sunghoonoh.subnota.macos`를 유지한다.
- [ ] 업데이트 피드의 `SUBNOTA_RELEASE_REPO`/`GITHUB_REPOSITORY`가 `SUNGHOONOH/Subnota`를 가리키며 업스트림 저장소를 가리키지 않는다.
- [ ] `RELEASES.json`의 ZIP 이름·버전·다운로드 URL이 실제 Release 자산과 일치한다.

### C.2 Mac App Store `.pkg`
- [ ] GitHub Release용 DMG와 별도인 `desktop-mas` workflow를 사용한다. MAS에서는
  Developer ID 공증·DMG·자체 업데이트를 사용하지 않는다.
- [ ] 기본 `browser_capture_mode=temporary-exception` 빌드는 기존 현재 페이지 저장
  UX를 유지한다. `fallback`은 심사 거절 시에만 선택한다.
- [ ] 임시 예외 빌드 전 실제 Feedback Assistant 번호를 확보하고
  `docs/mac-app-store-review.md`의 App Sandbox Usage Information을 App Store
  Connect에 입력한다.
- [ ] Apple Events 권한 대화상자가 한국어·영어에서 URL·제목만 읽는다고 정확히
  설명하며, 앱 시작이 아니라 사용자가 현재 페이지 저장을 실행할 때만 나타난다.
- [ ] App Privacy에서 사용자가 저장하고 계정에 동기화하는 URL·제목을 Browsing
  History / App Functionality / Linked to User / Not Used for Tracking으로 검토한다.
- [ ] `pnpm release:mas` 산출물은 정확히 다섯 브라우저의 Apple Events 임시 예외만
  포함하고 helper에는 해당 권한이 상속되지 않는다.
- [ ] `pnpm release:mas:fallback` 산출물은 automation·temporary exception·권한
  목적 문자열을 포함하지 않고, MAS에서만 현재 페이지 저장 메뉴·버튼·단축키가
  보이지 않는다. 메모·캘린더·Quick Subnota·수동 URL 저장은 그대로 동작한다.
- [ ] 서명된 app의 Bundle ID와 embedded provisioning profile이 일치하고,
  `get-task-allow`가 꺼져 있으며 app/helper/native module/PKG 검증을 통과한다.
- [ ] Apple Development MAS 빌드 또는 TestFlight에서 로그인, 파일 선택·백업·복원,
  로컬 임베딩, Apple Events 허용·거부를 실제 실행한다.
- [ ] 심사용 계정, 재현 순서, 30초 내외 시연 영상과 연락 가능한 지원 URL을
  App Review Information에 제공한다.

### C.3 Windows `.exe`
- [ ] 실제 Windows 환경에서 `cd desktop && pnpm run build:windows` (Squirrel Setup) 성공.
- [ ] 설치·실행·삭제 후 재설치가 정상이며 로컬 데이터가 정책대로 보존된다.
- [ ] 자동 업데이트와 알림 영역 트레이, Quick Subnota, 빠른 메모 단축키가 동작한다.
- [ ] 수집함 수동 URL 저장·동기화·열람이 동작한다.
- [ ] 현재 페이지 자동 저장·최근 수집 트레이 메뉴·브라우저 확장 웹클리퍼가 노출되지 않는다.
- [ ] GitHub Actions의 `subnota-windows` 아티팩트만으로 출시 완료로 판단하지 않는다. 실제 `.exe`를 설치하고, 최종 Release에 업로드할 파일을 확인한다.

### C.4 공통
- [ ] BrowserWindow 보안 기본값: `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, `webSecurity:true`.
- [ ] preload는 좁은 `window.electronAPI`만 노출(raw ipcRenderer/fs 금지). 외부 링크 http/https/mailto만.
- [ ] SQLite 로컬 스토어(`subnota-local.sqlite3`, WAL) 정상, 첫 실행 시 localStorage→SQLite 마이그레이션.

### C.5 GitHub Release 자산과 자동 업데이트
- [ ] Release 태그, `desktop/package.json` 버전, 설치 파일 버전이 모두 일치한다.
- [ ] macOS Release에 `.dmg`, 업데이트용 `.zip`, `RELEASES.json`이 모두 있다.
- [ ] Windows Release에 Squirrel Setup `.exe`가 있고, 필요한 Squirrel 업데이트 자산이 누락되지 않았다.
- [ ] macOS·Windows 파일이 같은 GitHub Release에 연결되어 있고 다운로드 URL이 `SUNGHOONOH/Subnota`를 가리킨다.
- [ ] Release에 업로드하기 전에 로컬에서 서명·공증·설치 테스트를 완료한다.
- [ ] `pnpm release:mac`·`pnpm release:windows`는 태그·푸시·Release 생성까지 수행하므로, 깨끗한 `main`에서 최종 확인 후 한 번만 실행한다.
- [ ] 실패한 배포를 덮어쓰기 전에 기존 Release의 태그·자산·업데이트 매니페스트를 보존하고 복구 절차를 확인한다.

---

## D. iOS (App Store)
- [ ] Apple Developer Program 결제, Team/Bundle/App ID 정리.
- [ ] App Store Connect 앱 레코드 생성, 아이콘/스크린샷/설명/개인정보 URL/지원 URL.
- [ ] TestFlight 내부 테스트로 로그인·메모·캘린더·브리핑·수집함 핵심 플로우 검증.
- [ ] 앱 재실행/백그라운드 복귀 시 강제 동기화와 오프라인 작성 후 복귀 동기화가 중복 없이 동작한다.
- [ ] 메모의 날짜 앵커/하이라이트가 재분석 때 현재 시각으로 이동하지 않고, 등록한 캘린더 브릭은 메모 수정과 독립적이다.
- [ ] Share Extension과 `subnota://memo`/`subnota://capture` 링크가 유효한 http/https URL만 처리한다.
- [ ] `mobile/`에서 `corepack pnpm ios` 릴리스 빌드 정상.

---

## E. 웹 랜딩 (`subnota.com`)
- [ ] `web/` Vercel 배포, `subnota.com` 도메인/SSL 연결.
- [ ] 다운로드 버튼이 플랫폼별로 분기: macOS `.dmg`, Windows `.exe`, iOS App Store 링크(미출시 시 안내).
- [ ] 헤더·푸터 로고가 앱과 같은 물망초 마크다(옛 4엽 마크가 남아 있지 않다). 색은 `--brand-mark`.
- [ ] 파비콘(`app/icon.svg`)·Apple 터치 아이콘(`app/apple-icon.svg`)·OG 이미지(`app/opengraph-image.tsx`)가 붙는다. 링크 공유 시 썸네일이 보인다.
- [ ] `robots.txt` 정책, Google Search Console / 네이버 서치어드바이저 등록.
- [ ] 푸터 개인정보 처리방침 링크 연결(수집 목적·제3자 제공 금지·탈퇴 절차 명시).
- [ ] (메일) 도메인 소유권 TXT + MX 레코드 설정 완료.

---

## F. 최종 macOS 출시 실행 순서 (11단계)

기능 변경이 모두 끝난 뒤, 아래 순서를 마지막에 한 번 실행한다. 출시 파이프라인은
GitHub Actions의 `desktop-release`를 기준으로 하며, `desktop/scripts/release.sh`가
Node 24·깨끗한 Git 상태·테스트·서명·공증·Gatekeeper 검증을 모두 통과시키지 않으면
Release를 만들지 않는다.

### 1. 변경사항 확정
- [ ] 기능·UI 변경을 모두 마치고 `git status --short`, `git diff --stat`로 포함 범위를 검토한다.
- [ ] 임시 파일, 개인 `.env`, 인증서, 앱 전용 비밀번호가 커밋 대상에 없는지 확인한다.

### 2. Apple Developer 인증서 준비 (최초 1회)
- [ ] Keychain Access의 `Developer ID Application` 인증서에 개인키가 함께 있는지 확인한다.
- [ ] 인증서+개인키를 P12로 내보내고 강한 P12 암호를 별도로 보관한다.
- [ ] GitHub Actions용으로 P12를 Base64로 변환한다.
  ```sh
  base64 < "/경로/DeveloperID.p12" | tr -d '\n' | pbcopy
  ```

### 3. Apple 공증 인증정보 준비 (최초 1회)
- [ ] Apple Developer 계정의 앱 전용 비밀번호를 생성한다(일반 Apple ID 비밀번호 사용 금지).
- [ ] Apple Developer Membership에서 Team ID를 확인한다.
- [ ] 또는 로컬 공증용 Keychain Profile/API Key를 사용할 경우 만료·권한을 확인한다.

### 4. GitHub Actions Secrets 등록 (최초 1회)
- [ ] `CERTIFICATE_P12_BASE64`
- [ ] `CERTIFICATE_PASSWORD`
- [ ] `APPLE_ID`
- [ ] `APPLE_ID_PASSWORD`
- [ ] `APPLE_TEAM_ID`
- [ ] `VITE_SUPABASE_ANON_KEY`

### 5. GitHub Actions Variables 등록 (최초 1회)
- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_MEMO_BACKEND_URL`
- [ ] 두 URL이 운영용 `https://` 주소인지 확인한다.

### 6. Supabase OAuth 및 운영 환경 확인
- [ ] Supabase Auth Redirect URLs에 `subnota://auth/callback`이 등록되어 있다.
- [ ] GitHub Variables/Secrets 값이 로컬 `desktop/.env`의 운영 값과 일치한다.
- [ ] Supabase service-role, backend admin, HF, Gemini 키가 앱 번들에 들어가지 않는지 확인한다.

### 7. 로컬 출시 후보 점검
- [ ] `cd desktop && nvm use` 후 Node 24인지 확인한다.
- [ ] 다음 명령을 실행한다.
  ```sh
  pnpm install --frozen-lockfile
  pnpm exec tsc --noEmit
  pnpm test
  pnpm run lint
  pnpm audit --prod
  pnpm build:mac
  ```
- [ ] 로컬 `build:mac` 결과는 ad-hoc 테스트용이며 배포 파일로 사용하지 않는다.

### 8. 버전·커밋·원격 상태 확정
- [ ] 이미 배포된 버전이면 `pnpm version patch --no-git-tag-version` 등으로 버전을 올린다.
- [ ] 최종 변경사항을 커밋하고 `main`에 push한다.
- [ ] `git status --porcelain` 출력이 비어 있는지 확인한다.

### 9. 출시 전 최종 게이트
- [ ] GitHub 저장소의 `main`이 출시할 커밋을 가리키는지 확인한다.
- [ ] Release 태그가 아직 같은 버전으로 존재하지 않는지 확인한다.
- [ ] `desktop-release` workflow가 사용할 Secrets/Variables가 모두 등록되어 있는지 확인한다.

### 10. GitHub Actions 출시 실행
- [ ] GitHub `Actions → desktop-release → Run workflow`를 선택한다.
- [ ] `main` 브랜치와 Release notes를 입력하고 실행한다.
- [ ] 테스트, Node 24, Developer ID 서명, 앱/DMG 공증, 스테이플, `codesign`, `spctl` 단계가 모두 성공하는지 확인한다.

### 11. Release·설치·업데이트 확인
- [ ] Release에 `.dmg`, 업데이트용 `.zip`, `RELEASES.json`, `SHA256SUMS.txt`가 모두 있는지 확인한다.
- [ ] 네 자산을 내려받아 `shasum -a 256 -c SHA256SUMS.txt`를 실행한다.
- [ ] 다른 macOS 사용자 환경에서 DMG 설치·Gatekeeper·로그인·메모 저장·OAuth·웹클리퍼를 확인한다.
- [ ] 이전 버전에서 새 Release 업데이트가 감지되고 설치되는지 확인한다.
- [ ] 실패 시 새 Release를 덮어쓰기 전에 태그·자산·매니페스트를 보존하고 원인을 기록한다.

> 출시 후 기능 변경이 다시 생기면 1단계로 돌아간다. Apple 인증서·공증정보·GitHub
> Secrets/Variables는 변경되지 않는 한 다시 등록하지 않는다.

---

## G. 보안 / 시크릿 경계
- [ ] 출시 직전 프로덕션 키 회전: `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `HF_TOKEN`, `BACKEND_ADMIN_KEY`, `DAILY_BRIEFING_CRON_KEY`.
- [ ] 클라이언트 `.env`엔 공용 3종만(`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`MEMO_BACKEND_URL`).
- [ ] 배포 번들 역추출 시 service-role/외부 API 시크릿 노출 0.
- [ ] SSRF/DNS-rebinding 가드(httpx + Playwright host-resolver-rules), `replace_*` 원자성, 동기화 tombstone/conflict-copy 회귀 확인.
- [ ] Supabase Auth leaked-password protection 활성(플랜 지원 시).

---

## H. Go / No-Go (전부 통과해야 출시)
- [ ] **기능**: A 섹션 핵심 플로우(메모·캘린더·동기화·일정 저장함·월간 기록·Topics) macOS/Windows와 iOS의 메모·캘린더·브리핑에서 통과.
- [ ] **플랫폼 정책**: Quick Subnota·빠른 메모·수동 URL 수집은 양쪽에서 동작하고, Windows의 미출시 웹클리퍼·현재 페이지 자동 수집·최근 수집 메뉴는 노출되지 않음.
- [ ] **실기기 설치**: macOS DMG와 Windows EXE를 실제 설치해 첫 실행·재실행·삭제·재설치까지 통과.
- [ ] **업데이트**: 이전 버전에서 새 Release로 업데이트하고, macOS `RELEASES.json`과 Windows Squirrel 자산이 실제 파일과 일치.
- [ ] **서명**: macOS Developer ID 서명·공증·Gatekeeper 검증 통과.
- [ ] **자동화**: CI 성공만 확인하지 않고 각 플랫폼의 설치·UI·단축키·트레이/메뉴바를 사람이 확인.
- [ ] **배포 주소**: `subnota.com` 1.5초 내 로드, 다운로드 버튼 플랫폼별 정상.
- [ ] **인증**: Google/Kakao 로그인 실기기 성공 + 동기화 체결.
- [ ] **오프라인 안정성**: 네트워크 단절에도 앱 무중단, 복귀 시 충돌 없이 동기화.
- [ ] **크론**: dirty-only 메모 청킹·일정 후보·Topics 작업 이력에 4xx/5xx 없음. `daily-briefing`은 현재 스케줄하지 않는 정책을 확인.
- [ ] **보안**: 번들 시크릿 노출 0, 키 회전 완료.
- [ ] **저장소 안전성**: 작업 트리 깨끗함, 개인 `.env`·앱 전용 암호·인증서·backend 실험 변경이 Release에 포함되지 않음.
- [ ] **약관**: 개인정보 처리방침 링크 정상.
