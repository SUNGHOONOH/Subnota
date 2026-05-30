'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Bell,
  CalendarDays,
  Camera,
  Cloud,
  FileText,
  Image as ImageIcon,
  Inbox,
  Layers,
  PenLine,
  PlayCircle,
  Share2,
  ShieldCheck,
  Copy,
  Plus,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

/* ── animation presets ── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const vp = { once: true, margin: '-80px' as const };

/* =============================================
   PAGE
   ============================================= */
export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handlePWAInstall = async () => {
    if (!deferredPrompt) {
      alert('PWA 설치를 지원하지 않는 브라우저이거나 이미 설치되었습니다. 크롬, 엣지, 사파리(공유 -> 홈 화면에 추가) 등의 브라우저를 사용해 보세요.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>

      {/* ─── Header ─── */}
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Subnota 홈">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Subnota</span>
        </a>
        <nav className="nav-links">
          <a href="#about">주요 기능</a>
          <a href="#download">다운로드</a>
        </nav>
        <a className="header-cta" href="/app">
          무료로 시작하기 <span className="cta-arrow">→</span>
        </a>
      </header>

      <main id="main">
        {/* ─── Hero ─── */}
        <section className="hero" id="top" aria-labelledby="hero-title">
          <motion.div
            className="hero-content"
            initial={false}
            animate="visible"
            variants={stagger}
          >
            <motion.p variants={fadeUp} className="eyebrow">
              메모 · 일정 · 무의식
            </motion.p>
            <motion.h1 variants={fadeUp} id="hero-title">
              적으면,<br />알아서 정리됩니다
            </motion.h1>
            <motion.p variants={fadeUp} className="hero-subtitle">
              메모가 일정이 되고, 잊힌 생각이 다시 떠오릅니다.<br />
              정리는 Subnota가 합니다.
            </motion.p>
            <motion.div variants={fadeUp} className="hero-actions">
              <a className="btn btn-pill" href="/app">
                <span>무료로 시작하기</span>
                <span className="cta-arrow">→</span>
              </a>
            </motion.div>
          </motion.div>

          <motion.div
            className="hero-scene-wrap"
            initial={false}
            animate="visible"
            variants={scaleIn}
          >
            <MacroMockup />
          </motion.div>
        </section>

        {/* ─── Core 4 ─── */}
        <section className="section why-section" id="about" aria-labelledby="why-title">
          <motion.div
            className="why-header"
            initial={mounted ? "hidden" : false}
            whileInView="visible"
            viewport={vp}
            variants={fadeUp}
          >
            <p className="section-label">Core 4</p>
            <h2 id="why-title">메모앱은 많지만<br />정리와 발견은 여전히 당신의 몫이었습니다.</h2>
            <p className="section-desc">
              폴더를 만들고, 태그를 붙이고,
              캘린더에 다시 옮기고,
              예전에 적어둔 생각을 다시 찾아내는 일까지.<br/><br/>

              기록은 쉬워졌지만,
              기록을 쓸모 있게 만드는 일은 여전히 사용자의 일이었습니다.
            </p>
          </motion.div>

          <motion.div
            className="core-bento"
            initial={mounted ? "hidden" : false}
            whileInView="visible"
            viewport={vp}
            variants={stagger}
          >
            <motion.article className="core-card core-card-large" variants={fadeUp}>
              <div className="core-copy">

                <h3>메모가 일정이 되는 순간</h3>
                <p>“내일 3시 미팅”처럼 적으면 날짜를 알아보고, 바로 옆 일정 등록 버튼으로 캘린더 블럭을 만듭니다.</p>
              </div>
              <CoreSchedulePreview />
            </motion.article>

            <motion.article className="core-card core-card-large" variants={fadeUp}>
              <div className="core-copy">

                <h3>잊힌 생각이 다시 떠오르는 순간</h3>
                <p>지금 쓰는 문장과 닮은 과거의 메모를 찾아, 필요한 순간 다시 꺼내줍니다.</p>
              </div>
              <CoreMemoryPreview />
            </motion.article>

            <motion.article className="core-card core-card-wide" variants={fadeUp}>
              <div className="core-copy">

                <h3>흩어진 조각이 수집함에 모이는 순간</h3>
                <p>스크린샷, 링크, 영상, 메모까지. 생각이 생긴 곳은 달라도 Subnota 안에서는 함께 정리됩니다.</p>
              </div>
              <CoreInboxPreview />
            </motion.article>

            <motion.article className="core-card core-card-map" variants={fadeUp}>
              <div className="core-copy">

                <h3>흩어진 메모가 무의식 지도가 되는 순간</h3>
                <p>폴더를 만들지 않아도, 쌓인 메모들이 주제별로 모여 나만의 생각 지도가 됩니다.</p>
              </div>
              <CoreMapPreview />
            </motion.article>

            <motion.div className="support-card" variants={fadeUp}>
              <Bell size={18} />
              <strong>스마트 브리핑</strong>
              <span>오늘 일정과 오래된 생각을 한 장으로 요약합니다.</span>
            </motion.div>

            <motion.div className="support-card" variants={fadeUp}>
              <PenLine size={18} />
              <strong>오프라인 작성</strong>
              <span>네트워크가 불안정해도 적는 흐름은 끊기지 않습니다.</span>
            </motion.div>

            <motion.div className="support-card" variants={fadeUp}>
              <Cloud size={18} />
              <strong>기기 동기화</strong>
              <span>Mac, Windows, iPhone에서 이어서 작성합니다.</span>
            </motion.div>

            <motion.div className="support-card" variants={fadeUp}>
              <ShieldCheck size={18} />
              <strong>프라이버시 우선</strong>
              <span>당신의 생각은 안전하게 보관됩니다.</span>
            </motion.div>
          </motion.div>
        </section>

        {/* ─── Download ─── */}
        <section className="download-hero" id="download" aria-labelledby="download-title">
          <motion.div
            className="download-hero-inner"
            initial={mounted ? "hidden" : false}
            whileInView="visible"
            viewport={vp}
            variants={stagger}
          >
            <motion.div className="download-hero-text" variants={fadeUp}>
              <p className="section-label">Subnota 다운로드</p>
              <h2 id="download-title">
                Subnota를<br />경험해보세요
              </h2>
              <p className="download-hero-sub">
                Subnota를 다운로드 받아 첫 메모를 무료로 시작하세요.
              </p>
              <div className="store-badges">
                <a
                  className="store-badge"
                  href="/app"
                  aria-label="macOS 다운로드"
                >
                  <svg viewBox="0 0 384 512" width="20" height="20" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                  <div>
                    <span>Download for</span>
                    <strong>macOS</strong>
                  </div>
                </a>
                <a
                  className="store-badge"
                  href="/app"
                  aria-label="Windows 다운로드"
                >
                  <svg viewBox="0 0 448 512" width="20" height="20" fill="currentColor"><path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 512V268.4H203.8v177.9zm0-380.6v180.1H448V0L203.8 65.7z" /></svg>
                  <div>
                    <span>Download for</span>
                    <strong>Windows</strong>
                  </div>
                </a>
              </div>
            </motion.div>
          </motion.div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-brand-side">
            <a className="brand" href="#top" aria-label="Subnota 홈">
              <span className="brand-mark" aria-hidden="true">S</span>
              <span>Subnota</span>
            </a>
            <p className="footer-slogan">정리하지말고 작성만 하세요.</p>
            <p className="footer-copyright">© {new Date().getFullYear()} Subnota. All rights reserved.</p>
          </div>

          <div className="footer-info-side">
            <div className="footer-contact">
              <span>Contact</span>
              <a href="mailto:sunghoon@subnota.com" className="footer-email">support@subnota.com</a>
            </div>

            <div className="footer-links">
              <a href="#privacy">개인정보 처리방침</a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

/* =============================================
   MOCK COMPONENTS
   ============================================= */

function CoreSchedulePreview() {
  const times = ['04', '08', '12', '16', '20'];
  const monthDays = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1];

  return (
    <div className="core-preview core-calendar-preview" aria-hidden="true">
      <div className="core-subnota-compose">
        <div className="core-window-bar">
          <span className="red" />
          <span className="yellow" />
          <span className="green" />
        </div>
        <div className="core-app-rail">
          <div className="core-app-tabs">
            <span className="active">시간순</span>
            <span>무의식 지도</span>
          </div>
          <div className="core-app-list-item">
            <strong>내일 팀 미팅</strong>
            <small>방금 작성</small>
          </div>
        </div>
        <div className="core-app-editor-mini">
          <span className="core-editor-label">메모</span>
          <strong><mark>내일 3시</mark> 미팅</strong>
          <p>지난주 피드백 내용 공유하기</p>
          <button className="core-schedule-action" type="button">
            <CalendarDays size={14} />
            내일 15:00 — 일정 등록
          </button>
        </div>
      </div>

      <div className="core-calendar-panel">
        <div className="core-calendar-head">
          <strong>이번주 블록</strong>
          <span>5월 4주차</span>
        </div>
        <div className="core-week-row">
          <div className="core-week-day">
            <strong>금</strong>
            <span>5.24</span>
          </div>
          <div className="core-week-slots">
            <div className="core-time-head">{times.map(time => <span key={time}>{time}</span>)}</div>
            <div className="core-time-grid">
              <span />
              <span />
              <span className="core-event green"><strong>15:00 팀 미팅</strong><small>메모에서 등록됨</small></span>
              <span />
              <span />
            </div>
          </div>
        </div>
        <div className="core-week-row">
          <div className="core-week-day">
            <strong>토</strong>
            <span>5.25</span>
          </div>
          <div className="core-week-slots">
            <div className="core-time-grid">
              <span />
              <span />
              <span className="core-event clay"><strong>생신</strong><small>꽃바구니 예약</small></span>
              <span className="core-event steel"><strong>식사</strong><small>한정식 집</small></span>
              <span />
            </div>
          </div>
        </div>
      </div>

      <div className="core-calendar-panel core-month-panel">
        <div className="core-calendar-head">
          <strong>2026년 5월</strong>
          <span>5월</span>
        </div>
        <div className="core-month-weekdays">
          {['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day}>{day}</span>)}
        </div>
        <div className="core-month-grid">
          {monthDays.map((day, index) => {
            const isNextMonth = day === 1 && index > 10;
            return (
              <div className={isNextMonth ? 'muted' : undefined} key={`${day}-${index}`}>
                <strong>{day}</strong>
                {day === 24 && !isNextMonth && <span className="core-month-event green">15:00 팀 미팅</span>}
                {day === 25 && !isNextMonth && (
                  <>
                    <span className="core-month-event clay">엄마 생신</span>
                    <span className="core-month-event steel">가족 식사</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CoreMemoryPreview() {
  return (
    <div className="core-preview memory-preview" aria-hidden="true">
      <div className="memory-editor">
        <div className="memory-editor-head">
          <span>메모</span>
          <small>작성 중</small>
        </div>
        <p>
          다음 회의 전에<br />
          질문을 정리해야겠다
          <i />
        </p>
      </div>
      <div className="memory-keyboard">
        <div className="memory-suggestion">
          <Layers size={13} />
          <div>
            <span>2주전 메모</span>
            <strong>회의 때 바로 물어볼 질문 리스트</strong>
          </div>
        </div>
        <div className="keyboard-row">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="keyboard-row narrow">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function CoreInboxPreview() {
  const SHARE_QUEUE = [
    {
      id: 'youtube',
      label: 'YouTube',
      inboxText: '나중에 볼 AI 연구 영상',
      icon: PlayCircle,
      title: '정리 습관을 바꾸는 5가지 방법',
      source: 'youtube.com',
      color: '#ff0000',
      thumbnailColor: 'linear-gradient(135deg, #FF0000 0%, #B30000 100%)',
    },
    {
      id: 'screenshot',
      label: '스크린샷',
      inboxText: '레퍼런스 이미지 캡처',
      icon: ImageIcon,
      title: 'UI_Reference_V2_final.png',
      source: 'Photos',
      color: '#38bdf8',
      thumbnailColor: 'linear-gradient(135deg, #38bdf8 0%, #0369a1 100%)',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      inboxText: '저장해두고 싶은 디자인 트렌드',
      icon: Camera,
      title: '@design_trend 릴스 영상',
      source: 'instagram.com',
      color: '#e1306c',
      thumbnailColor: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    },
    {
      id: 'link',
      label: '웹 링크',
      inboxText: '흩어진 기술 레퍼런스',
      icon: FileText,
      title: 'Next.js 15 공식 가이드 문서',
      source: 'nextjs.org',
      color: '#1f1d1a',
      thumbnailColor: 'linear-gradient(135deg, #1f1d1a 0%, #4f4b42 100%)',
    },
  ];

  const [queueIndex, setQueueIndex] = useState(0);
  const [isFlying, setIsFlying] = useState(false);
  const [inboxItems, setInboxItems] = useState([
    { id: 'init-1', label: '일정', text: '내일 오후 3시 팀 미팅', icon: FileText, isNew: false },
    { id: 'init-2', label: '웹 링크', text: '정리해두고 싶은 기사', icon: FileText, isNew: false },
    { id: 'init-3', label: '스크린샷', text: '태블릿 드로잉 캡처', icon: ImageIcon, isNew: false },
  ]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const activeItem = SHARE_QUEUE[queueIndex];
  const ActiveIcon = activeItem.icon;

  const startSharing = () => {
    if (isFlying) return;
    setIsFlying(true);
  };

  const onFlightComplete = () => {
    setIsFlying(false);
    const newItem = {
      id: `shared-${Date.now()}`,
      label: activeItem.label,
      text: activeItem.inboxText,
      icon: activeItem.icon,
      isNew: true,
    };
    setInboxItems((prev) => {
      const cleared = prev.map((item) => ({ ...item, isNew: false }));
      return [newItem, ...cleared.slice(0, 3)];
    });
    setQueueIndex((prev) => (prev + 1) % SHARE_QUEUE.length);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isFlying) {
        startSharing();
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [queueIndex, isFlying]);

  return (
    <div className="core-preview inbox-preview" aria-hidden="true" style={{ position: 'relative' }}>
      {/* iOS Share Sheet Mockup */}
      <div className="share-sheet">
        <div className="share-handle" />
        
        {/* iOS Preview Header */}
        <div className="share-preview-header">
          <div className="share-preview-thumb" style={{ background: activeItem.thumbnailColor }}>
            <ActiveIcon size={18} />
          </div>
          <div className="share-preview-info">
            <span className="share-preview-type">{activeItem.label}</span>
            <strong className="share-preview-title">{activeItem.title}</strong>
            <span className="share-preview-source">{activeItem.source}</span>
          </div>
        </div>

        {/* Share Apps Row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="share-apps-label">앱 제안</span>
          <div className="share-apps-row">
            {/* AirDrop */}
            <div className="share-app-btn">
              <div className="share-app-icon-wrap" style={{ background: 'linear-gradient(135deg, #007aff 0%, #0056b3 100%)', color: '#fff' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2a10 10 0 0 1 10 10c0 2.38-.83 4.57-2.2 6.3L18 16.5A6.5 6.5 0 0 0 18.5 12a6.5 6.5 0 0 0-6.5-6.5A6.5 6.5 0 0 0 5.5 12c0 1.63.6 3.12 1.6 4.27L5.3 18.1A10 10 0 0 1 12 2z" />
                </svg>
              </div>
              <span className="share-app-name">AirDrop</span>
            </div>

            {/* Messages */}
            <div className="share-app-btn">
              <div className="share-app-icon-wrap" style={{ background: '#34c759', color: '#fff' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="share-app-name">메시지</span>
            </div>

            {/* KakaoTalk */}
            <div className="share-app-btn">
              <div className="share-app-icon-wrap" style={{ background: '#fee500' }}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="#3c1e1e">
                  <path d="M12 3c-4.97 0-9 3.185-9 7.11 0 2.51 1.64 4.71 4.14 5.92l-.84 3.09c-.06.24.18.44.38.31l3.65-2.42c.54.08 1.1.12 1.67.12 4.97 0 9-3.185 9-7.11S16.97 3 12 3z"/>
                </svg>
              </div>
              <span className="share-app-name">카카오톡</span>
            </div>

            {/* Subnota (Trigger Icon) */}
            <button className="share-app-btn" onClick={startSharing} style={{ position: 'relative' }}>
              <div className="share-app-icon-wrap subnota-app">
                <span>S</span>
              </div>
              <span className="share-app-name" style={{ color: 'var(--amber)', fontWeight: 800 }}>Subnota</span>
              
              {!isFlying && (
                <div className="share-tooltip">공유하기</div>
              )}
            </button>
          </div>
        </div>

        {/* Share Action List */}
        <div className="share-actions-list">
          <button className="share-action-item" onClick={() => {
            navigator.clipboard.writeText(activeItem.title);
            alert('복사되었습니다!');
          }}>
            <span>링크 복사</span>
            <Copy size={13} />
          </button>
          <button className="share-action-item subnota-action" onClick={startSharing}>
            <span>Subnota 수집함에 추가</span>
            <Plus size={13} />
          </button>
          <button className="share-action-item">
            <span>독서 목록에 추가</span>
            <BookOpen size={13} />
          </button>
        </div>
      </div>

      {/* Flying Shared Fragment */}
      {isFlying && (
        <motion.div
          className="flying-item"
          initial={
            isMobile
              ? { left: '50%', top: '20%', x: '-50%', y: 0, scale: 1, opacity: 1 }
              : { left: '10%', top: '30%', x: 0, y: 0, scale: 1, opacity: 1 }
          }
          animate={
            isMobile
              ? {
                  left: '50%',
                  top: '60%',
                  x: '-50%',
                  y: 0,
                  scale: 0.8,
                  opacity: [1, 1, 0.8, 0],
                }
              : {
                  left: '55%',
                  top: '35%',
                  x: 0,
                  y: 0,
                  scale: 0.75,
                  opacity: [1, 1, 0.7, 0],
                }
          }
          transition={{
            duration: 0.85,
            ease: [0.25, 1, 0.5, 1], // easeOutQuart
          }}
          onAnimationComplete={onFlightComplete}
        >
          <div className="flying-thumb" style={{ background: activeItem.thumbnailColor }}>
            <ActiveIcon size={14} />
          </div>
          <div className="flying-info">
            <span className="flying-type">{activeItem.label}</span>
            <strong className="flying-title">{activeItem.title}</strong>
          </div>
        </motion.div>
      )}

      {/* Inbox Flow */}
      <div className="inbox-flow">
        <div className="inbox-head">
          <Inbox size={15} />
          <span>수집함</span>
        </div>
        <div className="inbox-stack">
          <AnimatePresence initial={false}>
            {inboxItems.map((item) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ 
                  opacity: 1, 
                  y: 0, 
                  scale: 1,
                  backgroundColor: item.isNew ? 'rgba(196, 142, 36, 0.04)' : 'var(--paper-strong)',
                  borderColor: item.isNew ? 'rgba(196, 142, 36, 0.25)' : 'var(--line)'
                }}
                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                className="inbox-item"
              >
                <item.icon size={14} style={{ color: item.isNew ? 'var(--amber)' : 'var(--muted)' }} />
                <div>
                  <span style={{ color: item.isNew ? 'var(--amber)' : 'var(--muted)' }}>{item.label}</span>
                  <strong>{item.text}</strong>
                </div>
                {item.isNew && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inbox-badge-new"
                  >
                    New
                  </motion.span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function CoreMapPreview() {
  const topics = [
    { label: '업무', count: '12', className: 'topic-orbit-node topic-orbit-work' },
    { label: '아이디어', count: '7', className: 'topic-orbit-node topic-orbit-idea' },
    { label: '일상', count: '8', className: 'topic-orbit-node topic-orbit-daily' },
    { label: '할 일', count: '5', className: 'topic-orbit-node topic-orbit-task' },
    { label: '회고', count: '4', className: 'topic-orbit-node topic-orbit-review' },
  ];

  return (
    <div className="core-preview map-preview" aria-hidden="true">
      <div className="topic-filter-row">
        <span className="active">최근 1달</span>
        <span>최근 6개월</span>
        <span>전체</span>
      </div>
      <div className="topic-graph-shell">
        <div className="topic-center">무의식</div>
        {topics.map(topic => (
          <div className={topic.className} key={topic.label}>
            <strong>{topic.label}</strong>
            <span>{topic.count}개</span>
          </div>
        ))}
      </div>
      <div className="topic-legend">
        {topics.slice(0, 4).map(topic => (
          <span key={topic.label}>
            <i />
            {topic.label} {topic.count}
          </span>
        ))}
      </div>
    </div>
  );
}

function MacroMockup() {
  return (
    <div className="macro-mockup-wrap">
      {/* ── MacBook ── */}
      <div className="macro-desktop">
        <div className="macbook">
          <div className="macbook-screen">
            <div className="macbook-notch">
              <div className="macbook-cam" />
            </div>
            <div className="macbook-content">
              <div className="app-sidebar">
                <div className="app-seg">
                  <span className="active">시간순</span>
                  <span>무의식 지도</span>
                </div>
                <div className="app-memo-item current">
                  <strong>내일 팀 미팅</strong>
                  <span>오늘 오후 3시</span>
                </div>
                <div className="app-memo-item">
                  <strong>주말 여행 준비</strong>
                  <span>여행 가고 싶다..</span>
                </div>
                <div className="app-memo-item">
                  <strong>책 읽고 든 생각</strong>
                  <span>이전 7일</span>
                </div>
              </div>
              <div className="app-editor">
                <p className="app-editor-label">메모</p>
                <h4><span className="hl-date">내일 10시</span> 미팅</h4>
                <p className="app-editor-body">피드백 내용 공유하기</p>
                <div className="app-chip-row">
                  <span className="app-chip date">내일 10시 — 일정 등록</span>
                </div>
                <div className="app-chip-row">
                  <span className="app-chip memory">
                    <Layers size={11} />
                    30일전: 지난달 회의록을 참고해보세요.
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="macbook-hinge" />
          <div className="macbook-base">
            <div className="macbook-trackpad" />
          </div>
        </div>
      </div>

      {/* ── iPhone ── */}
      <div className="macro-mobile">
        <div className="iphone">
          <div className="iphone-button action" />
          <div className="iphone-button volume-up" />
          <div className="iphone-button volume-down" />
          <div className="iphone-button power" />
          <div className="iphone-screen">
            <div className="iphone-status">
              <span>9:41</span>
              <div className="iphone-island" />
              <div className="iphone-status-right">
                <svg width="15" height="10" viewBox="0 0 15 10" fill="currentColor"><rect x="0" y="3" width="3" height="7" rx="0.5" opacity="0.3" /><rect x="4" y="2" width="3" height="8" rx="0.5" opacity="0.5" /><rect x="8" y="1" width="3" height="9" rx="0.5" opacity="0.7" /><rect x="12" y="0" width="3" height="10" rx="0.5" /></svg>
                <svg width="22" height="11" viewBox="0 0 22 11" fill="currentColor"><rect x="0" y="0.5" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1" fill="none" /><rect x="18.5" y="3.5" width="2" height="4" rx="1" fill="currentColor" opacity="0.4" /><rect x="1.5" y="2" width="12" height="7" rx="1" fill="currentColor" /></svg>
              </div>
            </div>
            <div className="iphone-app" style={{ display: 'flex', flexDirection: 'column', padding: '10px 8px 8px 8px', height: 'calc(100% - 44px)', boxSizing: 'border-box' }}>
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E5DDD0',
                borderRadius: '14px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(31, 29, 26, 0.04)'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px 6px 10px',
                  borderBottom: '1px solid #E5DDD0'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#2C2520' }}>무의식</span>
                  <span style={{
                    fontSize: '8px',
                    fontWeight: 700,
                    color: '#5C4D3C',
                    background: '#F5EFE5',
                    padding: '2px 7px',
                    borderRadius: '999px',
                    border: '1px solid #E5DDD0'
                  }}>오늘</span>
                </div>

                {/* Cards List */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  padding: '6px',
                  flex: 1,
                  justifyContent: 'flex-start'
                }}>
                  {/* Card 1 */}
                  <div style={{
                    background: '#FAF8F5',
                    border: '1px solid #EAE3D8',
                    borderRadius: '8px',
                    padding: '5px 7px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px'
                  }}>
                    <span style={{ fontSize: '7px', color: '#9C8E7C', fontWeight: 700 }}>다가오는 일정</span>
                    <strong style={{ fontSize: '8.5px', color: '#2C2520', fontWeight: 800, lineHeight: 1.2 }}>오늘 오전 10시 팀 미팅</strong>
                  </div>

                  {/* Card 2 */}
                  <div style={{
                    background: '#FAF8F5',
                    border: '1px solid #EAE3D8',
                    borderRadius: '8px',
                    padding: '5px 7px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px'
                  }}>
                    <span style={{ fontSize: '7px', color: '#9C8E7C', fontWeight: 700 }}>이번 주 메모</span>
                    <strong style={{ fontSize: '8.5px', color: '#2C2520', fontWeight: 800, lineHeight: 1.25 }}>엄마 생신 선물 토요일까지</strong>
                  </div>

                  {/* Card 3 */}
                  <div style={{
                    background: '#FAF8F5',
                    border: '1px solid #EAE3D8',
                    borderRadius: '8px',
                    padding: '5px 7px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1px'
                  }}>
                    <span style={{ fontSize: '7px', color: '#9C8E7C', fontWeight: 700 }}>한 달 전쯤의 생각</span>
                    <strong style={{ fontSize: '8.5px', color: '#2C2520', fontWeight: 800, lineHeight: 1.25 }}>여행 가기 전에 꼭 해야 할 일 목록</strong>
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid #EAE3D8', margin: '2px 0' }} />

                  {/* Past Inbox 1 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '2px 4px',
                    opacity: 0.8
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <strong style={{ fontSize: '8.5px', color: '#2C2520', fontWeight: 800 }}>과거 브리핑 인박스</strong>
                      <span style={{ fontSize: '7px', color: '#9C8E7C' }}>워크샵 및 회식 정리...</span>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#5C4D3C', background: '#F5EFE5', padding: '1px 5px', borderRadius: '4px', border: '1px solid #E5DDD0' }}>3</span>
                  </div>

                  {/* Past Inbox 2 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '2px 4px',
                    opacity: 0.8
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <strong style={{ fontSize: '8.5px', color: '#2C2520', fontWeight: 800 }}>흩어진 일정 모아보기</strong>
                      <span style={{ fontSize: '7px', color: '#9C8E7C' }}>저녁 batch 후보 리스트</span>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#5C4D3C', background: '#F5EFE5', padding: '1px 5px', borderRadius: '4px', border: '1px solid #E5DDD0' }}>2</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="iphone-home-ind" />
          </div>
        </div>
      </div>
    </div>
  );
}
