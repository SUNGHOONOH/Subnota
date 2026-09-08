# Search

## 역할

로컬 임베딩 모델 준비, 메모·Inbox 색인, 전역 검색과 주변 메모 검색 화면을
담는 기능 폴더다. `useGlobalSearchNavigation.ts`는 전역 검색 결과를 메모·주제·
수집함·캘린더·일정 화면으로 연결하는 라우팅만 담당하고,
`ambientSearchHandlers.ts`는 주변 메모 검색의 자동/수동 결과 표시 정책만 담당한다.
`useAmbientListPreview.ts`는 주변 메모 더보기의 색인 flush·로컬 검색·미리보기
패널 연결만 담당한다.
`useLocalMemoIndexFlush.ts`는 blur 또는 사용자가 누른 색인 경계에서 보류 중인
로컬 메모 저장을 기다리고, 임베딩 모델 게이트를 확인한 뒤 메모 색인을 실행한다.
`useAmbientSearchInteraction.ts`는 ambient 검색 문맥, 수동 진행 표시, 최신 요청
취소와 자동 검색 게이트를 조율한다.

## 임베딩 모델 다운로드

`useEmbeddingModelDownload`는 사용자가 요청한 모델 다운로드와 진행률 폴링을
담당한다. 완료되면 미뤄 둔 메모 및 Inbox 로컬 색인을 재개한다.

## 외부 의존성

- Electron: 모델 다운로드와 상태 조회 IPC
- Local indexer: 메모 및 Inbox 색인 예약
- Supabase와 Backend API에는 직접 접근하지 않음

## 불변 조건

- 다운로드 시작 즉시 사용자에게 진행 상태를 표시한다.
- 다운로드 중 500ms 간격으로 상태를 조회한다.
- 성공, 실패와 관계없이 폴링 타이머를 해제한다.
- 성공한 경우에만 대기 중인 로컬 색인을 재개한다.
- 현재 작업 공간 owner의 메모와 Inbox만 색인한다.
- 색인은 관련 로컬 저장이 완료된 최신 메모만 대상으로 하며, 모델이 준비되지 않은
  상태에서는 기존의 사용자 표시 게이트를 연다.
- ambient 결과는 검색을 시작한 editor 문맥에만 반영하고, 자동 검색은 기존 포커스·
  세션·설정 게이트를 통과한 경우에만 실행한다.

## 관련 테스트

- `src/__tests__/local-embedding-download.test.ts`
- `src/__tests__/local-embedding.test.ts`
- `src/__tests__/local-index-progress.test.tsx`
- `src/__tests__/loading-ux.test.tsx`
- `src/__tests__/global-search-navigation.test.ts`
- `src/__tests__/ambient-search.test.ts`
- `src/__tests__/local-memo-index-flush.test.ts`
- `src/__tests__/ambient-search-interaction.test.ts`

## Windows 주의사항

저사양 PC와 Defender 검사 환경에서는 다운로드 후 모델 로딩이 길어질 수 있다.
이 Hook에서 동기 파일 작업이나 모델 추론을 실행하면 안 된다.
