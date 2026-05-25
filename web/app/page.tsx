'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Download,
  Feather,
  FolderOpen,
  Layers,
  Link2,
  Lock,
  MapPin,
  PenLine,
  RotateCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';

/* ── animation presets ── */
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
};

const vp = { once: false, margin: '-80px' as const };

/* =============================================
   PAGE
   ============================================= */
export default function Home() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

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
        <nav className="nav-links" aria-label="주요 섹션">
          <a href="#about">Why Subnota?</a>
          <a href="#memo">메모</a>
          <a href="#calendar">캘린더</a>
          <a href="#unconscious">무의식</a>
          <a href="#download">다운로드</a>
        </nav>
        <a className="header-cta" href="#download">무료로 시작하기</a>
      </header>

      <main id="main">
        {/* ─── Hero ─── */}
        <section className="hero" id="top" aria-labelledby="hero-title">
          <motion.div
            className="hero-content"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.p variants={fadeUp} className="eyebrow">
              메모 · 일정 정리 · 무의식
            </motion.p>
            <motion.h1 variants={fadeUp} id="hero-title">
              정리하지 말고<br />작성만 하세요
            </motion.h1>
            <motion.p variants={fadeUp} className="hero-subtitle">
              메모를 작성하면 알아서 정리되고,
              잊었던 생각이 다시 떠오릅니다.
            </motion.p>
            <motion.div variants={fadeUp} className="hero-actions macro-actions">
              <a className="btn btn-pill" href="#download-win">
                <svg viewBox="0 0 448 512" width="20" height="20" fill="currentColor"><path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 512V268.4H203.8v177.9zm0-380.6v180.1H448V0L203.8 65.7z" /></svg>
                <span>Windows 다운로드</span>
              </a>
              <a className="btn btn-pill" href="#download-mac">
                <svg viewBox="0 0 384 512" width="20" height="20" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                <span>MacOS 다운로드</span>
              </a>
              <div className="btn btn-pill" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                <svg viewBox="0 0 384 512" width="20" height="20" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                <span>iOS App Store - 준비중</span>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            className="hero-scene-wrap"
            initial="hidden"
            animate="visible"
            variants={scaleIn}
          >
            <MacroMockup />
          </motion.div>
        </section>

        {/* ─── Why Subnota: 8대 특장점 격자 그리드 ─── */}
        <section className="section why-section" id="about" aria-labelledby="why-title">
          <motion.div
            className="why-header"
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={fadeUp}
          >
            <p className="section-label">Why Subnota?</p>
            <h2 id="why-title">생각을 기록하는<br />가장 진보된 방법</h2>
            <p className="section-desc">
              적어만 두면 알아서 차곡차곡 정돈되고, 잊혀 가던 옛 생각까지 수면 위로 꺼내 연결해 줍니다.
            </p>
          </motion.div>

          <motion.div
            className="why-grid"
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={stagger}
          >
            <motion.div className="why-grid-item" variants={fadeUp}>
              <div className="why-icon"><PenLine size={20} /></div>
              <h3>말하듯 쓰면 약속이 됩니다</h3>
              <p>“내일 3시 미팅”처럼 평소 친구에게 말하듯 메모에 적기만 하면, 날짜와 시간을 알아서 인식해 달력에 바로 등록을 추천해줍니다.</p>
            </motion.div>

            <motion.div className="why-grid-item" variants={fadeUp}>
              <div className="why-icon"><FolderOpen size={20} /></div>
              <h3>정리할 필요 없는 자동 분류</h3>
              <p>폴더나 태그를 따로 만들며 에너지를 낭비하지 마세요. 메모가 쌓이면 내용을 분석해 비슷한 주제끼리 알아서 묶어줍니다.</p>
            </motion.div>

            <motion.div className="why-grid-item" variants={fadeUp}>
              <div className="why-icon"><Link2 size={20} /></div>
              <h3>생각들의 연결</h3>
              <p>관심 있는 주제를 터치하면, 그 카테고리 안의 메모들이 서로 어떻게 연결되어 있는지 생각망을 그려 보여줍니다.</p>
            </motion.div>

            <motion.div className="why-grid-item" variants={fadeUp}>
              <div className="why-icon"><Sparkles size={20} /></div>
              <h3>잊고있던 생각의 재발견</h3>
              <p>지금 새로운 글을 쓰기 시작하면, 예전에 적어두었던 가장 비슷한 다른 메모들을 화면에 조용히 띄워주어 새로운 아이디어를 이끌어냅니다.</p>
            </motion.div>

            <motion.div className="why-grid-item" variants={fadeUp}>
              <div className="why-icon"><CalendarDays size={20} /></div>
              <h3>캘린더와 유기적인 연동</h3>
              <p>메모장과 캘린더를 번갈아 열 필요가 없습니다. 메모에서 보낸 일정들이 주간 일정표와 월간 캘린더에 완벽하게 동기화됩니다.</p>
            </motion.div>

            <motion.div className="why-grid-item" variants={fadeUp}>
              <div className="why-icon"><Bell size={20} /></div>
              <h3>매일 아침 배달되는 생각 요약</h3>
              <p>매일 아침 오늘 챙겨야 할 일정과 다시 읽어보면 유용한 오래전 생각 조각들을 모아, 첫 화면에 읽기 아침 브리핑을 해드립니다.</p>
            </motion.div>

            <motion.div className="why-grid-item" variants={fadeUp}>
              <div className="why-icon"><Download size={20} /></div>
              <h3>인터넷 없이도 멈추지 않는 메모</h3>
              <p>비행기나 지하철처럼 인터넷이 끊긴 곳에서도 걱정 없이 메모를 쓰고 읽을 수 있으며, 다시 연결되는 즉시 실시간으로 업데이트됩니다.</p>
            </motion.div>

            <motion.div className="why-grid-item" variants={fadeUp}>
              <div className="why-icon"><Lock size={20} /></div>
              <h3>모든 기기 실시간 동기화</h3>
              <p>컴퓨터에서 쓰던 메모를 태블릿이나 스마트폰에서도 아무런 끊김 없이 이어서 작성할 수 있도록 실시간으로 똑같이 맞춰줍니다.</p>
            </motion.div>
          </motion.div>
        </section>

        {/* ─── Feature 1: 메모 (State A + B 포함) ─── */}
        <section className="feature-section memo-mega" id="memo" aria-labelledby="memo-title">
          <motion.div
            className="feature-grid"
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={stagger}
          >
            <motion.div className="feature-text" variants={fadeUp}>
              <p className="section-label">Memo</p>
              <h2 id="memo-title">생각을 먼저 적고,<br />무의식을 연결시켜드립니다.</h2>
              <p className="section-desc">
                떠오른 생각을 바로 적으세요. “내일 10시”, “다음 주 금요일”,
                “토요일까지”처럼 한국어로 적으면 Subnota가 날짜를 알아봅니다.
                바로 일정으로 보낼 수 있고, 미처 등록하지 못한 일정 후보도
                한 곳에 모아 나중에 확인할 수 있습니다.
                과거에 적었던 비슷한 문장도 조용히 곁에 나타납니다.
                정리하지 않아도 메모끼리 연결되는 것 —
                우리는 이것을 <strong>무의식의 연결</strong>이라 부릅니다.
              </p>
              <div className="feature-details">
                <div className="feature-detail">
                  <div className="feature-detail-icon amber"><PenLine size={18} /></div>
                  <div className="feature-detail-text">
                    <strong>한국어 날짜 인식</strong>
                    <span>“내일 10시”, “토요일까지”를 알아보고 일정으로 보낼 수 있습니다.</span>
                  </div>
                </div>
                <div className="feature-detail">
                  <div className="feature-detail-icon amber"><CalendarDays size={18} /></div>
                  <div className="feature-detail-text">
                    <strong>놓친 일정 후보</strong>
                    <span>등록하지 못한 약속도 일정 인박스에 모아 다시 확인합니다.</span>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div className="feature-visual" variants={scaleIn}>
              <HeroMockup />
            </motion.div>
          </motion.div>

          {/* State B + State A side-by-side */}
          <motion.div
            className="state-cards"
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={stagger}
          >
            <motion.div className="state-card" variants={fadeUp}>
              <div className="state-card-header">
                <p className="state-label">무의식 연결</p>
                <h3>작성중인 문장과<br />닮은 기억을 찾습니다.</h3>
                <p className="state-desc">
                  글을 쓰다 멈추면 작성 중인 문장을 기준으로<br></br>
                  과거의 아이디어 메모 조각이 조용히 떠오릅니다.<br></br>
                  가까울수록 지금 문장과 더 닮은 기억입니다.
                </p>
              </div>
              <div className="state-card-visual">
                <StateBGraph />
              </div>
            </motion.div>

            <motion.div className="state-card" variants={fadeUp}>
              <div className="state-card-header">
                <p className="state-label">무의식 지도</p>
                <h3>흩어진 메모가<br />주제가 됩니다.</h3>
                <p className="state-desc">
                  메모가 쌓이면 주제별로 모여
                  카테고리가 완성됩니다.<br></br>
                  카테고리 안 메모의 수가 크기를 결정합니다.
                </p>
              </div>
              <div className="state-card-visual">
                <StateAGraph />
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* ─── Feature 2: 캘린더 ─── */}
        <section
          className="feature-section"
          id="calendar"
          aria-labelledby="calendar-title"
          style={{ background: 'var(--paper-warm)' }}
        >
          <motion.div
            className="feature-grid reverse"
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={stagger}
          >
            <motion.div className="feature-text" variants={fadeUp}>
              <p className="section-label">Calendar</p>
              <h2 id="calendar-title">메모 속 약속을<br />한눈에 정리합니다</h2>
              <p className="section-desc">
                메모에서 보낸 일정이 주간 보드와 월간 캘린더에 나타납니다.<br></br>
                블럭 일정을 쉽게 옮기고, 일정 안에서도 메모를 작성해보세요.<br></br>
                아이디어는 무한하니까요.
              </p>
              <div className="feature-details">
                <div className="feature-detail">
                  <div className="feature-detail-icon clay"><CalendarDays size={18} /></div>
                  <div className="feature-detail-text">
                    <strong>주간 · 월간 보기</strong>
                    <span>상황에 맞게 뷰를 전환</span>
                  </div>
                </div>
                <div className="feature-detail">
                  <div className="feature-detail-icon clay"><MapPin size={18} /></div>
                  <div className="feature-detail-text">
                    <strong>메모 안에 메모</strong>
                    <span>일정 블럭 안에 필요한 메모를 함께 남길 수 있습니다.</span>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div className="feature-visual" variants={scaleIn}>
              <CalendarMockCard />
            </motion.div>
          </motion.div>
        </section>

        {/* ─── Feature 3: 무의식 ─── */}
        <section className="feature-section" id="unconscious" aria-labelledby="unconscious-title">
          <motion.div
            className="feature-grid"
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={stagger}
          >
            <motion.div className="feature-text" variants={fadeUp}>
              <p className="section-label">Unconscious</p>
              <h2 id="unconscious-title">하루를 여는<br />한 장의 무의식</h2>
              <p className="section-desc">
                오늘의 일정, 확인해야 할 메모, 한 달 전쯤 적었던 생각까지.
                아침에 무의식 탭 하나만 열면 오늘 할 일과 놓치기 쉬운 기억을
                한 화면에서 확인합니다.
              </p>
              <div className="feature-details">
                <div className="feature-detail">
                  <div className="feature-detail-icon steel"><Bell size={18} /></div>
                  <div className="feature-detail-text">
                    <strong>오늘의 요약</strong>
                    <span>일정 + 메모 + 오래된 기억을 하나로</span>
                  </div>
                </div>
                <div className="feature-detail">
                  <div className="feature-detail-icon steel"><RotateCcw size={18} /></div>
                  <div className="feature-detail-text">
                    <strong>무의식의 연결</strong>
                    <span>잊힌 메모를 다시 꺼내줍니다</span>
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div className="feature-visual" variants={scaleIn}>
              <UnconsciousMockCard />
            </motion.div>
          </motion.div>
        </section>

        {/* ─── Download ─── */}
        <section className="download-hero" id="download" aria-labelledby="download-title">
          <motion.div
            className="download-hero-inner"
            initial="hidden"
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
                  href={process.env.NEXT_PUBLIC_MACOS_DOWNLOAD_URL ?? '#download'}
                  aria-label="macOS 다운로드"
                >
                  <svg viewBox="0 0 384 512" width="20" height="20" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                  <div>
                    <span>Download for</span>
                    <strong>macOS</strong>
                  </div>
                </a>
                <div
                  className="store-badge"
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                  aria-label="App Store에서 다운로드 (준비중)"
                >
                  <svg viewBox="0 0 384 512" width="20" height="20" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                  <div>
                    <span>App Store</span>
                    <strong>준비중</strong>
                  </div>
                </div>
                <a
                  className="store-badge"
                  href={process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL ?? '#download'}
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
            <p className="footer-slogan">정리보다 작성이 먼저인 메모 앱</p>
            <p className="footer-copyright">© {new Date().getFullYear()} Subnota. All rights reserved.</p>
          </div>

          <div className="footer-info-side">
            <div className="footer-contact">
              <span>Contact</span>
              <a href="mailto:support@subnota.com" className="footer-email">support@subnota.com</a>
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

