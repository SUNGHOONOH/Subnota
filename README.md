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

Subnota는 노트, 일정, 저장한 링크를 한곳에서 관리하는 로컬 우선 작업공간입니다.

작성 중인 문장과 관련된 과거 기록을 보여주고, 노트 안의 날짜를 감지하며,
작업 흐름을 끊지 않고 유용한 웹페이지를 모을 수 있습니다. 노트는 먼저 로컬에
저장하고, 로그인하면 여러 기기에서 선택적으로 동기화할 수 있습니다.

데스크톱 앱은 macOS Apple Silicon과 Windows x64를 지원하며, iOS 앱은 개발 중입니다.

## 주요 기능

- **연결된 기억** — 기기에서 생성한 임베딩 인덱스로 과거 노트의 관련 문장을 찾아줍니다.
- **메모에서 일정으로** — 작성한 글에서 날짜를 찾아 캘린더 이벤트로 변환합니다.
- **수집하고 다시 사용하기** — 웹페이지를 저장하고, 요약을 만들고, 출처를 노트와 연결합니다.
- **로컬 우선** — 노트, 일정, 링크, 벡터를 SQLite에 먼저 저장합니다.
- **집중된 작업공간** — 탭, 분할 화면, 미리보기, 전체 검색, Quick Subnota를 제공합니다.

## 저장소 구조

| Path | Purpose | Main technologies |
| --- | --- | --- |
| [`desktop/`](desktop/) | macOS·Windows 데스크톱 앱 | Electron, React, Tiptap, SQLite |
| [`mobile/`](mobile/) | 개발 중인 iOS 앱 | React Native, MMKV, Tiptap |
| [`web/`](web/) | 제품 웹사이트 | Next.js, React |
| [`backend/`](backend/) | 검색·요약·일정·주제 보강 API | FastAPI, Kiwi, Hugging Face |
| [`supabase/`](supabase/) | 인증·동기화 스키마·RLS·벡터 데이터 | PostgreSQL, pgvector |

## 개발 환경

설치와 검증 방법은 애플리케이션별 README에 정리되어 있습니다.

- [데스크톱 개발](desktop/README.md)
- [모바일 개발](mobile/README.md)
- [웹 개발](web/README.md)
- [백엔드 개발](backend/README.md)
- [데이터베이스 마이그레이션](supabase/README.md)

데스크톱 아키텍처와 인터페이스 규칙은
[CODEMAP](desktop/docs/CODEMAP.md)과
[디자인 시스템](desktop/docs/design.md)을 참고하세요.
