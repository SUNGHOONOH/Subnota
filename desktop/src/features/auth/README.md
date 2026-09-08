# Auth

## 역할

로그인·회원가입·비밀번호 재설정 화면과 인증 상태 전환 규칙을 담당한다.

## 현재 경계

- `bootSession.ts`: 최초 세션 확인과 초기 동기화 대기의 8초 상한
- `sessionIdentity.ts`: 비동기 작업이 시작한 로그인 세션이 아직 현재 세션인지 판정
- `authEventDecision.ts`: Supabase 인증 이벤트의 화면 전환 판단
- `useAuthSessionBootstrap.ts`: 로컬 workspace 선행 적용, 최초 세션 확인,
  Supabase auth 구독과 cleanup lifecycle
- `useAccountActions.ts`: 로그아웃 fallback과 계정 삭제·로컬 정리·세션 종료
- `useSessionLifecycle.ts`: 로그인·로그아웃 시 owner 전환, 로컬 작업 공간 게이트,
  retry 정리와 quiet 서버 동기화 진입 순서
- 화면 컴포넌트: 로그인, OTP, 비밀번호 재설정 입력
- App: 인증 이후 작업 공간 전환·데이터 로드와 action wiring

## 불변 조건

- 세션 확인 또는 첫 동기화가 8초를 넘겨도 로컬 우선 화면 진입을 막지 않는다.
- 타임아웃을 마친 뒤에는 남은 timer를 해제한다.
- 인증 이벤트가 실제 작업 공간 상태를 바꾸는 순서는 App에 남긴다.
- 세션 판정은 사용자 ID와 access token을 모두 비교한다.
- 로그아웃은 전역 sign-out 실패 시 로컬 sign-out과 메모리 세션 해제를 시도하며, 계정 삭제는 인덱싱 중단과 로컬 데이터 정리 결과를 사용자에게 알린 뒤 세션을 종료한다.
- owner가 바뀌는 동안 이전 계정의 메모·Inbox·폴더 상태를 노출하지 않고, 로컬
  작업 공간을 먼저 적용한 뒤 서버 동기화를 조용히 시작한다.
- 로그아웃은 진행 중인 activation/load와 메모 Cloud retry를 무효화하고 guest
  작업 공간을 복원한다.
- 초기 auth effect는 로컬 workspace 적용을 먼저 시작하고, 초기 세션 확인과 auth
  이벤트를 기존 decision table·session lifecycle로 전달한다.
- auth 구독 cleanup에서는 activation/load ID를 증가시켜 늦은 비동기 결과가 state를
  다시 쓰지 못하게 하고 Supabase subscription을 해제한다.

## 관련 테스트

- `src/__tests__/auth-event-decision.test.ts`
- `src/__tests__/auth-validation.test.ts`
- `src/__tests__/loading-ux.test.tsx`
- `src/__tests__/account-actions.test.ts`
- `src/__tests__/session-lifecycle.test.ts`
- `src/__tests__/auth-session-bootstrap.test.ts`

## Windows 주의사항

이 모듈은 Electron API나 창 제어를 직접 호출하지 않는다.