function HeroMockup() {
  return (
    <div className="scene-window scene-main">
      <div className="scene-toolbar">
        <span /><span /><span />
      </div>
      <div className="scene-body">
        <aside className="scene-sidebar">
          <div className="scene-seg">
            <span className="active">시간순</span>
            <span>무의식 지도</span>
          </div>
          <div className="scene-item current">
            <strong>내일 팀 미팅</strong>
            <span>오늘 오후 3시</span>
          </div>
          <div className="scene-item">
            <strong>주말 여행 준비</strong>
            <span>여행 가고 싶다..</span>
          </div>
          <div className="scene-item">
            <strong>책 읽고 든 생각</strong>
            <span>이전 7일</span>
          </div>
        </aside>
        <section className="scene-editor">
          <p className="scene-editor-label">메모</p>
          <h3><span className="editor-highlight-date">내일 오전 10시</span> 오팀장님과 미팅있음</h3>
          <p>
            지난주 피드백 정리해서 공유하기
          </p>
          <div className="scene-chip">내일 10시 — 일정 등록</div>
          <div className="scene-memory">
            <Layers size={13} />
            30일전: 지난달에도 오팀장님과 미팅건으로 작성한 아이디어가 있습니다.
          </div>
        </section>
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
                <div className="app-memo-item">
                  <strong>프로젝트 회고</strong>
                  <span>지난주</span>
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

                <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '16px 0 14px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <h5 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)', marginBottom: '4px' }}>주말 여행 준비</h5>
                    <p style={{ color: 'var(--ink-soft)', fontSize: '11px', lineHeight: 1.5, margin: 0 }}>
                      여권 만료일 재확인하기, 가벼운 외투와 세면도구 챙기기. 카메라 삼각대 꼭 챙길 것.
                    </p>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '2px 0 0 0' }} />

                  <div>
                    <h5 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ink)', marginBottom: '4px' }}>책 읽고 든 생각</h5>
                    <p style={{ color: 'var(--ink-soft)', fontSize: '11px', lineHeight: 1.5, margin: 0 }}>
                      좋은 생각은 정리된 데이터가 아니라 무의식적인 생각 조각들이 충돌할 때 나온다고 한다.
                    </p>
                  </div>
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

