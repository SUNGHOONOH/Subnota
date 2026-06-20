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
  Clock,
  Network,
  ListFilter,
  MousePointerClick,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// Mockups and Previews
import MacroMockup from './components/HeroMockup';
import CoreSchedulePreview from './components/CoreSchedulePreview';
import CoreMemoryPreview from './components/CoreMemoryPreview';
import { StateAGraph, StateBGraph } from './components/NetworkGraphPreviews';
import { DesktopInboxPreview, DesktopMiniPreview, DesktopSplitPreview } from './components/DesktopFeaturePreviews';

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
  const [activeMapTab, setActiveMapTab] = useState<'auto' | 'manual'>('manual');
  const [activeDesktopTab, setActiveDesktopTab] = useState<'mini' | 'split'>('mini');
  const [activeInboxTab, setActiveInboxTab] = useState<'desktop' | 'mobile'>('desktop');

  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>

      {/* ─── Header ─── */}
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Subnota 홈">
          <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28" style={{ color: 'var(--ink)', flexShrink: 0 }}>
            <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4 4 4 0 0 1-4-4V6a4 4 0 0 1 4-4zm0 20a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4 4 4 0 0 1 4 4v2a4 4 0 0 1-4 4zm-8-8a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4 4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zm16 0a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4 4 4 0 0 1 4-4h2a4 4 0 0 1 4 4z" />
          </svg>
          <span>Subnota</span>
        </a>
        <nav className="nav-links">
          <div className="nav-item-dropdown">
            <button className="nav-dropdown-trigger">
              Features
            </button>
            <div className="dropdown-menu">
              <div className="dropdown-header">Features</div>

              <a href="#feature-inbox" className="dropdown-item">
                <div className="dropdown-icon-box green">
                  <Inbox size={16} />
                </div>
                <span>수집함 저장</span>
              </a>

              <a href="#feature-map" className="dropdown-item">
                <div className="dropdown-icon-box blue">
                  <Cloud size={16} />
                </div>
                <span>무의식 생각 지도</span>
              </a>

              <a href="#feature-memory" className="dropdown-item">
                <div className="dropdown-icon-box purple">
                  <PenLine size={16} />
                </div>
                <span>과거 생각 검색</span>
              </a>

              <a href="#feature-schedule" className="dropdown-item">
                <div className="dropdown-icon-box orange">
                  <CalendarDays size={16} />
                </div>
                <span>AI 일정 등록</span>
              </a>

            </div>
          </div>
          <a href="#about">About</a>
        </nav>
        <a className="header-cta" href="#download">
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
            <motion.h1 variants={fadeUp} id="hero-title">
              적으면,<br />알아서 정리됩니다
            </motion.h1>
            <motion.p variants={fadeUp} className="hero-subtitle">
              정리하고 찾느라 중요한 영감을 놓치지 않도록, 일상의 기록들을 자연스럽게 이어줍니다.<br />
              정리는 Subnota가 합니다.
            </motion.p>
            <motion.div variants={fadeUp} className="hero-actions hero-store-badges">
              <a
                className="store-badge"
                href="/releases/Subnota.dmg"
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
              <a
                className="store-badge"
                href="https://apps.apple.com/app/subnota"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="App Store 다운로드"
              >
                <svg viewBox="0 0 384 512" width="20" height="20" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                <div>
                  <span>Download on the</span>
                  <strong>App Store</strong>
                </div>
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
            <h2 id="why-title">메모앱은 많지만<br />정리와 발견은 여전히 당신의 몫이었습니다.</h2>
            <p className="section-desc">
              캘린더에 들어가지 못하고 좌절된 일정들,<br />
              브라우저 탭 속에 갇혀버린 영상과 웹 스크랩,<br />
              그리고 메모장 어딘가 깊숙이 묻혀버린 과거의 생각들.<br />
              우리는 매일 사방에 조각들을 흩뿌려 두고 있었습니다.<br /><br />

              기록은 쉬워졌지만,<br />
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
            <motion.article id="feature-schedule" className="core-card core-card-full core-card-clean" variants={fadeUp}>
              <div className="core-copy">
                <h3>메모가 일정이 되는 순간</h3>
                <p><span className="amie-highlight-green">“내일 3시 미팅”</span>처럼 적으면 날짜를 알아보고, 바로 옆 일정 등록 버튼으로 캘린더 블럭을 만듭니다.</p>
              </div>
              <CoreSchedulePreview />
            </motion.article>

            <motion.article id="feature-memory" className="core-card core-card-full core-card-clean" variants={fadeUp}>
              <div className="core-copy">
                <h3>잊힌 아이디어가 다시 떠오르는 순간</h3>
                <p>직접 메모를 연결하거나 찾지 않으셔도 됩니다! Subnota가 지금 쓰는 문장과 닮아있는 과거의 메모를 찾아, <span className="amie-highlight-blue">필요한 순간에 다시 꺼내드립니다.</span></p>
              </div>
              <CoreMemoryPreview />
            </motion.article>

            <motion.article id="feature-inbox" className="core-card core-card-full core-card-clean" variants={fadeUp}>
              <div className="core-copy">
                <h3>흩어진 조각이 수집함에 모이는 순간</h3>
                <div className="map-toggle-tabs">
                  <button
                    className={activeInboxTab === 'desktop' ? 'active' : ''}
                    onClick={() => setActiveInboxTab('desktop')}
                    type="button"
                  >
                    데스크톱
                  </button>
                  <button
                    className={activeInboxTab === 'mobile' ? 'active' : ''}
                    onClick={() => setActiveInboxTab('mobile')}
                    type="button"
                  >
                    모바일
                  </button>
                </div>
                <p>
                  {activeInboxTab === 'desktop' ? (
                    <>데스크톱에서는 <span className="amie-highlight-amber">단축키 하나</span>로 브라우저, 유튜브 영상 속 지식을 즉시 요약하고 수집함에 저장해드립니다.</>
                  ) : (
                    <>모바일에서는 <span className="amie-highlight-clay">공유 버튼</span>으로 브라우저, 유튜브 영상 속 지식을 즉시 요약하고 수집함에 저장해드립니다.</>
                  )}
                </p>
              </div>
              <div className="map-visual-container">
                <AnimatePresence mode="wait">
                  {activeInboxTab === 'desktop' ? (
                    <motion.div
                      key="desktop-inbox"
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -10 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ width: '100%' }}
                    >
                      <DesktopInboxPreview />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="mobile-inbox"
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -10 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ width: '100%' }}
                    >
                      <div className="demo-backplate" style={{ width: '100%' }}>
                        <div style={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '1440/900',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden'
                        }}>
                          {/* iPhone mockup */}
                          <div className="feature-inbox-preview">
                            <div className="iphone" style={{ fontSize: '8.5px', width: '180px', maxWidth: '100%', margin: '0 auto', filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.12))' }}>
                              <div className="iphone-button action" />
                              <div className="iphone-button volume-up" />
                              <div className="iphone-button volume-down" />
                              <div className="iphone-button power" />
                              <div className="iphone-screen">
                                <div className="iphone-status">
                                  <span>9:41</span>
                                  <div className="iphone-island" />
                                  <div className="iphone-status-right" style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                    {/* Cellular signal strength */}
                                    <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" style={{ opacity: 0.9 }}>
                                      <rect x="0" y="8" width="2.5" height="3" rx="0.5" />
                                      <rect x="4.5" y="6" width="2.5" height="5" rx="0.5" />
                                      <rect x="9" y="3.5" width="2.5" height="7.5" rx="0.5" />
                                      <rect x="13.5" y="0" width="2.5" height="11" rx="0.5" />
                                    </svg>
                                    {/* Wifi icon */}
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
                                      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                                      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                                      <path d="M8.5 16.1a5.5 5.5 0 0 1 7 0" />
                                      <circle cx="12" cy="20" r="1.2" fill="currentColor" stroke="none" />
                                    </svg>
                                    {/* Battery icon (Apple Figma Style) */}
                                    <svg width="22" height="11" viewBox="0 0 22 11" fill="currentColor" style={{ opacity: 0.9 }}>
                                      <rect x="0.5" y="0.5" width="18" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1" />
                                      <rect x="2" y="2" width="12" height="7" rx="1.2" />
                                      <path d="M20 3.5C20.5 3.5 20.8 3.8 20.8 4.3V6.7C20.8 7.2 20.5 7.5 20 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                    </svg>
                                  </div>
                                </div>
                                <div className="iphone-app">
                                  <div className="iphone-app-container">
                                    {/* Header */}
                                    <div className="iphone-app-header">
                                      <span className="iphone-app-header-title">무의식</span>
                                      <span className="iphone-app-header-badge">오늘</span>
                                    </div>

                                    {/* Cards List */}
                                    <div className="iphone-app-body">
                                      {/* Card 1 */}
                                      <div className="iphone-app-card">
                                        <span className="iphone-app-card-type">다가오는 일정</span>
                                        <strong className="iphone-app-card-text">오늘 오전 10시 팀 미팅</strong>
                                      </div>

                                      {/* Card 2 */}
                                      <div className="iphone-app-card">
                                        <span className="iphone-app-card-type">이번 주 메모</span>
                                        <strong className="iphone-app-card-text">엄마 생신 선물 토요일까지</strong>
                                      </div>

                                      {/* Card 3 */}
                                      <div className="iphone-app-card">
                                        <span className="iphone-app-card-type">한 달 전쯤의 생각</span>
                                        <strong className="iphone-app-card-text">여행 가기 전에 꼭 해야 할 일 목록</strong>
                                      </div>

                                      {/* Divider */}
                                      <div className="iphone-app-divider" />

                                      {/* Past Inbox 1 */}
                                      <div className="iphone-app-inbox-row">
                                        <div className="iphone-app-inbox-info">
                                          <strong className="iphone-app-inbox-title">과거 브리핑 인박스</strong>
                                          <span className="iphone-app-inbox-sub">워크샵 및 회식 정리...</span>
                                        </div>
                                        <span className="iphone-app-inbox-badge">3</span>
                                      </div>

                                      {/* Past Inbox 2 */}
                                      <div className="iphone-app-inbox-row">
                                        <div className="iphone-app-inbox-info">
                                          <strong className="iphone-app-inbox-title">흩어진 일정 모아보기</strong>
                                          <span className="iphone-app-inbox-sub">저녁 batch 후보 리스트</span>
                                        </div>
                                        <span className="iphone-app-inbox-badge">2</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="iphone-home-ind" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.article>            <motion.article id="feature-map" className="core-card core-card-full core-card-clean" variants={fadeUp}>
              <div className="core-copy">
                <h3>흩어진 메모가 연결되는 순간</h3>
                <div className="map-toggle-tabs">
                  <button
                    className={activeMapTab === 'manual' ? 'active' : ''}
                    onClick={() => setActiveMapTab('manual')}
                    type="button"
                  >
                    연관 문장 검색
                  </button>
                  <button
                    className={activeMapTab === 'auto' ? 'active' : ''}
                    onClick={() => setActiveMapTab('auto')}
                    type="button"
                  >
                    자동 토픽 분류
                  </button>
                </div>
                <p>
                  {activeMapTab === 'auto' ? (
                    <>폴더를 만들지 않아도 AI가 메모의 맥락을 읽어 비슷한 주제끼리 분류하고 <span className="amie-highlight-green">나만의 생각 지도</span>를 만듭니다.</>
                  ) : (
                    <>작성 중인 문장의 핵심 맥락과 연관성 깊은 메모들을 <span className="amie-highlight-blue">실시간 연결망(KNN)</span>으로 탐색하고 수동으로 직접 링크를 이어줍니다.</>
                  )}
                </p>
              </div>
              <div className="map-visual-container">
                <AnimatePresence mode="wait">
                  {activeMapTab === 'auto' ? (
                    <motion.div
                      key="auto-map"
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -10 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ width: '100%' }}
                    >
                      <StateAGraph />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="manual-map"
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -10 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ width: '100%' }}
                    >
                      <StateBGraph />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.article>

            <motion.article id="feature-desktop" className="core-card core-card-full core-card-clean" variants={fadeUp}>
              <div className="core-copy">
                <h3>작업 흐름을 방해하지 않는 순간</h3>
                <div className="map-toggle-tabs">
                  <button
                    className={activeDesktopTab === 'mini' ? 'active' : ''}
                    onClick={() => setActiveDesktopTab('mini')}
                    type="button"
                  >
                    미니 서브노타
                  </button>
                  <button
                    className={activeDesktopTab === 'split' ? 'active' : ''}
                    onClick={() => setActiveDesktopTab('split')}
                    type="button"
                  >
                    스플릿 뷰
                  </button>
                </div>
                <p>
                  {activeDesktopTab === 'mini' ? (
                    <>데스크톱 환경에서 단축키 <kbd style={{ fontFamily: 'monospace', backgroundColor: '#eee5d6', border: '1px solid rgba(196, 142, 36, 0.25)', borderBottomWidth: '2.5px', color: '#1f1d1a', padding: '1px 5px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, margin: '0 4px', verticalAlign: 'middle' }}>⌥S</kbd>를 누르면, 메뉴바의 Subnota 아이콘에서 미니 서브노타가 부드러운 스프링 애니메이션과 함께 나타납니다. 다른 작업을 하면서도 화면 구석에 컴팩트하게 띄워두고 생각의 흐름을 끊김 없이 즉시 기록할 수 있습니다.</>
                  ) : (
                    <>데스크톱 환경에서는 작성 중인 노트를 좌우로 나란히 배치하는 <span className="amie-highlight-blue">스플릿 뷰(Split View)</span>로 여러 정보와 과거 메모를 한눈에 대조하고 참고하며 효율적으로 작업할 수 있습니다.</>
                  )}
                </p>
              </div>
              <div className="map-visual-container">
                <AnimatePresence mode="wait">
                  {activeDesktopTab === 'mini' ? (
                    <motion.div
                      key="mini-subnota"
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -10 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ width: '100%' }}
                    >
                      <DesktopMiniPreview />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="split-view"
                      initial={{ opacity: 0, scale: 0.96, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96, y: -10 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      style={{ width: '100%' }}
                    >
                      <DesktopSplitPreview />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
                Subnota와 함께<br />당신의 생각이 막힘없이 연결되도록
              </h2>
              <p className="download-hero-sub">
                Subnota를 다운로드 받아 첫 메모를 무료로 시작하세요.
              </p>
              <div className="store-badges">
                <a
                  className="store-badge"
                  href="/releases/Subnota.dmg"
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
                <a
                  className="store-badge"
                  href="https://apps.apple.com/app/subnota"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="App Store 다운로드"
                >
                  <svg viewBox="0 0 384 512" width="20" height="20" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                  <div>
                    <span>Download on the</span>
                    <strong>App Store</strong>
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

