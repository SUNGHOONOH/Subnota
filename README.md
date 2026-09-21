<p align="center">
  <img src="web/public/subnota-mark-glass.png" width="72" alt="Subnota logo" />
</p>

<h1 align="center">Subnota</h1>

<p align="center">
  과거의 생각을 다시 연결하고, 메모에서 일정을 찾고, 저장한 링크를 다시 쓸 수 있게 해주는 로컬 우선 노트 앱입니다.
</p>

<p align="center">
  <a href="https://subnota.com">Website</a> ·
  <a href="https://subnota.com/#download">Download</a> ·
  <a href="https://github.com/SUNGHOONOH/Subnota/releases">Releases</a>
</p>

## 개요

Subnota는 메모, 일정, 저장한 링크를 한곳에서 관리하는 로컬 우선 작업공간입니다.
메모와 일정은 먼저 기기 SQLite에 저장되고, 로그인하면 Supabase와 동기화됩니다.
작성 중 관련 메모를 찾는 검색은 기기 내 임베딩으로 동작하므로 네트워크 연결을
기다리지 않습니다.

백엔드는 편집 흐름을 처리하지 않습니다. 하루 한 번 일정 후보를 추출하고, 변경된
메모·저장 링크를 바탕으로 Topics를 갱신하며, 링크 요약만 보강합니다.

현재 데스크톱 앱은 macOS Apple Silicon과 Windows x64를 지원합니다. `mobile/`은
향후 iOS 앱 작업을 위한 레거시 코드이며, 데스크톱 앱과 동작을 맞추는 대상이 아닙니다.

## 주요 기능

- **연결된 기억** — 기기에서 문장 단위로 색인한 메모를 바탕으로 관련 문맥을 찾습니다.
- **메모에서 일정으로** — 매일 한 번 변경된 메모에서 일정 후보를 추출해 수집함에 제안합니다.
- **수집하고 다시 사용하기** — 웹페이지를 저장하고 요약·키워드를 만들며 Topics에 연결합니다.
- **로컬 우선** — 메모, 일정, 링크, 로컬 벡터를 SQLite에 먼저 저장합니다.
- **집중된 작업공간** — 탭, 분할 화면, 미리보기, 전체 검색, Quick Subnota를 제공합니다.

## 문제와 해결 과정

메모를 저장해도 나중에 필요한 순간 다시 찾기 어렵고, 일정이나 읽어 둔 링크와의 연결도 끊기기 쉽습니다. Subnota를 기획·개발하면서 **작성 중 떠오른 맥락을 방해하지 않고 관련 메모를 보여주는 것**을 중심 문제로 잡았습니다. 현재 공개된 데스크톱 앱과 웹사이트·릴리스는 위 링크에서 확인할 수 있습니다.

| 고민 | 선택한 방법 | 남겨 둔 기준 |
|---|---|---|
| 작성할 때마다 서버 검색을 기다려야 하나? | 기기 내 임베딩과 SQLite 벡터 검색으로 관련 메모를 찾음 | 작성 흐름은 네트워크에 의존하지 않음 |
| 검색 추천이 글쓰기를 가리지 않으려면? | 입력 단계에 맞는 문장을 고르고 잠시 멈춘 뒤 조용히 제안 | 검색 기능보다 편집 경험을 우선 |
| 모든 분석을 앱 실행 순간 처리해야 하나? | 일정 후보와 관련 메모 묶음 갱신은 하루 단위 백그라운드 작업으로 분리 | 메모 편집은 로컬 우선으로 유지 |
| 모델을 실제 데스크톱 환경에 넣을 수 있나? | 기기 내 임베딩에 양자화된 ONNX 모델을 사용하고 색인·질의 모델 버전을 일치시킴 | 모델 버전이 바뀌면 오래된 벡터를 섞지 않음 |

## 확인한 결과와 한계

메모 작성·검색·일정 제안·링크 수집을 하나의 데스크톱 앱으로 구현해 [웹사이트](https://subnota.com)와 [다운로드](https://subnota.com/#download), [릴리스](https://github.com/SUNGHOONOH/Subnota/releases)를 제공하고 있습니다. 다만 이 README에서 추천 품질, 이용자 수나 속도 개선 수치를 주장하지는 않습니다. 일정 후보 추출과 링크 요약은 온라인 백그라운드 기능이며, 기기 내 검색과 동작 조건이 다릅니다.

## 주요 파일 안내

| 경로 | 확인할 내용 |
|---|---|
| [`desktop/docs/CODEMAP.md`](desktop/docs/CODEMAP.md) | 로컬 임베딩·검색과 화면/메인 프로세스의 역할 |
| [`desktop/src/local-embedding.ts`](desktop/src/local-embedding.ts) | 기기 내 임베딩 모델의 실행·캐시 |
| [`backend/README.md`](backend/README.md) | 일정 후보·메모 묶음·링크 처리의 온라인 경계 |
| [`web/`](web/) | 서비스 소개와 다운로드 웹사이트 |

## 저장소 구조

| Path | Purpose | Main technologies |
| --- | --- | --- |
| [`desktop/`](desktop/) | macOS·Windows 데스크톱 앱 | Electron, React, Tiptap, SQLite |
| [`mobile/`](mobile/) | 향후 iOS 작업을 위한 레거시 코드 | React Native |
| [`web/`](web/) | 제품 웹사이트·법률 페이지 | Next.js, React |
| [`backend/`](backend/) | 링크 요약·일정 추출·Topics 보강 API | FastAPI, Kiwi, Hugging Face |
| [`supabase/`](supabase/) | 인증·동기화 스키마·RLS·토픽/수집함 벡터 데이터 | PostgreSQL, pgvector |

## 개발과 검증

각 구성요소의 설치·실행 방법은 해당 문서를 따릅니다.

- [데스크톱 개발](desktop/README.md)
- [웹 개발](web/README.md)
- [백엔드 개발](backend/README.md)
- [Supabase 운영 문서](supabase/db.md)

데스크톱 아키텍처와 인터페이스 규칙은
[CODEMAP](desktop/docs/CODEMAP.md)과
[디자인 시스템](desktop/docs/design.md)을 참고하세요.
