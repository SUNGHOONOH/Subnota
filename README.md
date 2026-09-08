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
