# MemoApp Code Map

Last updated: 2026-05-07

이 문서는 현재 리팩토링된 MemoApp 코드 구조에서 각 코드 파일이 맡는 역할을 설명한다. 기준은 `src/features/*`, `src/store`, `src/lib` 중심 구조다.

## App Entry

| File                     | Role                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `App.tsx`                | 앱 최상위 엔트리 컴포넌트. `GestureHandlerRootView`, `SafeAreaProvider`, `Navigation`을 감싼다. |
| `index.js`               | React Native 런타임에 `App`을 등록하는 네이티브 엔트리 파일.                                    |
| `src/app/Navigation.tsx` | 하단 탭 내비게이션을 정의한다. 현재 메인 탭은 `메모`, `캘린더`, `브리핑`이다.                   |

## Feature: Memo

| File                                                   | Role                                                                                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/features/memo/MemoScreen.tsx`                     | 메모 탭의 컨테이너 화면. 메모 선택/생성/삭제/고정, 날짜 감지 상태, 선택 텍스트 일정 등록, 네트워크 패널 표시 상태를 조율한다. |
| `src/features/memo/components/MemoEditor.tsx`          | 노란 종이 형태의 메모 입력 UI. 날짜 하이라이트, 감지 날짜 tooltip, 선택 텍스트 일정 등록 버튼을 렌더링한다.                   |
| `src/features/memo/components/MemoSidebar.tsx`         | 왼쪽 세션/메모 목록 사이드바. 고정 메모, 오늘, 어제, 이전 30일 섹션을 표시하고 메모 선택 이벤트를 부모로 전달한다.            |
| `src/features/memo/components/MiniCalendarPopover.tsx` | 메모 화면의 날짜 선택 팝오버. 월 이동, 날짜 선택, 시간/분 입력을 처리한다.                                                    |
| `src/features/memo/components/DateQuickActions.tsx`    | iOS 키보드 accessory의 날짜 빠른 입력 칩. 오늘/내일/요일 토큰 삽입과 날짜 선택 열기를 담당한다.                               |
| `src/features/memo/components/MemoNetworkPanel.tsx`    | 메모 화면 안에서 열리는 네트워크 모달 패널. 네트워크 그래프의 헤더, 닫기 버튼, 모달 레이아웃을 담당한다.                      |
| `src/features/memo/components/MemoNetworkGraph.tsx`    | 메모를 카테고리별 노드 그래프로 시각화한다. Zustand store에서 메모를 읽고 SVG 기반 그래프를 그린다.                           |

## Feature: Calendar

| File                                                       | Role                                                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `src/features/calendar/CalendarScreen.tsx`                 | 캘린더 탭의 컨테이너 화면. 월/주간 모드 전환, 캘린더 블럭 추가/삭제/편집, 메모 일정 블럭 병합, 드래그 결과 저장을 조율한다. |
| `src/features/calendar/components/MonthGrid.tsx`           | 월별 캘린더 그리드. 월 이동, 연도 선택 열기, 날짜별 scheduled memo 요약 표시를 담당한다.                                    |
| `src/features/calendar/components/WeekBoard.tsx`           | 주간 블럭 보드. `n월 n주차` 헤더, 요일 컬럼, 시간순 정렬, 드래그 가능한 블럭 목록, 요일별 추가 버튼을 렌더링한다.           |
| `src/features/calendar/components/DraggableBrick.tsx`      | 개별 캘린더 블럭의 드래그/탭/길게 누르기 상호작용. 위치 이동, drop preview, 삭제 요청, 편집 열기를 부모로 전달한다.         |
| `src/features/calendar/components/CalendarBrickEditor.tsx` | 블럭 내부 메모 편집 모달. memo 블럭과 일반 calendar brick 모두의 note 편집 UI로 사용된다.                                   |
| `src/features/calendar/components/AddBrickButton.tsx`      | 캘린더 블럭 추가 버튼. 주간 보드 상단 버튼과 요일 헤더의 compact 버튼을 같은 컴포넌트로 처리한다.                           |

## Feature: Briefing

| File                                                     | Role                                                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/features/briefing/BriefingScreen.tsx`               | 브리핑 탭의 컨테이너 화면. store의 메모를 읽어 우선순위 목록, 다가오는 일정, 로컬 챗 응답 상태를 구성한다. |
| `src/features/briefing/components/PriorityQueue.tsx`     | 브리핑의 우선순위 목록 UI. scheduled memo, pinned memo, 일반 memo 순서로 계산된 결과를 표시한다.           |
| `src/features/briefing/components/TodayContextPanel.tsx` | 다가오는 일정 패널. scheduled memo를 시간 라벨과 함께 보여준다.                                            |
| `src/features/briefing/components/BriefingChat.tsx`      | 브리핑 챗 UI. 메시지 로그, 입력창, 전송 버튼을 렌더링한다. 현재는 로컬 stub 응답을 받는 구조다.            |
| `src/features/briefing/components/briefingFormat.ts`     | 브리핑 컴포넌트들이 공유하는 표시 포맷 유틸. 메모 제목 추출과 일정 라벨 포맷을 담당한다.                   |

