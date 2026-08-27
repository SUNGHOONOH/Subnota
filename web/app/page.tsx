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
import { ArrowUpRight } from './subnota-ui/icons';
import { CHAPTERS, DownloadRow, SiteFooter, SiteHeader } from './components/site';
import { useLanguage, useText } from './lib/i18n';
import {
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
export default function Home() {
  const { language } = useLanguage();
  const text = useText();
  const chapterCopy: { lead: ReactNode; scene: ReactNode; note?: ReactNode }[] =
    language === 'en'
      ? [
          {
            lead: (
              <>
                We do not bring back your entire notebook. We quietly surface{' '}
                <Marker tone="blue">the one sentence you need right now</Marker>.
                An old thought appears at just the right moment. Click it and the
                memo where it lives opens beside you.
              </>
            ),
            scene: <ConnectedMemoryScene />,
          },
          {
            lead: (
              <>
                <Marker tone="green">Turn the sentence you wrote into a schedule.</Marker>{' '}
                <span className="wordmark-text">Subnota</span> will find the date.
                No retyping, and no need to open another app.
              </>
            ),
            scene: <MemoToCalendarScene />,
          },
          {
            lead: (
              <>
                <Marker tone="amber">Pick up what you are reading.</Marker> We will
                summarize and organize it for you. It is the tedious part.
              </>
            ),
            scene: <ReuseInboxScene />,
          },
          {
            lead: (
              <>
                Open the screen you need in a new tab and{' '}
                <Marker tone="clay">keep the flow going</Marker>. No jumping between
                windows just to find the right one. There are more windows than we
                think, and thoughts disappear faster.
              </>
            ),
            scene: <ProductivityScene />,
          },
        ]
      : [
          {
            lead: (
              <>
                메모 전체를 다시 꺼내 오진 않습니다.{' '}
                <Marker tone="blue">지금 필요한 문장 한 줄</Marker>만 슬쩍 불러옵니다.
                예전에 쓴 생각이, 타이밍 좋게 다시 나타나는 셈이죠. 누르면 그
                문장이 있던 메모장이 옆에서 나타납니다.
              </>
            ),
            scene: <ConnectedMemoryScene />,
          },
          {
            lead: (
              <>
                <Marker tone="green">적어 둔 문장을 그대로 일정으로 등록하세요!</Marker>{' '}
                날짜는 <span className="wordmark-text">Subnota</span>가 찾아보겠습니다.
                옮겨 적을 일도, 다른 앱을 하나 더 열 필요도 없습니다.
              </>
            ),
            scene: <MemoToCalendarScene />,
          },
          {
            lead: (
              <>
                읽던 페이지에서 <Marker tone="amber">간편하게 주워 담습니다</Marker>.
                알아서 요약하고 정리해드릴게요. 귀찮은 일이니까요.
              </>
            ),
            scene: <ReuseInboxScene />,
          },
          {
            lead: (
              <>
                필요한 화면을 새 탭으로 바로 열고{' '}
                <Marker tone="clay">하던 흐름 그대로</Marker> 이어갑니다. 필요한 화면을
                찾겠다고 창 사이를 전전할 필요는 없습니다. 생각보다 창은 많고,
                생각은 더 빨리 사라지니까요.
              </>
            ),
            scene: <ProductivityScene />,
          },
        ];

  return (
    <>
      <a className="skip-link" href="#main">
        {text('본문으로 건너뛰기', 'Skip to content')}
      </a>
      <SiteHeader />

      <main className="home-main" id="main">
        <section className="hero" id="top">
          {/* 흩어진 생각 조각. 여섯 개만 둔다 — 많아지면 눈이 읽는 순서를
              만들어 "흩어짐"이 아니라 목록이 된다. 각각 다른 종류의 걱정이고,
              끝이 안 맺힌 말투를 섞어야 할 일 목록으로 안 읽힌다. */}
          <span aria-hidden="true" className="thought thought-frost t1">
            <span className="thought-date">{text('내일 3시', 'Tomorrow 3 PM')}</span>{' '}
            {text('팀 미팅', 'Team meeting')}
          </span>
          <span aria-hidden="true" className="thought thought-ink t2">
            {text('주간보고', 'Weekly report')}{' '}
            <span className="thought-date">{text('금요일', 'Friday')}</span>
            {text('까지', ' due')}
          </span>
          <span aria-hidden="true" className="thought thought-frost t3">
            {text('그 영상 어디 저장했더라', 'Where did I save that video?')}
          </span>
          <span aria-hidden="true" className="thought thought-frost thought-far t4">
            {text('그때 그 아이디어 뭐였지', 'What was that idea from then?')}
          </span>
          <span aria-hidden="true" className="thought thought-frost thought-far t5">
            {text("엄마 생신 선물", "Mom's birthday gift")}
          </span>
          <span aria-hidden="true" className="thought thought-frost t6">
            {text('운동 가야 하는데 3일째', 'I should work out — day three')}
          </span>

          <div className="hero-inner shell">
            <h1>
              {text('적기만 하세요.', 'Just write.')}
              <br />
              {text('나머지는', 'Subnota')}
              <br aria-hidden="true" className="hero-mobile-title-break" />{' '}
              {language === 'ko' ? (
                <>
                  <span className="wordmark-text">Subnota</span>가 합니다
                </>
              ) : (
                'takes care of the rest.'
              )}
            </h1>
            <DownloadRow />
          </div>
        </section>

        <section aria-labelledby="about-title" className="about shell" id="about">
          <div className="about-panel">
            {/* 히어로에서 흩어져 있던 조각이 여기 다시 놓인다 — "아까 그
                이야기"라는 표시다. */}
            <div aria-hidden="true" className="about-echoes">
              <span className="about-echo e1">{text('내일 3시 팀 미팅', 'Tomorrow 3 PM team meeting')}</span>
              <span className="about-echo e2">{text('그 영상 어디 저장했더라', 'Where did I save that video?')}</span>
              <span className="about-echo e3">{text('그때 그 아이디어 뭐였지', 'What was that idea from then?')}</span>
            </div>

            <p className="section-label">About</p>
            <h2 id="about-title">
              {text('메모앱은 많지만, 정리와 발견은', 'There are plenty of memo apps, but organizing and rediscovering')}
              <br />
              {text('여전히 당신의 몫이었습니다', 'were still left to you')}
            </h2>

            <p className="about-lead">
              {text(
                '캘린더로 옮기지 못한 약속, 탭 속에 갇힌 영상과 스크랩, 메모장 어딘가에 묻혀 잊힌 어느 날의 꽤 괜찮은 생각까지.',
                'Promises that never made it to the calendar, videos and clips trapped in tabs, and a good idea from some day buried in a memo.',
              )}
            </p>

            <div className="about-body">
              <p>
                {text(
                  '우리는 매일 생각을 사방에 흩뿌려 두고, 나중에 다시 모으는 일까지 스스로 해왔습니다. 흩어놓는 일에는 제법 성실했고, 다시 찾는 일은 늘 내일로 미뤘습니다. 그러다 대부분은 메모장 어딘가에서 조용히 은퇴하고요.',
                  'Every day, we scatter thoughts everywhere and later gather them back ourselves. We are fairly diligent about scattering them, but always put finding them again off until tomorrow. Most quietly retire somewhere in a memo.',
                )}
              </p>
              <p>
                {language === 'ko' ? (
                  <>
                    기록하는 일은 충분히 쉬워졌습니다. 어려운 것은{' '}
                    <Marker tone="blue">적어 둔 생각이 다시 쓰이는 일</Marker>입니다.
                    Subnota는 그 일을 사용자에게 맡기지 않습니다. 너무 귀찮은 일이기도
                    하고, 우리가 대신할 수 있는 일이기도 하니까요.
                  </>
                ) : (
                  <>
                    Writing things down is easy enough now. The hard part is{' '}
                    <Marker tone="blue">putting what you wrote to work again</Marker>.
                    Subnota does not leave that work to you. It is tedious, and it is
                    something we can do for you.
                  </>
                )}
              </p>
              <p>
                {text(
                  '적는 동안 날짜는 일정으로 이어지고, 지금 쓰는 문장과 닿아 있는 과거의 문장은 옆으로 돌아옵니다. 정리는 잠깐 미뤄도 괜찮습니다. 그 시간에 작업에 더욱 몰두하는 편이 낫잖아요.',
                  'As you write, dates become schedules and past sentences related to what you are writing return beside you. It is fine to put organizing off for a while. You are better off using that time to stay focused on the work.',
                )}
              </p>
            </div>

            <p className="about-aside">
              <span>{text('나중에 정리하겠다는 말은, 대체로 나중에도 오지 않으니까요.', 'Because “I will organize it later” rarely makes it to later.')}</span>
            </p>
          </div>
        </section>

        {CHAPTERS.map((chapter, index) => {
          const copy = chapterCopy[index];
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
                  <span className={`chapter-chip tone-${chapter.tone}`}>
                    {text(chapter.tab.ko, chapter.tab.en)}
                  </span>
                  <h2 id={`${chapter.id}-title`}>{text(chapter.title.ko, chapter.title.en)}</h2>
                  <p className="chapter-lead">{copy.lead}</p>
                </div>
                {/* 챕터마다 같은 자리(우측 위)에 선다. 아래에 묻어 두면 화면을
                    다 보고 나서야 눈에 들어온다. */}
                <Link className="more-link" href={chapter.href}>
                  {text('더보기', 'Learn more')}
                  <ArrowUpRight />
                </Link>
              </div>

              <div className="chapter-stage">
                {copy.scene}
                {copy.note}
              </div>
            </section>
          );
        })}

        <section className="download-cta shell" id="download">
          <h2>
            {text('지금 ', 'Download ')}<span className="wordmark-text">Subnota</span>{text('를 다운로드하고', ' now and')}
            <br />
            {text('작업에 몰입하세요.', 'focus on your work.')}
          </h2>
          <p>
            {text('지금은 무료로 시작할 수 있습니다.', 'Start for free today.')}
            <br />
            {text('필요한 순간에 적고, 나머지는 ', 'Write when you need to and leave the rest to ')}
            <span className="wordmark-text">Subnota</span>
            {text('에 맡겨 보세요.', '.')}
          </p>
          <DownloadRow supportNote />
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
