'use client';

/* 방향 계약 (web/DESIGN.md 참조)
   THESIS: 랜딩을 제품의 재료로 짓는다. 스크린샷을 얹은 마케팅 페이지도,
     새로 디자인한 목업도 아니다 — 페이지가 앱과 같은 토큰·같은 컴포넌트
     문법으로 만들어진다. 이 카테고리가 늘 내는 그라디언트 히어로 + 아이콘
     카드 격자를 거부한다.
   OWN-WORLD: 앱의 종이 사이드바(#f3f1e9)가 페이지 바탕, 흰 캔버스가 제품
     프레임. 잉크 #2c2520, 잉크 블루 #325496는 주 행동·링크·오늘 표시에만.
     Pretendard 본문 + Alegreya Sans 워드마크. 굵기 400–700, radius 8–12px,
     그림자는 헤어라인 한 겹.
   STORY: 방문자는 한 문장이 다음 일과 지난 생각으로 이어지는 것을 네 번
     본다. 각 챕터는 실제 화면 하나가 6~7초 동안 스스로 움직여 증명한다.
   FIRST VIEWPORT: 왼쪽 정렬 제목 두 줄 + 리드 + 다운로드 두 개. 바로 아래에
     첫 챕터의 실제 앱 화면이 폭 전체로 선다.
   FORM: 브리핑에 고정된 방향(제품 UI 원본 + 구조적 섹션 리듬). 콘셉트
     토너먼트를 돌리지 않는다 — 사용자가 세계를 명시적으로 못박았다. */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight, SubnotaMark } from './subnota-ui/icons';
import { CHAPTERS, DownloadRow, SiteFooter, SiteHeader } from './components/site';
import {
  ARROW_UP,
  HandNote,
  Marker,
} from './components/annotations';
import ConnectedMemoryScene from './components/scenes/ConnectedMemoryScene';

/* 첫 화면을 무겁게 만들지 않는다. 1번 챕터만 즉시 오고 나머지는 스크롤이
   닿을 때 온다. */
const lazyScene = (loader: () => Promise<{ default: React.ComponentType }>) =>
  dynamic(loader, {
    /* 자리표시자 비율은 배경판과 같아야 한다 — 다르면 씬이 오는 순간 아래
       내용이 밀린다. Scene.tsx 의 무대 크기·창 비율과 함께 고칠 것. */
    loading: () => (
      <div className="showcase" style={{ aspectRatio: '1227 / 650' }} />
    ),
    ssr: false,
  });

const MemoToCalendarScene = lazyScene(
  () => import('./components/scenes/MemoToCalendarScene'),
);
const ReuseInboxScene = lazyScene(() => import('./components/scenes/ReuseInboxScene'));
const ProductivityScene = lazyScene(
  () => import('./components/scenes/ProductivityScene'),
);