## Store

| File                        | Role                                                                                                                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/store/useMemoStore.ts` | 앱의 로컬 상태 저장소. Zustand persist + AsyncStorage로 `memos`와 `calendarBricks`를 저장한다. 메모 mutation, 사용자가 확정 등록한 일정 생성, 캘린더 블럭 추가/수정/삭제/배치 이동을 제공한다. 본문 날짜 표현은 후보/hint이며 자동으로 `scheduledAt`을 만들지 않는다. |

## Lib

| File                       | Role                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/dateParser.ts`    | 한국어/단축 날짜 표현을 파싱한다. 메모 본문에서 날짜/시간 후보를 찾아 `DateMatch`로 반환하고, 상대 날짜 표시 및 시간 표시 유틸도 제공한다. |
| `src/lib/calendarUtils.ts` | 캘린더 전용 순수 유틸. 값 clamp, 요일 기준 다음 날짜 계산, 월 기준 주차 계산, 시간 입력 정규화를 담당한다.                                 |

## Shared Components

| File                            | Role                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------- |
| `src/components/BrickBlock.tsx` | 캘린더 블럭의 공용 프레젠테이션 컴포넌트. 제목, note, tone, time 표시를 담당한다. |

## Services

| File                                  | Role                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/services/ml/categorizeMemo.ts`   | 메모 내용을 간단한 규칙 기반으로 `Work`, `Life`, `Todo`, `Ideas`, `Misc` 카테고리로 분류한다.            |
| `src/services/llm/briefingService.ts` | 향후 LLM 브리핑 연동을 위한 서비스 stub. 현재는 입력 메모 일부를 schedule hint로 되돌리는 placeholder다. |
| `src/services/supabase/client.ts`     | Supabase 클라이언트 초기화. 환경변수 기반으로 Supabase URL/key를 읽는다.                                 |
| `src/services/supabase/index.ts`      | Supabase service barrel export. 현재는 client export만 담당한다.                                         |

## Current Architecture Notes

- 메인 기능 경계는 `memo`, `calendar`, `briefing` feature 단위로 분리되어 있다.
- 화면 파일은 여전히 container 역할을 맡고, 복잡한 UI 조각은 각 feature의 `components/` 아래로 이동했다.
- `useMemoStore`는 아직 메모와 캘린더 상태를 함께 가진다. Supabase sync를 붙이기 전까지는 로컬 MVP 상태의 단일 store로 유지한다.
- 메모 본문의 날짜 표현은 후보/hint다. `scheduledAt`은 사용자가 `일정 등록`을 눌러 확정한 일정에만 저장한다.
- `dateParser`는 메모와 store 모두에서 쓰이는 공통 도메인 로직이므로 `src/lib`에 둔다.
- `calendarUtils`는 캘린더 화면과 하위 컴포넌트에서 공유되는 순수 계산 로직만 담는다.

## Follow-up Refactoring Candidates

- `MemoScreen.tsx`의 스타일 객체와 날짜 적용 로직을 더 분리하면 파일 크기를 추가로 줄일 수 있다.
- `CalendarScreen.tsx`의 블럭 추가 모달을 `AddCalendarBrickModal.tsx`로 빼면 컨테이너 책임이 더 명확해진다.
- `BriefingScreen.tsx`의 priority 계산은 나중에 LLM 입력 컨텍스트 생성 로직과 함께 `briefingSelectors.ts`로 분리할 수 있다.