function MemoMockCard() {
  return (
    <div className="mock-card">
      <div className="mock-card-header">
        <span>메모</span>
      </div>
      <div className="mock-card-body">
        <div className="memo-mock-paper">
          <p className="title">엄마 생신 선물 사기</p>
          <p className="body">
            이번 주 토요일까지 준비해야 함.
            작년에는 화분 줬는데 올해는 뭐가 좋을지
            생각해보기.
          </p>
          <div className="memo-tokens">
            <span className="token date">토요일 — 일정 등록</span>
            <span className="token memory">
              <Layers size={12} /> 작년 메모 연결됨
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarMockCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* 주간 캘린더 예시 */}
      <div className="mock-card" style={{ padding: '16px', background: '#FAF6F0', borderRadius: '12px' }}>
        <div className="mock-card-header" style={{ marginBottom: '12px', borderBottom: '1px solid #DDD8CC', paddingBottom: '8px' }}>
          <span style={{ color: '#1D1D1F', fontSize: '14px', fontWeight: '800' }}>이번주 블록</span>
          <small style={{ background: '#FAF6F0', border: '1px solid #DDD8CC', color: '#5C4D3C', fontSize: '10px', padding: '3px 8px', borderRadius: '999px', fontWeight: '700' }}>5월 4주차</small>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Day Row 1 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #DDD8CC', paddingBottom: '8px' }}>
            <div style={{ width: '48px', borderRight: '1px solid #DDD8CC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingRight: '4px' }}>
              <span style={{ fontSize: '12px', color: '#5E5E63', fontWeight: 700 }}>금</span>
              <span style={{ fontSize: '9px', color: 'rgba(94, 94, 99, 0.48)', fontWeight: 800, marginTop: '2px' }}>5.24</span>
            </div>
            <div style={{ flex: 1, paddingLeft: '8px' }}>
              <div style={{ display: 'flex', height: '14px', marginBottom: '4px' }}>
                {['04', '08', '12', '16', '20'].map(t => (
                  <span key={t} style={{ flex: 1, textAlign: 'center', fontSize: '8px', color: 'rgba(94, 94, 99, 0.52)', fontWeight: '800' }}>{t}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '1px' }}>
                <div style={{ flex: 1, height: '36px', borderLeft: '1px dotted rgba(94,94,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(94,94,99,0.3)', fontSize: '10px' }}>+</div>
                <div style={{ flex: 1, height: '36px', borderLeft: '1px dotted rgba(94,94,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(94,94,99,0.3)', fontSize: '10px' }}>+</div>
                <div style={{ flex: 1, padding: '1px', borderLeft: '1px dotted rgba(94,94,99,0.15)' }}>
                  <div style={{
                    background: '#E4ECDD',
                    borderLeft: '2.5px solid #7C9A72',
                    height: '34px',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center'
                  }}>
                    <strong style={{ fontSize: '9px', color: '#2F3437', fontWeight: '800', lineHeight: 1.2 }}>미팅</strong>
                    <span style={{ fontSize: '7.5px', color: '#7A7A7E', fontWeight: '500', lineHeight: 1.2 }}>오팀장님 피드백 공유</span>
                  </div>
                </div>
                <div style={{ flex: 1, height: '36px', borderLeft: '1px dotted rgba(94,94,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(94,94,99,0.3)', fontSize: '10px' }}>+</div>
                <div style={{ flex: 1, height: '36px', borderLeft: '1px dotted rgba(94,94,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(94,94,99,0.3)', fontSize: '10px' }}>+</div>
              </div>
            </div>
          </div>
          {/* Day Row 2 */}
          <div style={{ display: 'flex', paddingBottom: '2px' }}>
            <div style={{ width: '48px', borderRight: '1px solid #DDD8CC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingRight: '4px' }}>
              <span style={{ fontSize: '12px', color: '#5E5E63', fontWeight: 700 }}>토</span>
              <span style={{ fontSize: '9px', color: 'rgba(94, 94, 99, 0.48)', fontWeight: 800, marginTop: '2px' }}>5.25</span>
            </div>
            <div style={{ flex: 1, paddingLeft: '8px' }}>
              <div style={{ display: 'flex', height: '14px', marginBottom: '4px' }}>
                {['04', '08', '12', '16', '20'].map(t => (
                  <span key={t} style={{ flex: 1, textAlign: 'center', fontSize: '8px', color: 'rgba(94, 94, 99, 0.52)', fontWeight: '800' }}>{t}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '1px' }}>
                <div style={{ flex: 1, height: '36px', borderLeft: '1px dotted rgba(94,94,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(94,94,99,0.3)', fontSize: '10px' }}>+</div>
                <div style={{ flex: 1, height: '36px', borderLeft: '1px dotted rgba(94,94,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(94,94,99,0.3)', fontSize: '10px' }}>+</div>
                <div style={{ flex: 1, padding: '1px', borderLeft: '1px dotted rgba(94,94,99,0.15)' }}>
                  <div style={{
                    background: '#F2E4D8',
                    borderLeft: '2.5px solid #C2593F',
                    height: '34px',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center'
                  }}>
                    <strong style={{ fontSize: '9px', color: '#7A3A2B', fontWeight: '800', lineHeight: 1.2 }}>생신</strong>
                    <span style={{ fontSize: '7.5px', color: '#9C8E7C', fontWeight: '500', lineHeight: 1.2 }}>꽃바구니 예약</span>
                  </div>
                </div>
                <div style={{ flex: 1, padding: '1px', borderLeft: '1px dotted rgba(94,94,99,0.15)' }}>
                  <div style={{
                    background: '#E8E6DD',
                    borderLeft: '2.5px solid #50616b',
                    height: '34px',
                    borderRadius: '3px',
                    padding: '2px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'center'
                  }}>
                    <strong style={{ fontSize: '9px', color: '#33424b', fontWeight: '800', lineHeight: 1.2 }}>식사</strong>
                    <span style={{ fontSize: '7.5px', color: '#9C8E7C', fontWeight: '500', lineHeight: 1.2 }}>한정식 집</span>
                  </div>
                </div>
                <div style={{ flex: 1, height: '36px', borderLeft: '1px dotted rgba(94,94,99,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(94,94,99,0.3)', fontSize: '10px' }}>+</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 월간 캘린더 예시 */}
      <div className="mock-card" style={{ padding: '16px', background: '#FAF6F0', borderRadius: '12px' }}>
        <div className="mock-card-header" style={{ marginBottom: '12px' }}>
          <span style={{ color: '#1D1D1F', fontSize: '14px', fontWeight: '800' }}>2026년 5월</span>
          <small style={{ background: '#FAF6F0', border: '1px solid #DDD8CC', color: '#5C4D3C', fontSize: '10px', padding: '3px 8px', borderRadius: '999px', fontWeight: '700' }}>5월</small>
        </div>
        <div style={{ display: 'flex', width: '100%', marginBottom: '6px' }}>
          {['일', '월', '화', '수', '목', '금', '토'].map(d => (
            <span key={d} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#7A7A7E', fontWeight: 800 }}>{d}</span>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: '0.5px solid #E1DED5', borderLeft: '0.5px solid #E1DED5' }}>
          {[19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1].map((day, i) => {
            const isCurrentMonth = !(day === 1 && i > 10);
            return (
              <div key={i} style={{ width: `${100 / 7}%`, minHeight: '52px', borderRight: '0.5px solid #E1DED5', borderBottom: '0.5px solid #E1DED5', padding: '3px 4px', opacity: isCurrentMonth ? 1 : 0.32 }}>
                <div style={{ fontSize: '10px', color: '#1D1D1F', fontWeight: 800, marginBottom: '3px' }}>{day}</div>
                {day === 24 && isCurrentMonth && (
                  <div style={{ background: '#E4ECDD', borderLeft: '2px solid #7C9A72', color: '#2F3437', fontSize: '8px', padding: '1px 3px', borderRadius: '2px', fontWeight: '700', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>10:00 팀 미팅</div>
                )}
                {day === 25 && isCurrentMonth && (
                  <>
                    <div style={{ background: '#F2E4D8', borderLeft: '2px solid #C2593F', color: '#7A3A2B', fontSize: '8px', padding: '1px 3px', borderRadius: '2px', fontWeight: '700', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>엄마 생신</div>
                    <div style={{ background: '#E8E6DD', borderLeft: '2px solid #50616b', color: '#33424b', fontSize: '8px', padding: '1px 3px', borderRadius: '2px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>가족 식사</div>
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

/* ─── State B: network node graph with hover popup ─── */
function StateBGraph() {
  return (
    <div className="node-graph">
      <svg className="node-lines" viewBox="0 0 400 280" preserveAspectRatio="none">
        {/* Concentric circular grid lines (solar system orbits) matching node distances: 75px, 115px, 140px */}
        <circle cx="200" cy="140" r="75" fill="none" stroke="rgba(31, 29, 26, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="200" cy="140" r="115" fill="none" stroke="rgba(31, 29, 26, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="200" cy="140" r="140" fill="none" stroke="rgba(31, 29, 26, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>

      {/* Center: current memo */}
      <div className="graph-node graph-node-center" style={{ top: '50%', left: '50%' }}>
        <span className="graph-dot active" style={{ width: '46px', height: '46px' }} />
        <span className="graph-label" style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          padding: '3px 8px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.5)',
          boxShadow: '0 4px 12px rgba(31,29,26,0.05)'
        }}>내일 오전 미팅 준비</span>
      </div>

      {/* Connected past memos (Floating exactly on orbits) */}
      {/* Satellite 1: Highly similar (similarity: ~0.88, closest, largest) */}
      <div className="graph-node float-slow" style={{ top: '31%', left: '36.7%' }}>
        <div className="graph-popup static arrow-down centered-arrow" style={{ bottom: '42px', top: 'auto', left: '50%', transform: 'translateX(-50%)', width: '105px', padding: '6px' }}>
          <strong style={{ fontSize: '9px', marginBottom: '1px', color: 'var(--ink)' }}>미팅 체크리스트</strong>
          <p style={{ fontSize: '8px', marginBottom: '2px', lineHeight: 1.2 }}>질문 리스트 미리 정리</p>
          <small style={{ fontSize: '7px', color: 'var(--muted)' }}>3주 전</small>
        </div>
        <span className="graph-dot active" style={{ animation: 'pulse 2s infinite', width: '36px', height: '36px' }} />
        <span className="graph-label" style={{ fontSize: '10px', marginTop: '4px' }}>피드백 작성</span>
      </div>

      {/* Satellite 2: Medium similarity (similarity: ~0.72, middle distance, medium size) */}
      <div className="graph-node float-medium" style={{ top: '29.3%', left: '75%' }}>
        <div className="graph-popup static arrow-down centered-arrow" style={{ bottom: '42px', top: 'auto', left: '50%', transform: 'translateX(-50%)', width: '105px', padding: '6px' }}>
          <strong style={{ fontSize: '9px', marginBottom: '1px', color: 'var(--ink)' }}>지난 회의 메모</strong>
          <p style={{ fontSize: '8px', marginBottom: '2px', lineHeight: 1.2 }}>데이터 충분히 확보</p>
          <small style={{ fontSize: '7px', color: 'var(--muted)' }}>1달 전</small>
        </div>
        <span className="graph-dot" style={{ width: '20px', height: '20px' }} />
        <span className="graph-label" style={{ fontSize: '10px', marginTop: '4px' }}>오팀장 코멘트</span>
      </div>

      {/* Satellite 3: Low similarity (similarity: ~0.42, furthest, smallest size) */}
      <div className="graph-node float-fast" style={{ top: '93.2%', left: '32.5%' }}>
        <span className="graph-label" style={{ fontSize: '10px', marginBottom: '4px' }}>회식 장소</span>
        <span className="graph-dot" style={{ width: '12px', height: '12px' }} />
        <div className="graph-popup static centered-arrow" style={{ top: '38px', left: '50%', transform: 'translateX(-50%)', width: '105px', padding: '6px' }}>
          <strong style={{ fontSize: '9px', marginBottom: '1px', color: 'var(--ink)' }}>회식 아이디어</strong>
          <p style={{ fontSize: '8px', marginBottom: '2px', lineHeight: 1.2 }}>근처 조용한 식당 검색</p>
          <small style={{ fontSize: '7px', color: 'var(--muted)' }}>2달 전</small>
        </div>
      </div>
    </div>
  );
}

/* ─── State A: topic cluster graph ─── */
function StateAGraph() {
  return (
    <div className="node-graph">
      {/* Category nodes float freely with no connecting lines or circles */}
      <div className="graph-node float-slow" style={{ top: '18%', left: '30%' }}>
        <span className="graph-dot clay" style={{ width: '38px', height: '38px' }} />
        <span className="graph-label" style={{ marginTop: '2px' }}>업무</span>
        <small>12개</small>
      </div>

      <div className="graph-node float-medium" style={{ top: '26%', left: '70%' }}>
        <span className="graph-dot steel" style={{ width: '18px', height: '18px' }} />
        <span className="graph-label" style={{ marginTop: '2px' }}>할 일</span>
        <small>5개</small>
      </div>

      <div className="graph-node float-fast" style={{ top: '70%', left: '25%' }}>
        <span className="graph-dot amber" style={{ width: '26px', height: '26px' }} />
        <span className="graph-label" style={{ marginTop: '2px' }}>아이디어</span>
        <small>7개</small>
      </div>

      <div className="graph-node float-medium" style={{ top: '68%', left: '65%' }}>
        <span className="graph-dot amber" style={{ width: '30px', height: '30px' }} />
        <span className="graph-label" style={{ marginTop: '2px' }}>일상</span>
        <small>8개</small>
      </div>
    </div>
  );
}

function UnconsciousMockCard() {
  return (
    <div className="mock-card">
      <div className="mock-card-header">
        <span>무의식</span>
        <small>오늘</small>
      </div>
      <div className="mock-card-body">
        <div className="briefing-list">
          <div className="briefing-item">
            <span>다가오는 일정</span>
            <strong>오늘 오전 10시 팀 미팅</strong>
          </div>
          <div className="briefing-item">
            <span>이번 주 메모</span>
            <strong>엄마 생신 선물 토요일까지</strong>
          </div>
          <div className="briefing-item">
            <span>한 달 전쯤의 생각</span>
            <strong>여행 가기 전에 꼭 해야 할 일 목록</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