/* 손글씨 주석은 두 자리에만 둔다. 화면마다 붙이면 표시가 아니라 장식이 된다. */
const CHAPTER_COPY: {
  lead: ReactNode;
  scene: ReactNode;
  steps: string[];
  note?: ReactNode;
}[] = [
  {
    lead: (
      <>
        문장을 쓰다 잠시 멈추면, 지금 쓰는 문장과 가까운 과거의 문장이 한 줄로
        올라옵니다. 메모 전체가 아니라 <Marker tone="blue">문장 단위</Marker>입니다.
        누르면 그 문장이 있던 원본이 옆에서 열립니다. 계정을 연결하면 동작합니다.
      </>
    ),
    note: (
      <HandNote
        arrow={ARROW_UP}
        arrowId="note-ghost"
        style={{ left: '26%', top: '41%' }}
        text="7일 전에 쓴 문장"
      />
    ),
    scene: <ConnectedMemoryScene />,
    steps: ['문장 쓰기', '손을 멈추면', '관련 문장 한 줄', '원본 열림'],
  },
  {
    lead: (
      <>
        적어 둔 문장을 그대로 끌어 보세요. 날짜를 알아보고, 뜬 팝오버에서 한 번
        누르면 <Marker tone="green">캘린더에 바로 앉습니다</Marker>. 옮겨 적을
        일도, 앱을 하나 더 열 일도 없습니다.
      </>
    ),
    scene: <MemoToCalendarScene />,
    steps: ['문장 드래그', '일정 등록', '캘린더에 바로'],
  },
  {
    lead: (
      <>
        읽던 페이지에서 <Marker tone="amber">단축키 하나</Marker>. 저장은 그걸로
        끝이고, 제목과 요약과 키워드는 알아서 따라붙습니다. 나중에 뭐였는지
        떠올리려고 링크를 다시 열 일이 없습니다.
      </>
    ),
    scene: <ReuseInboxScene />,
    steps: ['단축키 하나', '저장 완료', '요약이 따라옴'],
  },
  {
    lead: (
      <>
        단축키 하나로 작은 창이 뜹니다. 적고 저장하면{' '}
        <Marker tone="clay">하던 화면 그대로</Marker> 돌아옵니다. 메모와 캘린더를
        나란히 두고 보는 것도 같은 창 안에서 합니다.
      </>
    ),
    scene: <ProductivityScene />,
    steps: ['단축키', 'Quick Subnota', '기록', '원래 화면으로'],
  },
];

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />

      <main id="main">
        <section className="hero" id="top">
          {/* 배경은 로고의 잉크 블루에서 내려온 면 하나뿐이다. 새 마케팅
              그래픽을 만들지 않는다. */}
          <div aria-hidden="true" className="hero-bg" />
          <div className="hero-inner shell">
            {/* 마크는 알아볼 수 있는 크기로 제 색을 갖고 선다. 거대한 회색
                워터마크로 깔면 로고가 아니라 얼룩으로 읽힌다. */}
            <SubnotaMark className="hero-mark" size={54} />
            <h1>
              적어 두기만 하세요.
              <br />
              정리하고 이어주는 일은 Subnota가 합니다
            </h1>
            <p className="hero-lead">
              메모 속 날짜는 캘린더로 옮겨 두고, 지금 쓰는 문장과 닿아 있는 과거의
              생각은 그 자리로 가져옵니다. 폴더를 만들 일도, 나중에 정리하겠다고
              다짐할 일도 없습니다.
            </p>
            <DownloadRow />
          </div>
        </section>

        <section aria-labelledby="about-title" className="about shell" id="about">
          <p className="section-label">About</p>
          <h2 id="about-title">
            메모앱은 많지만, 정리와 발견은
            <br />
            여전히 당신의 몫이었습니다
          </h2>
          <div className="about-body">
            <p>
              캘린더로 옮기지 못한 약속, 탭 속에 갇힌 영상과 스크랩, 메모장 어딘가에
              묻힌 지난달의 생각. 우리는 매일 조각을 사방에 흩뿌려 두고, 그것을 다시
              모으는 일까지 스스로 합니다.
            </p>
            <p>
              기록은 충분히 쉬워졌습니다. 어려운 것은 적어 둔 것이 쓸모를 갖는
              일입니다. Subnota는 그 일을 사용자에게 맡기지 않습니다 — 적는 동안
              날짜를 알아보고, 관련된 과거의 문장을 옆에 놓습니다.
            </p>
          </div>
        </section>

        <section className="features-intro shell">
          <p className="section-label">Features</p>
          <h2>한 번 적은 문장이 다음 일과 지난 생각으로 이어집니다</h2>
        </section>

        {CHAPTERS.map((chapter, index) => {
          const copy = CHAPTER_COPY[index];
          return (
            <section
              aria-labelledby={`${chapter.id}-title`}
              className="chapter shell"
              id={chapter.id}
              key={chapter.id}
            >
              <div className="chapter-top">
                <div className="chapter-head">
                  {/* 앱의 탭 칩 모양 그대로. 페이지가 제품의 문법을 빌린다. */}
                  <span className="chapter-chip">{chapter.tab}</span>
                  <h2 id={`${chapter.id}-title`}>{chapter.title}</h2>
                  <p className="chapter-lead">{copy.lead}</p>
                </div>
                {/* 챕터마다 같은 자리(우측 위)에 선다. 아래에 묻어 두면 화면을
                    다 보고 나서야 눈에 들어온다. */}
                <Link className="more-link" href={chapter.href}>
                  더보기
                  <ArrowUpRight />
                </Link>
              </div>

              <div className="chapter-stage">
                {copy.scene}
                {copy.note}
              </div>

              <ul className="chapter-steps">
                {copy.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </section>
          );
        })}

        <section className="download-cta shell" id="download">
          <h2>먼저 적으세요. 잇는 일은 Subnota가 합니다.</h2>
          <p>
            첫 메모는 로그인 없이 시작할 수 있습니다. 적은 것은 기기 안에 먼저
            저장되고, 네트워크가 없어도 쓰는 흐름은 끊기지 않습니다.
          </p>
          <DownloadRow />
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
