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
                      <div className="demo-backplate" style={{ width: '100%' }}>
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '1440/900' }}>
                          {/* Screen Bezel (No keyboard/trackpad base) */}
                          <div className="macbook-screen-only" style={{
                            background: '#08080a',
                            border: '2px solid #5a5a5c',
                            borderRadius: '16px',
                            margin: '0 auto',
                            overflow: 'hidden',
                            padding: '8px',
                            position: 'relative',
                            width: '100%',
                            height: '100%'
                          }}>
                            {/* Notch and Cam */}
                            <div className="macbook-notch" style={{
                              alignItems: 'center',
                              background: '#08080a',
                              borderRadius: '0 0 6px 6px',
                              display: 'flex',
                              height: '11px',
                              justifyContent: 'center',
                              left: '50%',
                              position: 'absolute',
                              top: 0,
                              transform: 'translateX(-50%)',
                              width: '70px',
                              zIndex: 10
                            }}>
                              <div className="macbook-cam" style={{
                                background: '#0f0f12',
                                border: '1px solid #1a1a20',
                                borderRadius: '50%',
                                boxShadow: 'inset 0 0.5px 0.5px rgba(255, 255, 255, 0.2)',
                                height: '3px',
                                width: '3px'
                              }} />
                            </div>

                            {/* Screen Content: 1440/900 aspect ratio */}
                            <div className="inbox-macbook-screen-content" style={{
                              height: '100%',
                              background: 'linear-gradient(135deg, #e65c87 0%, #9a51ce 50%, #476bec 100%)',
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              overflow: 'hidden',
                              borderRadius: '0px',
                              width: '100%'
                            }}>
                              {/* macOS Top Menu Bar */}
                              <div className="mac-menu-bar" style={{
                                height: '18px',
                                background: 'rgba(255, 255, 255, 0.45)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0 8px',
                                fontSize: '8px',
                                color: 'rgba(0, 0, 0, 0.85)',
                                fontWeight: 500,
                                fontFamily: '"SF Pro", "SF Pro KR", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                letterSpacing: '-0.1px',
                                zIndex: 15
                              }}>
                                {/* Left Menus (English, Subnota replaces Safari, Apple Logo removed) */}
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <strong style={{ fontWeight: 700, color: 'rgba(0, 0, 0, 0.9)' }}>Subnota</strong>
                                  <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>File</span>
                                  <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>Edit</span>
                                  <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>View</span>
                                  <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>Window</span>
                                  <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>Help</span>
                                </div>

                                {/* Right Icons (Wifi, Battery, Clock) */}
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
                                    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                                    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                                    <path d="M8.5 16.1a5.5 5.5 0 0 1 7 0" />
                                    <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
                                  </svg>
                                  {/* Battery Icon (Apple Figma Style) */}
                                  <svg width="14" height="7" viewBox="0 0 22 11" fill="currentColor" style={{ opacity: 0.85 }}>
                                    <rect x="0.5" y="0.5" width="18" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
                                    <rect x="2.5" y="2.5" width="11" height="6" rx="1" />
                                    <path d="M20 3.5C20.5 3.5 20.8 3.8 20.8 4.3V6.7C20.8 7.2 20.5 7.5 20 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                  </svg>
                                  <span style={{ fontSize: '8px', fontWeight: 500, opacity: 0.85 }}>오후 7:30</span>
                                </div>
                              </div>

                              {/* Safari Window Floating */}
                              <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '3% 4% 4% 4%'
                              }}>
                                <div className="safari-window" style={{
                                  width: '100%',
                                  height: '100%',
                                  background: '#ffffff',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(0, 0, 0, 0.08)',
                                  boxShadow: '0 12px 24px rgba(0, 0, 0, 0.12), 0 3px 8px rgba(0, 0, 0, 0.06)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  overflow: 'hidden',
                                  position: 'relative'
                                }}>
                                  {/* Browser Header */}
                                  <div className="safari-header" style={{
                                    height: '18px',
                                    background: '#ebebeb',
                                    borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 8px',
                                    position: 'relative'
                                  }}>
                                    <div className="dots" style={{ display: 'flex', gap: '3px' }}>
                                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ee6a5f', display: 'inline-block' }} />
                                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f4bf4f', display: 'inline-block' }} />
                                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#61c554', display: 'inline-block' }} />
                                    </div>
                                    {/* Address Bar */}
                                    <div className="address-bar" style={{
                                      position: 'absolute',
                                      left: '50%',
                                      top: '50%',
                                      transform: 'translate(-50%, -50%)',
                                      background: '#ffffff',
                                      border: '1px solid rgba(0, 0, 0, 0.05)',
                                      borderRadius: '3px',
                                      width: '110px',
                                      height: '11px',
                                      fontSize: '7px',
                                      color: '#4f4f4f',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                                      userSelect: 'none'
                                    }}>
                                      subnota.com
                                    </div>
                                  </div>

                                  {/* Browser Webpage Content */}
                                  <div style={{ flex: 1, padding: '8px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fcfcfc' }}>
                                    <div
                                      className="webpage-canvas"
                                      style={{
                                        flex: 1,
                                        background: '#ffffff',
                                        borderRadius: '5px',
                                        border: '1px solid rgba(0, 0, 0, 0.05)',
                                        padding: '12px 8px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        gap: '4px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                                      }}
                                    >
                                      <div style={{ fontSize: '8px', fontWeight: 900, color: 'var(--amber)' }}>S Subnota</div>
                                      <strong style={{ fontSize: '10px', color: '#1f1d1a', textAlign: 'center', lineHeight: 1.2 }}>적으면,<br />알아서 정리됩니다.</strong>
                                      <span style={{ fontSize: '6px', color: 'var(--muted)', textAlign: 'center' }}>정리는 Subnota가 합니다.</span>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', width: '100%', marginTop: '4px' }}>
                                        <span style={{ height: '12px', background: 'rgba(107, 143, 91, 0.08)', borderRadius: '2px' }} />
                                        <span style={{ height: '12px', background: 'rgba(196, 142, 36, 0.08)', borderRadius: '2px' }} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Hand-drawn Arrow pointing to Subnota menu bar item */}
                          <div style={{ position: 'absolute', right: '8%', top: '-22px', zIndex: 30, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontFamily: "'Nanum Pen Script', cursive",
                              fontSize: '18px',
                              color: 'var(--amber)',
                              transform: 'rotate(-3deg)',
                              whiteSpace: 'nowrap',
                              marginRight: '4px',
                              marginTop: '8px'
                            }}>
                              바로 Subnota가 요약하고 있을 거예요!
                            </span>
                            <svg width="45" height="25" viewBox="0 0 45 25" fill="none">
                              <path
                                filter="url(#pencil-sketch)"
                                  d="M5,20 C18,12 28,15 38,6"
                                stroke="var(--amber)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                              <path
                                filter="url(#pencil-sketch)"
                                  d="M30,3 L40,6"
                                stroke="var(--amber)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                              <path
                                filter="url(#pencil-sketch)"
                                  d="M40,6 L35,16"
                                stroke="var(--amber)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
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
                    <>데스크톱 환경에서는 다른 작업을 하거나 글을 쓰면서도 화면 구석에 작고 컴팩트하게 띄워둘 수 있는 <span className="amie-highlight-amber">미니 서브노타(Mini Subnota)</span>를 통해 메인 앱을 열지 않고도 생각의 흐름을 끊김 없이 기록할 수 있습니다.</>
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

/* =============================================
   MOCK COMPONENTS
   ============================================= */

function CoreSchedulePreview() {
  const times = ['04', '08', '12', '16', '20'];
  const monthDays = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1];
  const fullText = "내일 3시 미팅";

  const [phase, setPhase] = useState<"typing" | "positioning" | "selecting" | "selected" | "hovering-button" | "clicking-button" | "connecting" | "registered" | "hold" | "reset">("typing");
  const [typedLength, setTypedLength] = useState(0);
  const [selectedLength, setSelectedLength] = useState(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const [arrowActive, setArrowActive] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (phase === "typing") {
      if (typedLength < fullText.length) {
        const delay = 120 + Math.random() * 80;
        timer = setTimeout(() => {
          setTypedLength(prev => prev + 1);
        }, delay);
      } else {
        // Typing finished, wait 600ms then move cursor to start of text
        timer = setTimeout(() => {
          setPhase("positioning");
        }, 600);
      }
    } else if (phase === "positioning") {
      // Cursor positioning takes 600ms, then wait 400ms to start selecting
      timer = setTimeout(() => {
        setPhase("selecting");
      }, 1000);
    } else if (phase === "selecting") {
      // Selection dragging: select "내일 3시 미팅" (8 chars)
      if (selectedLength < fullText.length) {
        timer = setTimeout(() => {
          setSelectedLength(prev => prev + 1);
        }, 160);
      } else {
        // Selection complete, wait 400ms then show register button
        timer = setTimeout(() => {
          setPhase("selected");
        }, 400);
      }
    } else if (phase === "selected") {
      // Button appears, wait 500ms then cursor hovers to button
      timer = setTimeout(() => {
        setPhase("hovering-button");
      }, 500);
    } else if (phase === "hovering-button") {
      // Hover takes 600ms, wait 350ms to click
      timer = setTimeout(() => {
        setPhase("clicking-button");
      }, 950);
    } else if (phase === "clicking-button") {
      // Click animation takes 250ms, then trigger registration and arrow
      timer = setTimeout(() => {
        setPhase("connecting");
        setArrowActive(true);
      }, 250);
    } else if (phase === "connecting") {
      // Arrow draws for 900ms
      timer = setTimeout(() => {
        setPhase("registered");
      }, 900);
    } else if (phase === "registered") {
      setIsRegistered(true);
      setArrowActive(false);
      // Wait for drop pop animation
      timer = setTimeout(() => {
        setPhase("hold");
      }, 600);
    } else if (phase === "hold") {
      // Hold completed state for 3500ms
      timer = setTimeout(() => {
        setPhase("reset");
      }, 3500);
    } else if (phase === "reset") {
      setIsRegistered(false);
      setArrowActive(false);
      setTypedLength(0);
      setSelectedLength(0);
      timer = setTimeout(() => {
        setPhase("typing");
      }, 500);
    }

    return () => clearTimeout(timer);
  }, [phase, typedLength, selectedLength]);

  return (
    <div className="core-preview core-calendar-preview" aria-hidden="true" style={{ position: 'relative' }}>
      {/* Left half: Note compose editor */}
      <div className="core-subnota-compose">
        <div className="core-window-bar">
          <span className="red" />
          <span className="yellow" />
          <span className="green" />
        </div>
        <div className="core-app-rail">
          <div className="sidebar-section-title">메모</div>
          <div className="core-app-list-item" style={{ border: '1px solid rgba(196, 142, 36, 0.12)', background: '#fffdf8' }}>
            <strong>내일 팀 미팅</strong>
            <small>5.23 (목) 오후 3:03</small>
          </div>
        </div>
        <div className="core-app-editor-mini" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div className="editor-date-header" style={{ marginTop: '-4px' }}>2026년 5월 23일 오후 3:03</div>
          <span className="core-editor-label" style={{ marginBottom: '4px' }}>메모</span>
          {typedLength > 0 ? (
            <span className="editor-note-body" style={{ fontSize: '14px', color: '#1f1d1a', fontWeight: 400, display: 'block', lineHeight: 1.5 }}>
              {/* Selecting phase */}
              {phase === "selecting" && (
                <>
                  {/* Selected orange highlight */}
                  <span style={{
                    background: 'rgba(196, 142, 36, 0.25)',
                    color: '#1f1d1a',
                    borderRadius: '2px',
                    padding: '1px 0'
                  }}>
                    {fullText.slice(0, selectedLength)}
                  </span>

                  {/* Unselected parts (retaining green highlight for "내일 3시" characters if not yet dragged over) */}
                  {selectedLength < 5 ? (
                    <>
                      <mark style={{
                        background: 'rgba(107, 143, 91, 0.14)',
                        color: '#6b8f5b',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        marginRight: '2px',
                        display: 'inline-block'
                      }}>
                        {fullText.slice(selectedLength, 5)}
                      </mark>
                      {fullText.slice(5, typedLength)}
                    </>
                  ) : (
                    fullText.slice(selectedLength, typedLength)
                  )}
                </>
              )}

              {/* Other phases (typing highlight / selected state / hold) */}
              {phase !== "selecting" && (
                typedLength >= 5 ? (
                  <>
                    <mark style={{
                      background: 'rgba(107, 143, 91, 0.14)',
                      color: '#6b8f5b',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      marginRight: '2px',
                      display: 'inline-block'
                    }}>
                      {fullText.slice(0, 5)}
                    </mark>
                    {fullText.slice(5, typedLength)}
                  </>
                ) : (
                  fullText.slice(0, typedLength)
                )
              )}

              {phase === "typing" && <span className="raycast-cursor" />}
            </span>
          ) : (
            <span className="editor-placeholder" style={{ color: '#c3bcb0', fontSize: '13px' }}>작성을 시작하세요...</span>
          )}

          {/* Floating Schedule Registration Button */}
          <AnimatePresence>
            {(phase === "selected" || phase === "hovering-button" || phase === "clicking-button") && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                animate={{
                  opacity: 1,
                  scale: phase === "clicking-button" ? 0.92 : 1,
                  y: 0
                }}
                exit={{ opacity: 0, scale: 0.8, y: -8 }}
                transition={{ type: "spring", stiffness: 450, damping: 14 }}
                style={{
                  position: 'absolute',
                  left: '19.5%',
                  top: '38%',
                  background: 'var(--amber)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '5px 9px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 4px 12px rgba(196, 142, 36, 0.25)',
                  zIndex: 20
                }}
              >
                <CalendarDays size={12} />
                <span>일정 등록</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* SVG Cute Hand-Drawn Arrow - completely invisible until selected and draws sequentially with a pencil effect */}
      <svg className="sketch-arrow" viewBox="0 0 120 60" fill="none">
        <defs>
          <filter id="pencil-sketch" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        {/* Main arrow shaft - wavy & imperfect */}
        <motion.path
          filter="url(#pencil-sketch)"
          d="M12,38 C35,16 65,22 110,24"
          stroke="var(--amber-soft)"
          strokeWidth="3.2"
          strokeLinecap="round"
          variants={{
            typing: { pathLength: 0, opacity: 0 },
            positioning: { pathLength: 0, opacity: 0 },
            selecting: { pathLength: 0, opacity: 0 },
            selected: { pathLength: 0, opacity: 0 },
            "hovering-button": { pathLength: 0, opacity: 0 },
            "clicking-button": { pathLength: 0, opacity: 0 },
            connecting: {
              pathLength: 1,
              opacity: 0.8,
              transition: { duration: 0.9, ease: "easeInOut" }
            },
            registered: {
              pathLength: 1,
              opacity: 0.8,
            },
            hold: {
              pathLength: 1,
              opacity: [0.8, 0],
              transition: { duration: 0.5, delay: 0.5 }
            },
            reset: { pathLength: 0, opacity: 0 }
          }}
          animate={phase}
          initial="typing"
        />
        {/* Arrow head - wing 1 */}
        <motion.path
          filter="url(#pencil-sketch)"
          d="M95,15 L110,24"
          stroke="var(--amber-soft)"
          strokeWidth="3.2"
          strokeLinecap="round"
          variants={{
            typing: { pathLength: 0, opacity: 0 },
            positioning: { pathLength: 0, opacity: 0 },
            selecting: { pathLength: 0, opacity: 0 },
            selected: { pathLength: 0, opacity: 0 },
            "hovering-button": { pathLength: 0, opacity: 0 },
            "clicking-button": { pathLength: 0, opacity: 0 },
            connecting: {
              pathLength: 1,
              opacity: 0.8,
              transition: { delay: 0.6, duration: 0.3, ease: "easeOut" }
            },
            registered: {
              pathLength: 1,
              opacity: 0.8,
            },
            hold: {
              pathLength: 1,
              opacity: [0.8, 0],
              transition: { duration: 0.5, delay: 0.5 }
            },
            reset: { pathLength: 0, opacity: 0 }
          }}
          animate={phase}
          initial="typing"
        />
        {/* Arrow head - wing 2 */}
        <motion.path
          filter="url(#pencil-sketch)"
          d="M110,24 L98,34"
          stroke="var(--amber-soft)"
          strokeWidth="3.2"
          strokeLinecap="round"
          variants={{
            typing: { pathLength: 0, opacity: 0 },
            positioning: { pathLength: 0, opacity: 0 },
            selecting: { pathLength: 0, opacity: 0 },
            selected: { pathLength: 0, opacity: 0 },
            "hovering-button": { pathLength: 0, opacity: 0 },
            "clicking-button": { pathLength: 0, opacity: 0 },
            connecting: {
              pathLength: 1,
              opacity: 0.8,
              transition: { delay: 0.7, duration: 0.2, ease: "easeOut" }
            },
            registered: {
              pathLength: 1,
              opacity: 0.8,
            },
            hold: {
              pathLength: 1,
              opacity: [0.8, 0],
              transition: { duration: 0.5, delay: 0.5 }
            },
            reset: { pathLength: 0, opacity: 0 }
          }}
          animate={phase}
          initial="typing"
        />
      </svg>

      {/* Right half: Calendar panels stack */}
      <div className="calendar-right-stack">
        {/* Week block */}
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
                <div style={{ minHeight: '34px', position: 'relative', width: '100%' }}>
                  <AnimatePresence>
                    {isRegistered && (
                      <motion.span
                        className="core-event green"
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }}
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -5 }}
                        transition={{ type: "spring", stiffness: 350, damping: 15 }}
                      >
                        <strong>15:00 팀 미팅</strong>
                        <small>메모에서 등록됨</small>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
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

        {/* Month block */}
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
                  {day === 24 && !isNextMonth && (
                    <div style={{ minHeight: '12px', position: 'relative', width: '100%' }}>
                      <AnimatePresence>
                        {isRegistered && (
                          <motion.span
                            className="core-month-event green"
                            style={{ position: 'absolute', left: 0, right: 0, top: 0 }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                          >
                            15:00 팀 미팅
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
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

      {/* Simulated Mouse Cursor */}
      <motion.div
        className="simulated-cursor"
        style={{
          display: phase === "typing" || phase === "reset" ? "none" : "block",
        }}
        variants={{
          typing: { left: "15%", top: "70%", opacity: 0 },
          positioning: { left: "17.8%", top: "58.5%", opacity: 1, transition: { duration: 0.6, ease: "easeOut" } },
          selecting: {
            left: "26.5%",
            top: "58.5%",
            opacity: 1,
            transition: { duration: 1.28, ease: "linear" }
          },
          selected: { left: "26.5%", top: "58.5%", opacity: 1 },
          "hovering-button": {
            left: "21.5%",
            top: "44.5%",
            opacity: 1,
            transition: { duration: 0.6, ease: "easeOut" }
          },
          "clicking-button": {
            left: "21.5%",
            top: "44.5%",
            scale: 0.82,
            opacity: 1,
            transition: { duration: 0.15 }
          },
          connecting: {
            left: "17.8%",
            top: "59.5%",
            scale: 1,
            opacity: 0,
            transition: { duration: 0.4 }
          },
          registered: { opacity: 0 },
          hold: { opacity: 0 },
          reset: { opacity: 0 }
        }}
        animate={phase}
        initial="typing"
      >
        {phase === "positioning" || phase === "selecting" ? (
          /* High-Contrast I-Beam Caret SVG for selection dragging */
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 2V16M2 2H8M2 16H8" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M5 2V16M2 2H8M2 16H8" stroke="#1f1d1a" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ) : (
          /* Arrow Pointer SVG */
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4.5 3V20.5L10.5 15L13.5 21L16 19.5L13 13.5L19.5 13L4.5 3Z"
              fill="#1f1d1a"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </motion.div>
    </div>
  );
}

function CoreMemoryPreview() {
  const fullText = '다음 회의 전에\n질문을 정리해야겠다';
  const [typedLength, setTypedLength] = useState(0);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const runLoop = () => {
      if (typedLength < fullText.length) {
        // Typing phase
        const delay = 100 + Math.random() * 80;
        timer = setTimeout(() => {
          setTypedLength((prev) => prev + 1);
        }, delay);
      } else {
        // Typing complete - wait 1.0s, then show suggestion card
        timer = setTimeout(() => {
          setShowSuggestion(true);

          // Wait 1.2s, then trigger "press" (scale down)
          timer = setTimeout(() => {
            setIsPressed(true);

            // Wait 150ms, then trigger "release" (scale up) & open popup
            timer = setTimeout(() => {
              setIsPressed(false);
              setShowPopup(true);

              // Show both for 4.5s, then fade out
              timer = setTimeout(() => {
                setShowSuggestion(false);
                setShowPopup(false);

                // Wait for exit transition (600ms), then reset typing
                timer = setTimeout(() => {
                  setTypedLength(0);
                }, 600);
              }, 4500);
            }, 150);
          }, 1200);
        }, 1000);
      }
    };

    runLoop();
    return () => clearTimeout(timer);
  }, [typedLength]);

  return (
    <div className="core-preview memory-preview-desktop" aria-hidden="true">
      {/* 1. Translucent Custom macOS Menu Bar (Commented out as requested)
      <div className="raycast-menu-bar">
        <div className="raycast-menu-bar-left">
          <span className="apple-logo-mini">
            <svg viewBox="0 0 170 170" width="10" height="10" fill="currentColor">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.37.13-9.13-1.9-14.28-6.1-3.48-2.82-7.45-7.61-11.9-14.37C17.2 114.24 8.5 89.59 8.5 66.27c0-15.66 4.1-28.52 12.3-38.56 8.21-10.05 18.2-15.16 30-15.34 5.92 0 11.98 1.62 18.2 4.85 6.22 3.22 10.68 4.84 13.39 4.84 2.45 0 6.9-1.68 13.33-5.02 6.43-3.34 12.37-4.96 17.8-4.85 18.42.36 32.22 7.02 41.39 20 8.04 11.25 12.06 24 12.06 38.25 0 9.17-2 18-6.01 26.51M119.22 8.24c0 7.72-2.77 15.66-8.31 21.83-5.54 6.17-12 10.05-19.38 11.66-.24-1.91-.36-3.82-.36-5.74 0-7.39 2.9-15.26 8.7-21.36 5.8-6.11 12.56-9.87 20.25-11.29.24 1.9.36 3.82.36 5.74" />
            </svg>
          </span>
          <strong>Finder</strong>
          <span>File</span>
          <span>Edit</span>
          <span>View</span>
        </div>
        <div className="raycast-menu-bar-right">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '-2px' }}>
            <rect x="2" y="6" width="16" height="12" rx="2" />
            <path d="M22 10v4" />
            <rect x="5" y="9" width="10" height="6" fill="currentColor" stroke="none" />
          </svg>
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.5 16.1a5.5 5.5 0 0 1 7 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
          </svg>
          <span>6월 3일 (수) 오후 3:03</span>
        </div>
      </div>
      */}

      {/* 2. Glassmorphic App Window Mockup */}
      <div className="app-window-glass">
        {/* App Titlebar */}
        <div className="app-window-titlebar">
          <div className="dots-container">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <span className="window-title">Subnota</span>
        </div>

        {/* App Content Grid */}
        <div className="app-window-body">
          {/* Sidebar */}
          <div className="app-window-sidebar">
            <div className="sidebar-section-title">메모</div>
            <div className="sidebar-item active">
              <strong>회의 질문 정리</strong>
              <div className="sidebar-item-sub">
                <span className="sidebar-date">오후 3:03</span>
                <span className="sidebar-preview">질문을 정리해야겠다</span>
              </div>
            </div>
            <div className="sidebar-item">
              <strong>주말 여행 계획</strong>
              <div className="sidebar-item-sub">
                <span className="sidebar-date">어제</span>
                <span className="sidebar-preview">가평 펜션 예약하기</span>
              </div>
            </div>
            <div className="sidebar-item">
              <strong>책 구절 스크랩</strong>
              <div className="sidebar-item-sub">
                <span className="sidebar-date">2026. 5. 20.</span>
                <span className="sidebar-preview">인간은 생각하는 갈대다</span>
              </div>
            </div>
          </div>

          {/* Editor Area */}
          <div className="app-window-editor">
            <div className="editor-date-header">2026년 6월 3일 오후 3:03</div>
            <div className="editor-content-box">
              <div className="editor-typing-text">
                {typedLength <= 8 ? (
                  <span className="editor-note-title">
                    {fullText.slice(0, typedLength)}
                    <span className="raycast-cursor" />
                  </span>
                ) : (
                  <>
                    <span className="editor-note-title">{"다음 회의 전에"}</span>
                    <span className="editor-note-body">
                      {fullText.slice(8, typedLength)}
                      <span className="raycast-cursor" />
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Slide up recommendation card */}
            <div className="editor-suggestion-container">
              <AnimatePresence>
                {showSuggestion && (
                  <motion.div
                    className={`glass-suggestion-card ${showPopup ? 'card-active' : ''}`}
                    initial={{ opacity: 0, y: 15, scale: 0.96 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: isPressed ? 0.92 : 1, // Mechanical spring click effect (92% size when pressed, snap back to 100%)
                      backgroundColor: showPopup ? 'rgba(196, 142, 36, 0.05)' : 'rgba(255, 253, 248, 0.9)',
                      borderColor: showPopup ? 'rgba(196, 142, 36, 0.35)' : 'rgba(196, 142, 36, 0.22)'
                    }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{
                      type: 'spring',
                      stiffness: 450,
                      damping: 14
                    }}
                  >
                    <div className="suggestion-icon-wrap">
                      <Layers size={13} className="gold-icon" />
                    </div>
                    <div className="suggestion-info">
                      <span className="suggestion-label">2주전 메모</span>
                      <strong className="suggestion-title">회의 때 바로 물어볼 질문 리스트</strong>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Float detailed memo preview popup */}
            <AnimatePresence>
              {showPopup && (
                <motion.div
                  className="glass-memo-popup"
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  <div className="popup-header">
                    <span className="popup-date">2주 전 — 2026.05.20</span>
                    <strong className="popup-title">회의 질문 리스트</strong>
                  </div>
                  <ul className="popup-bullets">
                    <li>지난주 피드백 반영 사항 확인</li>
                    <li>신규 디자인 QA 진행 상황</li>
                    <li>다음 스프린트 일정 조율</li>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}



const allMemos = [
  { category: '업무', time: '3분 전', title: '디자인 QA 피드백 정리 및 전달', color: '#c2593f' },
  { category: '일상', time: '2시간 전', title: '마트에서 저녁 요리 재료 장보기', color: '#50616b' },
  { category: '할 일', time: '오늘', title: '밀린 방 청소 및 분리수거하기', color: '#a47814' },
  { category: '업무', time: '어제', title: '다음 스프린트 마일스톤 회의 조율', color: '#c2593f' },
  { category: '아이디어', time: '어제', title: '새로운 생각 정리 도구 UI 스케치', color: '#d8a840' },
  { category: '일상', time: '2일 전', title: '주말 가족 여행 숙소 예약 확인', color: '#50616b' },
];

const CursorSvg = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,0.3))' }}>
    <path d="M4 4L11.5 20L14.5 14L20.5 11L4 4Z" fill="#2C2520" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round" />
  </svg>
);

function StateAGraph() {
  const [phase, setPhase] = useState<'chrono' | 'clicking-map' | 'map' | 'clicking-node' | 'filtered' | 'reset'>('chrono');
  const [isPressed, setIsPressed] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const runLoop = () => {
      // 1단계: 시간순 목록 (Chrono)
      setPhase('chrono');
      setActiveStep(0);
      setIsPressed(false);

      // 2200ms 후 "무의식 지도" 버튼 클릭하러 마우스 이동 시작
      timer = setTimeout(() => {
        setPhase('clicking-map');

        // 800ms 동안 마우스가 이동하여 탭 위에 도달한 시점에 click 누름(isPressed = true)
        timer = setTimeout(() => {
          setIsPressed(true);

          // 180ms 후 click 뗌 -> 무의식 지도(map) 화면으로 전환
          timer = setTimeout(() => {
            setIsPressed(false);
            setPhase('map');
            setActiveStep(1);

            // 1500ms 동안 마우스가 '업무' 노드로 이동하여 도달
            timer = setTimeout(() => {
              setPhase('clicking-node');
              setIsPressed(true);

              // 180ms 후 click 뗌 -> 필터링(filtered) 상태로 전환
              timer = setTimeout(() => {
                setIsPressed(false);
                setPhase('filtered');
                setActiveStep(2);

                // 4500ms 동안 필터링된 상태를 보여줌
                timer = setTimeout(() => {
                  setPhase('reset');

                  // 500ms 후 리셋 후 루프 재시작
                  timer = setTimeout(() => {
                    runLoop();
                  }, 500);
                }, 4500);
              }, 180);
            }, 1500);
          }, 180);
        }, 800);
      }, 2200);
    };

    runLoop();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="demo-backplate" style={{ width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10' }}>
        <div className="app-window-glass" aria-hidden="true" style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none', width: '100%', height: '100%', border: 'none', filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.12))', overflow: 'hidden' }}>
          {/* App Titlebar */}
          <div className="app-window-titlebar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="dots-container">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <span className="window-title" style={{ position: 'static', transform: 'none' }}>Subnota</span>
            <div style={{ width: '40px' }} /> {/* Balance space */}
          </div>

          {/* App Content Grid */}
          <div className="app-window-body" style={{ display: 'flex', flexDirection: 'row', height: 'calc(100% - 28px)', width: '100%', overflow: 'hidden' }}>
            {/* Sidebar */}
            <div
              className="app-window-sidebar"
              style={{
                width: '110px',
                flexShrink: 0,
                padding: '10px 8px',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid rgba(196, 142, 36, 0.08)',
                background: 'rgba(247, 242, 234, 0.35)',
                height: '100%',
                boxSizing: 'border-box'
              }}
            >
              {/* Horizontal Capsule Segment Tabs */}
              <div style={{
                background: 'rgba(44, 37, 32, 0.06)',
                borderRadius: '6px',
                display: 'flex',
                padding: '2px',
                marginBottom: '10px',
                position: 'relative'
              }}>
                <div style={{
                  flex: 1,
                  textAlign: 'center',
                  background: (phase === 'chrono' || phase === 'clicking-map') ? '#fff' : 'transparent',
                  borderRadius: '4px',
                  fontSize: '7.5px',
                  fontWeight: 800,
                  padding: '3px 0',
                  color: (phase === 'chrono' || phase === 'clicking-map') ? '#2c2520' : '#8c8273',
                  boxShadow: (phase === 'chrono' || phase === 'clicking-map') ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}>
                  시간순
                </div>
                <div style={{
                  flex: 1,
                  textAlign: 'center',
                  background: (phase !== 'chrono' && phase !== 'clicking-map') ? '#fff' : 'transparent',
                  borderRadius: '4px',
                  fontSize: '7.5px',
                  fontWeight: 800,
                  padding: '3px 0',
                  color: (phase !== 'chrono' && phase !== 'clicking-map') ? '#2c2520' : '#8c8273',
                  boxShadow: (phase !== 'chrono' && phase !== 'clicking-map') ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s',
                  userSelect: 'none'
                }}>
                  무의식 지도
                </div>
              </div>

              {/* Memo List Area */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <AnimatePresence mode="wait">
                  {(phase === 'chrono' || phase === 'clicking-map') ? (
                    <motion.div
                      key="chrono-sidebar"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}
                    >
                      {/* Active Card: 내일 팀 미팅 */}
                      <div style={{
                        background: '#fff',
                        border: '1px solid rgba(196, 142, 36, 0.18)',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        boxShadow: '0 2px 6px rgba(196,142,36,0.06)'
                      }}>
                        <strong style={{ fontSize: '8.5px', color: '#2C2520', fontWeight: 800, display: 'block', marginBottom: '1px' }}>내일 팀 미팅</strong>
                        <span style={{ fontSize: '7px', color: '#9C9283' }}>오늘 오후 3시</span>
                      </div>

                      {/* 주말 여행 준비 */}
                      <div style={{ padding: '5px 8px' }}>
                        <strong style={{ fontSize: '8px', color: '#5C4D3C', fontWeight: 600, display: 'block' }}>주말 여행 준비</strong>
                        <span style={{ fontSize: '6.5px', color: '#9C9283' }}>여행 가고 싶다..</span>
                      </div>

                      {/* 책 읽고 든 생각 */}
                      <div style={{ padding: '5px 8px' }}>
                        <strong style={{ fontSize: '8px', color: '#5C4D3C', fontWeight: 600, display: 'block' }}>책 읽고 든 생각</strong>
                        <span style={{ fontSize: '6.5px', color: '#9C9283' }}>이전 7일</span>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="map-sidebar"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      {phase === 'filtered' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <div style={{ fontSize: '7.5px', color: '#c2593f', fontWeight: 800, letterSpacing: '0.2px', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '4px', paddingLeft: '4px' }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#c2593f', display: 'inline-block' }} />
                            업무 메모 (2)
                          </div>
                          <div style={{
                            background: '#fff',
                            border: '1px solid rgba(194, 89, 63, 0.12)',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            boxShadow: '0 1px 3px rgba(194, 89, 63, 0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1px'
                          }}>
                            <strong style={{ fontSize: '8px', color: '#2c2520', fontWeight: 700 }}>디자인 QA 피드백</strong>
                            <span style={{ fontSize: '6.5px', color: '#9C9283' }}>오후 3:03</span>
                          </div>
                          <div style={{
                            background: '#fff',
                            border: '1px solid rgba(194, 89, 63, 0.12)',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            boxShadow: '0 1px 3px rgba(194, 89, 63, 0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1px'
                          }}>
                            <strong style={{ fontSize: '8px', color: '#2c2520', fontWeight: 700 }}>스프린트 일정 조율</strong>
                            <span style={{ fontSize: '6.5px', color: '#9C9283' }}>어제</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          padding: '12px 6px',
                          textAlign: 'center',
                          fontSize: '7px',
                          color: '#9C9283',
                          lineHeight: 1.4
                        }}>
                          지도의 노드를 클릭하여<br />메모를 필터링해보세요.
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Editor Workspace */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', background: '#fffdf8' }}>
              {/* Editor Canvas (Notepad) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 14px', minWidth: 0, position: 'relative' }}>
                <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="editor-date-header" style={{ fontSize: '8px', color: '#9C9283', marginBottom: '6px' }}>2026년 6월 3일 오후 3:03</div>
                  <strong style={{ fontSize: '10px', color: '#2C2520', fontWeight: 800, marginBottom: '4px' }}>내일 팀 미팅 준비</strong>
                  <div style={{ fontSize: '9px', color: '#5C4D3C', lineHeight: 1.5, flex: 1, opacity: 0.85 }}>
                    <div>오늘 회의에서 피드백 받은 내용을 정리해 보았다.</div>
                    <div>이번 신규 디자인 QA 진행 상황을 점검해야 하고,</div>
                    <div>다음 스프린트 일정을 맞춰야 한다.</div>
                    <div style={{ marginTop: '6px' }}>* 디자인 가이드라인 정합성 확인</div>
                    <div>* QA 이슈 정리 및 지라 등록</div>
                  </div>
                </div>
              </div>

              {/* Split Pane (Node Graph) */}
              <motion.div
                className="app-window-split-pane"
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: ['map', 'clicking-node', 'filtered'].includes(phase) ? '42%' : '0%',
                  opacity: ['map', 'clicking-node', 'filtered'].includes(phase) ? 1 : 0
                }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  overflow: 'hidden',
                  background: '#FAF8F5',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  boxSizing: 'border-box',
                  borderLeft: ['map', 'clicking-node', 'filtered'].includes(phase) ? '1px solid rgba(92, 77, 60, 0.12)' : 'none',
                  position: 'relative'
                }}
              >
                {/* Split Pane Header */}
                <div style={{
                  padding: '8px 10px',
                  fontSize: '8.5px',
                  fontWeight: 800,
                  color: '#5C4D3C',
                  background: '#fdfcf9',
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid rgba(92, 77, 60, 0.08)'
                }}>
                  <span>생각의 생각 지도 (무의식)</span>
                </div>

                {/* Split Pane Graph Content */}
                {['map', 'clicking-node', 'filtered'].includes(phase) && (
                  <motion.div
                    className="split-pane-graph-container"
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <div className="mini-node-graph" style={{ width: '100%', aspectRatio: '200/180', position: 'relative' }}>
                      <svg className="mini-node-lines" viewBox="0 0 200 180" style={{ position: 'absolute', width: '100%', height: '100%', left: 0, top: 0 }}>
                        <line x1="80" y1="50" x2="140" y2="45" stroke="rgba(92, 77, 60, 0.1)" strokeWidth="0.8" strokeDasharray="2 2" />
                        <line x1="80" y1="50" x2="60" y2="105" stroke="rgba(92, 77, 60, 0.1)" strokeWidth="0.8" strokeDasharray="2 2" />
                        <line x1="140" y1="45" x2="135" y2="100" stroke="rgba(92, 77, 60, 0.1)" strokeWidth="0.8" strokeDasharray="2 2" />
                        <line x1="60" y1="105" x2="135" y2="100" stroke="rgba(92, 77, 60, 0.1)" strokeWidth="0.8" strokeDasharray="2 2" />
                      </svg>

                      {/* 업무 (Active Node) */}
                      <div
                        className="graph-node float-slow"
                        style={{
                          top: '28%',
                          left: '40%',
                          transform: 'translate(-50%, -50%)',
                          position: 'absolute',
                          cursor: 'pointer',
                          zIndex: 2,
                          scale: (phase === 'clicking-node' && isPressed) ? 0.92 : 1,
                          transition: 'scale 0.1s ease'
                        }}
                      >
                        <span
                          className="graph-dot clay"
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #c2593f 0%, #a2391f 100%)',
                            border: '1.5px solid #fff',
                            boxShadow: phase === 'filtered'
                              ? '0 0 0 4px rgba(194, 89, 63, 0.22), 0 4px 12px rgba(194, 89, 63, 0.35)'
                              : '0 4px 12px rgba(194, 89, 63, 0.2)'
                          }}
                        />
                        <span className="graph-label" style={{ fontSize: '8px', fontWeight: 800 }}>업무</span>
                        <small style={{ fontSize: '6px' }}>2개</small>
                      </div>

                      {/* 할 일 */}
                      <div
                        className="graph-node float-medium"
                        style={{
                          top: '25%',
                          left: '72%',
                          position: 'absolute',
                          cursor: 'pointer',
                          zIndex: 2,
                          opacity: phase === 'filtered' ? 0.45 : 1,
                          transition: 'opacity 0.4s ease'
                        }}
                      >
                        <span className="graph-dot steel" style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'linear-gradient(135deg, #50616b 0%, #33424b 100%)', border: '1px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} />
                        <span className="graph-label" style={{ fontSize: '8px', fontWeight: 800 }}>할 일</span>
                        <small style={{ fontSize: '6px' }}>5개</small>
                      </div>

                      {/* 아이디어 */}
                      <div
                        className="graph-node float-fast"
                        style={{
                          top: '72%',
                          left: '26%',
                          position: 'absolute',
                          cursor: 'pointer',
                          zIndex: 2,
                          opacity: phase === 'filtered' ? 0.45 : 1,
                          transition: 'opacity 0.4s ease'
                        }}
                      >
                        <span className="graph-dot amber" style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'linear-gradient(135deg, #d8a840 0%, #a47814 100%)', border: '1.2px solid #fff', boxShadow: '0 3px 8px rgba(164,120,20,0.15)' }} />
                        <span className="graph-label" style={{ fontSize: '8px', fontWeight: 800 }}>아이디어</span>
                        <small style={{ fontSize: '6px' }}>7개</small>
                      </div>

                      {/* 일상 */}
                      <div
                        className="graph-node float-medium"
                        style={{
                          top: '68%',
                          left: '68%',
                          position: 'absolute',
                          cursor: 'pointer',
                          zIndex: 2,
                          opacity: phase === 'filtered' ? 0.45 : 1,
                          transition: 'opacity 0.4s ease'
                        }}
                      >
                        <span className="graph-dot amber" style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #e4bb68 0%, #c4952e 100%)', border: '1.2px solid #fff', boxShadow: '0 3px 8px rgba(164,120,20,0.15)' }} />
                        <span className="graph-label" style={{ fontSize: '8px', fontWeight: 800 }}>일상</span>
                        <small style={{ fontSize: '6px' }}>8개</small>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Custom Mouse Cursor */}
          <motion.div
            style={{
              position: 'absolute',
              zIndex: 9999,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            animate={{
              left:
                phase === 'chrono' || phase === 'reset' ? '35%' :
                  phase === 'clicking-map' ? '10%' :
                    phase === 'map' || phase === 'clicking-node' ? '75%' :
                      '80%',
              top:
                phase === 'chrono' || phase === 'reset' ? '75%' :
                  phase === 'clicking-map' ? '14%' :
                    phase === 'map' || phase === 'clicking-node' ? '36%' :
                      '45%',
              scale: isPressed ? 0.82 : 1,
              opacity: (phase === 'chrono' || phase === 'reset' || phase === 'filtered') ? 0 : 1
            }}
            transition={{
              left: {
                duration: phase === 'clicking-map' ? 0.8 : phase === 'map' || phase === 'clicking-node' ? 1.5 : 0.8,
                ease: 'easeInOut'
              },
              top: {
                duration: phase === 'clicking-map' ? 0.8 : phase === 'map' || phase === 'clicking-node' ? 1.5 : 0.8,
                ease: 'easeInOut'
              },
              scale: { duration: 0.1 },
              opacity: { duration: 0.3 }
            }}
          >
            <CursorSvg />
          </motion.div>

        </div>
      </div>
    </div>
  );
}

function StateBGraph() {
  const [phase, setPhase] = useState<'idle' | 'focus' | 'tooltip' | 'clicking' | 'split-open' | 'read' | 'reset'>('idle');
  const [isPressed, setIsPressed] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const runLoop = () => {
      setPhase('idle');
      timer = setTimeout(() => {
        setPhase('focus');
        timer = setTimeout(() => {
          setPhase('tooltip');
          timer = setTimeout(() => {
            setPhase('clicking');
            setIsPressed(true);
            timer = setTimeout(() => {
              setIsPressed(false);
              setPhase('split-open');
              timer = setTimeout(() => {
                setPhase('read');
                timer = setTimeout(() => {
                  setPhase('reset');
                  timer = setTimeout(() => {
                    runLoop();
                  }, 600);
                }, 4500);
              }, 800);
            }, 180);
          }, 1200);
        }, 1200);
      }, 1500);
    };

    runLoop();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (['idle', 'focus'].includes(phase)) {
      setActiveStep(0);
    } else if (['tooltip', 'clicking'].includes(phase)) {
      setActiveStep(1);
    } else {
      setActiveStep(2);
    }
  }, [phase]);

  const handleSentenceClick = () => {
    if (phase === 'idle' || phase === 'focus') {
      setPhase('tooltip');
    }
  };

  const handleTooltipClick = () => {
    if (phase === 'tooltip' || phase === 'clicking') {
      setIsPressed(true);
      setTimeout(() => {
        setIsPressed(false);
        setPhase('split-open');
        setTimeout(() => {
          setPhase('read');
        }, 800);
      }, 150);
    }
  };

  return (
    <div className="demo-backplate" style={{ width: '100%' }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/10' }} className="manual-graph-wrapper">
        <div className="app-window-glass" aria-hidden="true" style={{ position: 'relative', top: 'auto', left: 'auto', transform: 'none', width: '100%', height: '100%', border: 'none', filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.12))' }}>
          {/* App Titlebar */}
          <div className="app-window-titlebar">
            <div className="dots-container">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <span className="window-title">Subnota</span>
          </div>

          {/* App Content Grid */}
          <div className="app-window-body" style={{ display: 'flex', flexDirection: 'row', height: 'calc(100% - 28px)', width: '100%', overflow: 'hidden' }}>
            {/* Sidebar */}
            <div className="app-window-sidebar" style={{ width: '65px', flexShrink: 0, padding: '8px 4px' }}>
              <div className="sidebar-section-title" style={{ fontSize: '8px', marginBottom: '4px' }}>메모</div>
              <div className="sidebar-item active" style={{ padding: '4px', borderRadius: '4px', marginBottom: '2px' }}>
                <strong style={{ fontSize: '8px' }}>회의 질문...</strong>
                <div className="sidebar-item-sub" style={{ fontSize: '7px' }}>
                  <span className="sidebar-date">오후 3:03</span>
                </div>
              </div>
              <div className="sidebar-item" style={{ padding: '4px', borderRadius: '4px', marginBottom: '2px' }}>
                <strong style={{ fontSize: '8px' }}>주말 여행...</strong>
                <div className="sidebar-item-sub" style={{ fontSize: '7px' }}>
                  <span className="sidebar-date">어제</span>
                </div>
              </div>
            </div>

            {/* Editor Workspace */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', background: '#fffdf8' }}>
              {/* Editor Canvas */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px', minWidth: 0, position: 'relative' }}>
                <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div className="editor-date-header" style={{ fontSize: '8px', color: '#9C9283', marginBottom: '6px' }}>2026년 6월 3일 오후 3:03</div>
                  <div style={{ fontSize: '9px', color: '#5C4D3C', lineHeight: 1.5, flex: 1, fontFamily: 'inherit' }}>
                    <div style={{ opacity: 0.8 }}>오늘 회의에서 피드백 받은 내용을 정리해 보았다.</div>
                    <div style={{ opacity: 0.8 }}>이번 신규 디자인 QA 진행 상황을 점검해야 하고,</div>
                    <div style={{ opacity: 0.8 }}>다음 스프린트 일정을 맞춰야 한다.</div>
                    <div style={{ marginTop: '5px', position: 'relative', display: 'inline-block' }}>
                      <span
                        className={`target-sentence ${['focus', 'tooltip', 'clicking'].includes(phase) ? 'focused' : ''} ${['split-open', 'read'].includes(phase) ? 'clicked' : ''}`}
                        onClick={handleSentenceClick}
                        style={{ cursor: 'pointer' }}
                      >
                        질문 리스트를 미리 정리하는 것이 좋겠다.
                      </span>
                      {phase === 'focus' && (
                        <span
                          className="raycast-cursor"
                          style={{
                            height: '10px',
                            width: '1.2px',
                            background: '#2c2520',
                            display: 'inline-block',
                            marginLeft: '1px',
                            verticalAlign: 'middle',
                            animation: 'blink 1s step-end infinite'
                          }}
                        />
                      )}

                      {/* Floating Action Tooltip Button */}
                      {['tooltip', 'clicking'].includes(phase) && (
                        <motion.div
                          className="floating-search-tooltip"
                          style={{ position: 'absolute', left: '50%', top: '-8px', cursor: 'pointer' }}
                          onClick={handleTooltipClick}
                          initial={{ opacity: 0, y: 5, x: '-50%', scale: 0.95 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            x: '-50%',
                            scale: isPressed ? 0.92 : 1
                          }}
                          exit={{ opacity: 0, y: 5, x: '-50%', scale: 0.95 }}
                          transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 15
                          }}
                        >
                          <span>🔍 연관 문장 검색</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Split Pane */}
              <motion.div
                className="app-window-split-pane"
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: ['split-open', 'read'].includes(phase) ? '42%' : '0%',
                  opacity: ['split-open', 'read'].includes(phase) ? 1 : 0
                }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  overflow: 'hidden',
                  background: '#FAF8F5',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  boxSizing: 'border-box',
                  borderLeft: ['split-open', 'read'].includes(phase) ? '1px solid rgba(92, 77, 60, 0.12)' : 'none',
                  position: 'relative'
                }}
              >
                {/* Split Pane Header */}
                <div style={{
                  padding: '8px 10px',
                  fontSize: '8.5px',
                  fontWeight: 800,
                  color: '#5C4D3C',
                  background: '#fdfcf9',
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid rgba(92, 77, 60, 0.08)'
                }}>
                  <span>연관 문장 검색 결과</span>
                </div>

                {/* Split Pane Graph Content */}
                {['split-open', 'read'].includes(phase) && (
                  <motion.div
                    className="split-pane-graph-container"
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                  >
                    <div className="mini-node-graph" style={{ width: '100%', aspectRatio: '200/180', position: 'relative' }}>
                      <svg className="mini-node-lines" viewBox="0 0 200 180" style={{ position: 'absolute', width: '100%', height: '100%', left: 0, top: 0 }}>
                        {/* Concentric Orbits centered at (100, 90) */}
                        <circle cx="100" cy="90" r="30" fill="none" stroke="rgba(196, 142, 36, 0.12)" strokeWidth="0.8" strokeDasharray="2 2" />
                        <circle cx="100" cy="90" r="54" fill="none" stroke="rgba(196, 142, 36, 0.1)" strokeWidth="0.8" strokeDasharray="2 2" />
                        <circle cx="100" cy="90" r="75" fill="none" stroke="rgba(196, 142, 36, 0.08)" strokeWidth="0.8" strokeDasharray="2 2" />

                        {/* Connecting Lines with differentiated styles based on similarity */}
                        {/* Node 1: High Similarity (92%) -> Bold solid line */}
                        <line x1="100" y1="90" x2="115" y2="64" stroke="rgba(164, 120, 20, 0.65)" strokeWidth="1.5" />
                        {/* Node 2: Med-High Similarity (78%) -> Solid line */}
                        <line x1="100" y1="90" x2="153" y2="81" stroke="rgba(164, 120, 20, 0.45)" strokeWidth="1.0" />
                        {/* Node 3: Med Similarity (64%) -> Thinner solid line */}
                        <line x1="100" y1="90" x2="73" y2="137" stroke="rgba(164, 120, 20, 0.35)" strokeWidth="0.8" />
                        {/* Node 4: Med-Low Similarity (55%) -> Dashed line */}
                        <line x1="100" y1="90" x2="30" y2="65" stroke="rgba(164, 120, 20, 0.25)" strokeWidth="0.8" strokeDasharray="2 2" />
                        {/* Node 5: Low Similarity (42%) -> Faint dotted line */}
                        <line x1="100" y1="90" x2="138" y2="155" stroke="rgba(164, 120, 20, 0.15)" strokeWidth="0.6" strokeDasharray="3 3" />
                      </svg>

                      {/* Center Node (Сегодня 회의 질문) - Prominently Scaled Up */}
                      <div className="mini-graph-node" style={{ top: '50%', left: '50%', position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3 }}>
                        <span className="mini-graph-dot active" style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'linear-gradient(135deg, #a47814 0%, #d8a840 100%)', border: '2px solid #fff', boxShadow: '0 0 10px rgba(164,120,20,0.6)', display: 'inline-block' }} />
                        <div className="mini-graph-tooltip" style={{ background: 'rgba(44, 37, 32, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', padding: '2px 4px', display: 'flex', flexDirection: 'column', width: '80px', position: 'absolute', bottom: '22px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                          <strong style={{ fontSize: '7.5px', color: '#fff', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>오늘 회의 질문</strong>
                          <small style={{ fontSize: '6px', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>현재 메모</small>
                        </div>
                      </div>

                      {/* Linked Node 1 (Similarity: 92%, Inner Orbit, Large Size) */}
                      <div className="mini-graph-node float-slow" style={{ top: '35.6%', left: '57.5%', position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                        <span className="mini-graph-dot" style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'linear-gradient(135deg, #d8a840 0%, #a47814 100%)', border: '1.5px solid #fff', boxShadow: '0 1.5px 3px rgba(164,120,20,0.3)' }} />
                        <div className="mini-graph-tooltip" style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(92, 77, 60, 0.15)', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', padding: '2px 4px', display: 'flex', flexDirection: 'column', width: '68px', position: 'absolute', bottom: '18px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                          <strong style={{ fontSize: '7px', color: '#2c2520', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>디자인 가이드라인</strong>
                          <small style={{ fontSize: '5.5px', color: '#9c8e7c', fontWeight: 700 }}>1주 전 (92%)</small>
                        </div>
                      </div>

                      {/* Linked Node 2 (Similarity: 78%, Middle Orbit, Med-Large Size) */}
                      <div className="mini-graph-node float-medium" style={{ top: '45%', left: '76.5%', position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                        <span className="mini-graph-dot" style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'linear-gradient(135deg, #e4bb68 0%, #c4952e 100%)', border: '1.5px solid #fff', boxShadow: '0 1.5px 3px rgba(164,120,20,0.25)' }} />
                        <div className="mini-graph-tooltip" style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(92, 77, 60, 0.15)', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', padding: '2px 4px', display: 'flex', flexDirection: 'column', width: '68px', position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                          <strong style={{ fontSize: '7px', color: '#2c2520', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>지난 피드백 반영</strong>
                          <small style={{ fontSize: '5.5px', color: '#9c8e7c', fontWeight: 700 }}>1달 전 (78%)</small>
                        </div>
                      </div>

                      {/* Linked Node 3 (Similarity: 64%, Middle Orbit, Med Size) */}
                      <div className="mini-graph-node float-fast" style={{ top: '76.1%', left: '36.5%', position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                        <span className="mini-graph-dot" style={{ width: '11px', height: '11px', borderRadius: '50%', background: 'linear-gradient(135deg, #ebd19a 0%, #d0aa53 100%)', border: '1px solid #fff', boxShadow: '0 1px 2px rgba(164,120,20,0.2)' }} />
                        <div className="mini-graph-tooltip" style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(92, 77, 60, 0.15)', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', padding: '2px 4px', display: 'flex', flexDirection: 'column', width: '68px', position: 'absolute', bottom: '15px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                          <strong style={{ fontSize: '7px', color: '#2c2520', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>스프린트 일정</strong>
                          <small style={{ fontSize: '5.5px', color: '#9c8e7c', fontWeight: 700 }}>3주 전 (64%)</small>
                        </div>
                      </div>

                      {/* Linked Node 4 (Similarity: 55%, Outer Orbit, Med-Small Size) */}
                      <div className="mini-graph-node float-medium" style={{ top: '36.1%', left: '15%', position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                        <span className="mini-graph-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'linear-gradient(135deg, #ebd19a 0%, #e0c283 100%)', border: '1px solid #fff', boxShadow: '0 1px 2px rgba(164,120,20,0.15)' }} />
                        <div className="mini-graph-tooltip" style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(92, 77, 60, 0.15)', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', padding: '2px 4px', display: 'flex', flexDirection: 'column', width: '68px', position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                          <strong style={{ fontSize: '7px', color: '#2c2520', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>QA 피드백 기록</strong>
                          <small style={{ fontSize: '5.5px', color: '#9c8e7c', fontWeight: 700 }}>5일 전 (55%)</small>
                        </div>
                      </div>

                      {/* Linked Node 5 (Similarity: 42%, Outer Orbit, Small Size) */}
                      <div className="mini-graph-node float-slow" style={{ top: '86.1%', left: '69%', position: 'absolute', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                        <span className="mini-graph-dot" style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'linear-gradient(135deg, #f4e7cd 0%, #ebd096 100%)', border: '1px solid #fff', boxShadow: '0 1px 2px rgba(164,120,20,0.1)' }} />
                        <div className="mini-graph-tooltip" style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(92, 77, 60, 0.15)', borderRadius: '4px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', padding: '2px 4px', display: 'flex', flexDirection: 'column', width: '68px', position: 'absolute', bottom: '13px', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
                          <strong style={{ fontSize: '7px', color: '#2c2520', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>회식 장소 후보</strong>
                          <small style={{ fontSize: '5.5px', color: '#9c8e7c', fontWeight: 700 }}>2달 전 (42%)</small>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MacosMenuBarProps {
  appName?: string;
  className?: string;
  style?: CSSProperties;
}

function MacosMenuBar({ appName = 'Subnota', className = '', style }: MacosMenuBarProps) {
  return (
    <div className={`macos-menu-bar ${className}`} style={style} aria-hidden="true">
      <div className="macos-menu-bar-left">
        <span className="macos-menu-bar-item apple-logo">
          <svg viewBox="0 0 170 170" width="12" height="12" fill="currentColor" style={{ display: 'block' }}>
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.37.13-9.13-1.9-14.28-6.1-3.48-2.82-7.45-7.61-11.9-14.37C17.2 114.24 8.5 89.59 8.5 66.27c0-15.66 4.1-28.52 12.3-38.56 8.21-10.05 18.2-15.16 30-15.34 5.92 0 11.98 1.62 18.2 4.85 6.22 3.22 10.68 4.84 13.39 4.84 2.45 0 6.9-1.68 13.33-5.02 6.43-3.34 12.37-4.96 17.8-4.85 18.42.36 32.22 7.02 41.39 20 8.04 11.25 12.06 24 12.06 38.25 0 9.17-2 18-6.01 26.51M119.22 8.24c0 7.72-2.77 15.66-8.31 21.83-5.54 6.17-12 10.05-19.38 11.66-.24-1.91-.36-3.82-.36-5.74 0-7.39 2.9-15.26 8.7-21.36 5.8-6.11 12.56-9.87 20.25-11.29.24 1.9.36 3.82.36 5.74" />
          </svg>
        </span>
        <strong className="macos-menu-bar-item app-name">{appName}</strong>
        <span className="macos-menu-bar-item hide-mobile">File</span>
        <span className="macos-menu-bar-item hide-mobile">Edit</span>
        <span className="macos-menu-bar-item hide-mobile">View</span>
        <span className="macos-menu-bar-item hide-tablet">Go</span>
        <span className="macos-menu-bar-item hide-tablet">Window</span>
        <span className="macos-menu-bar-item hide-tablet">Help</span>
      </div>
      <div className="macos-menu-bar-right">
        <span className="macos-menu-bar-item menu-icon">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </span>
        <span className="macos-menu-bar-item menu-icon github-badge">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ marginRight: '3px' }}>
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span className="github-count">49</span>
        </span>
        <span className="macos-menu-bar-item hide-mobile lunch-status">
          <span className="lunch-dot" />
          Lunch · 37m left
        </span>
        <span className="macos-menu-bar-item menu-icon">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.5 16.1a5.5 5.5 0 0 1 7 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
          </svg>
        </span>
        <span className="macos-menu-bar-item menu-icon" style={{ display: 'flex', alignItems: 'center' }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7.5" width="15" height="9" rx="1.5" />
            <line x1="20" y1="11" x2="20" y2="13" strokeWidth="2" />
            <rect x="4" y="9.5" width="11" height="5" rx="0.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="macos-menu-bar-item macos-time">6월 22일 (월) 오전 9:41</span>
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
            <div className="macbook-content">
              <MacosMenuBar appName="Subnota" />
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
                  <strong>정선생님 꽃 준비</strong>
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
              <div className="iphone-status-right" style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                {/* Cellular signal strength (Apple Figma Style) */}
                <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" style={{ opacity: 0.9 }}>
                  <rect x="0" y="8" width="2.5" height="3" rx="0.5" />
                  <rect x="4.5" y="6" width="2.5" height="5" rx="0.5" />
                  <rect x="9" y="3.5" width="2.5" height="7.5" rx="0.5" />
                  <rect x="13.5" y="0" width="2.5" height="11" rx="0.5" />
                </svg>
                {/* Wifi icon (Apple Figma Style) */}
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
  );
}

/* =============================================
   DESKTOP PLATFORM-SPECIFIC COMPONENTS
   ============================================= */

interface MacScreenWrapperProps {
  children: React.ReactNode;
  wallpaper?: string;
}

function MacScreenWrapper({ children, wallpaper }: MacScreenWrapperProps) {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '720px', margin: '0 auto', filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.15))' }}>
      {/* Screen Bezel */}
      <div style={{
        background: '#08080a',
        border: '3px solid #5a5a5c',
        borderRadius: '20px',
        margin: '0 auto',
        overflow: 'hidden',
        padding: '10px',
        position: 'relative',
        width: '100%'
      }}>
        {/* Notch and Cam */}
        <div style={{
          alignItems: 'center',
          background: '#08080a',
          borderRadius: '0 0 8px 8px',
          display: 'flex',
          height: '14px',
          justifyContent: 'center',
          left: '50%',
          position: 'absolute',
          top: 0,
          transform: 'translateX(-50%)',
          width: '84px',
          zIndex: 15
        }}>
          <div style={{
            background: '#0f0f12',
            border: '1px solid #1a1a20',
            borderRadius: '50%',
            boxShadow: 'inset 0 0.5px 0.5px rgba(255, 255, 255, 0.2)',
            height: '4px',
            width: '4px'
          }} />
        </div>

        {/* Screen Content: 1440/900 aspect ratio */}
        <div style={{
          aspectRatio: '1440/900',
          background: wallpaper || 'linear-gradient(135deg, #e65c87 0%, #9a51ce 50%, #476bec 100%)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          width: '100%'
        }}>
          {/* macOS Top Menu Bar */}
          <div style={{
            height: '24px',
            background: 'rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 12px',
            fontSize: '11px',
            color: 'rgba(0, 0, 0, 0.85)',
            fontWeight: 500,
            fontFamily: '"SF Pro", "SF Pro KR", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: '-0.1px',
            zIndex: 10
          }}>
            {/* Left Menus */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <strong style={{ fontWeight: 700, color: 'rgba(0, 0, 0, 0.9)' }}>Subnota</strong>
              <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>File</span>
              <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>Edit</span>
              <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>View</span>
              <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>Window</span>
              <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>Help</span>
            </div>

            {/* Right Icons */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.5 16.1a5.5 5.5 0 0 1 7 0" />
                <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
              </svg>
              <svg width="18" height="9" viewBox="0 0 22 11" fill="currentColor" style={{ opacity: 0.85 }}>
                <rect x="0.5" y="0.5" width="18" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <rect x="2.5" y="2.5" width="11" height="6" rx="1" />
                <path d="M20 3.5C20.5 3.5 20.8 3.8 20.8 4.3V6.7C20.8 7.2 20.5 7.5 20 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: '10px', fontWeight: 500, opacity: 0.85 }}>오후 7:30</span>
            </div>
          </div>

          {/* Children Content */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopMiniPreview() {
  const [typedText, setTypedText] = useState('');
  const fullNote = '회의 질문 리스트 보강해야 함';

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const runLoop = () => {
      setTypedText('');
      let index = 0;
      const type = () => {
        if (index < fullNote.length) {
          setTypedText(fullNote.slice(0, index + 1));
          index++;
          timer = setTimeout(type, 120 + Math.random() * 60);
        } else {
          // Wait 4 seconds, then restart
          timer = setTimeout(runLoop, 4000);
        }
      };
      timer = setTimeout(type, 1000);
    };
    runLoop();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="demo-backplate" style={{ width: '100%' }}>
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1440/900',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #d946ef 0%, #a855f7 50%, #6366f1 100%)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Zoomed-in macOS Top Bezel (Black bar at top) */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '14px',
          background: '#08080a',
          zIndex: 25
        }} />

        {/* Zoomed-in macOS Right Bezel (Black bar on right) */}
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '14px',
          background: '#08080a',
          zIndex: 25,
          borderTopLeftRadius: '4px'
        }} />

        {/* Zoomed-in Notch (visible on the left side of the top edge) */}
        <div style={{
          position: 'absolute',
          left: '12%',
          top: '14px',
          width: '110px',
          height: '12px',
          background: '#08080a',
          borderRadius: '0 0 8px 8px',
          zIndex: 25
        }}>
          {/* Camera Lens */}
          <div style={{
            position: 'absolute',
            left: '30%',
            top: '4px',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#0f172a',
            border: '1px solid #1e293b'
          }} />
        </div>

        {/* Zoomed-in macOS Top Menu Bar */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: '14px',
          top: '14px',
          height: '32px',
          background: 'rgba(217, 70, 239, 0.45)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: '13px',
          color: '#1f1d1a',
          fontWeight: 600,
          fontFamily: '"SF Pro", "SF Pro KR", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          zIndex: 20
        }}>
          {/* Left Menus (Cropped: only Help ends/lp is visible) */}
          <div style={{ display: 'flex', alignItems: 'center', opacity: 0.9 }}>
            <span>lp</span>
          </div>

          {/* Right Icons */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', opacity: 0.9 }}>
            {/* Wifi Icon */}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.5 16.1a5.5 5.5 0 0 1 7 0" />
              <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
            </svg>
            {/* Battery Icon */}
            <svg width="20" height="10" viewBox="0 0 22 11" fill="currentColor">
              <rect x="0.5" y="0.5" width="18" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <rect x="2.5" y="2.5" width="11" height="6" rx="1" />
              <path d="M20 3.5C20.5 3.5 20.8 3.8 20.8 4.3V6.7C20.8 7.2 20.5 7.5 20 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: '12px', fontWeight: 600 }}>오후 7:30</span>
          </div>
        </div>

        {/* Background browser window (zoomed in, overflowing left/bottom) */}
        <div style={{
          position: 'absolute',
          left: '-20%',
          top: '28%',
          width: '75%',
          height: '75%',
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '14px',
          border: '1.5px solid rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 15px 35px rgba(0,0,0,0.15)',
          opacity: 0.65
        }}>
          {/* Browser Address bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '6px', width: '220px', height: '22px', display: 'flex', alignItems: 'center', paddingLeft: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontFamily: 'sans-serif' }}>
              le.com
            </div>
          </div>
          {/* Mock lines of content in background browser */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <div style={{ height: '14px', width: '80%', background: 'rgba(255,255,255,0.18)', borderRadius: '4px' }} />
            <div style={{ height: '14px', width: '90%', background: 'rgba(255,255,255,0.18)', borderRadius: '4px' }} />
            <div style={{ height: '14px', width: '50%', background: 'rgba(255,255,255,0.18)', borderRadius: '4px' }} />
          </div>
        </div>

        {/* Floating Mini Subnota Window */}
        <div style={{
          position: 'absolute',
          left: '12%',
          top: '38%',
          width: '68%',
          background: 'rgba(255, 253, 248, 0.95)',
          borderRadius: '20px',
          border: '1px solid rgba(196, 142, 36, 0.2)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(196, 142, 36, 0.05)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          fontFamily: '"SF Pro", "SF Pro KR", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          zIndex: 10
        }}>
          {/* Mini Window Title Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(196, 142, 36, 0.1)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6b8f5b' }} />
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--amber)', letterSpacing: '-0.1px' }}>Mini Subnota</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Keep on Top</span>
          </div>

          {/* Quick Note Editor Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>방금 떠오른 생각</div>
            <div style={{ fontSize: '20px', color: '#1f1d1a', lineHeight: 1.5, fontWeight: 700, letterSpacing: '-0.3px' }}>
              {typedText}
              <span className="raycast-cursor" style={{ background: 'var(--amber)', width: '2px', height: '22px', marginLeft: '2px', display: 'inline-block', verticalAlign: 'middle' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopSplitPreview() {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      aspectRatio: '1440/900',
      borderRadius: '16px',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', // Pastel orange gradient
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '5% 6%',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
      border: '1px solid rgba(255,255,255,0.2)'
    }}>
      {/* App Window */}
      <div className="app-window-glass" style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        top: 'auto',
        left: 'auto',
        transform: 'none',
        border: '1px solid rgba(196, 142, 36, 0.15)',
        boxShadow: '0 15px 35px rgba(0, 0, 0, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#ffffff'
      }}>
        {/* App Titlebar */}
        <div className="app-window-titlebar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '36px', padding: '0 12px', background: '#faf8f4', borderBottom: '1px solid rgba(196, 142, 36, 0.08)' }}>
          <div className="dots-container" style={{ display: 'flex', gap: '6px' }}>
            <span className="dot red" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff5f56' }} />
            <span className="dot yellow" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffbd2e' }} />
            <span className="dot green" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27c93f' }} />
          </div>
          <span className="window-title" style={{ fontSize: '12px', fontWeight: 700, color: '#1f1d1a', letterSpacing: '-0.1px' }}>Subnota</span>
          <div style={{ width: '40px' }} />
        </div>

        {/* App Body containing Sidebar and Note Editor */}
        <div className="app-window-body" style={{ display: 'flex', flexDirection: 'row', height: 'calc(100% - 36px)', width: '100%', overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{
            width: '20%',
            height: '100%',
            padding: '20px 12px',
            background: '#faf7f2',
            borderRight: '1px solid rgba(196, 142, 36, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ fontSize: '11px', color: '#c48e24', fontWeight: 800, paddingLeft: '8px' }}>메모</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Selected note */}
              <div style={{
                background: 'rgba(196, 142, 36, 0.08)',
                borderRadius: '6px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#1f1d1a' }}>회의 질문...</div>
                <div style={{ fontSize: '9px', color: '#8c8273', fontWeight: 500 }}>오후 3:03</div>
              </div>
              {/* Second note */}
              <div style={{
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#8c8273' }}>주말 여행...</div>
                <div style={{ fontSize: '9px', color: '#a19789' }}>어제</div>
              </div>
            </div>
          </div>

          {/* Middle Editor */}
          <div style={{
            width: '45%',
            height: '100%',
            padding: '24px 28px',
            background: '#fffdfa',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            borderRight: '1px solid rgba(196, 142, 36, 0.08)'
          }}>
            <div style={{ fontSize: '10px', color: '#a19789', textAlign: 'center', fontWeight: 600 }}>2026년 6월 3일 오후 3:03</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: '#4f493f', lineHeight: 1.7, fontWeight: 500, fontFamily: 'inherit' }}>
              <div>오늘 회의에서 피드백 받은 내용을 정리해 보았다.</div>
              <div>이번 신규 디자인 QA 진행 상황을 점검해야 하고,</div>
              <div>다음 스프린트 일정을 맞춰야 한다.</div>
              <div style={{ marginTop: '4px' }}>
                <span style={{ background: '#eee5d6', padding: '3px 6px', borderRadius: '4px', color: '#1f1d1a', fontWeight: 600 }}>
                  질문 리스트를 미리 정리하는 것이 좋겠다.
                </span>
                <span className="raycast-cursor" style={{ background: '#c48e24', width: '2px', height: '14px', marginLeft: '2px', display: 'inline-block', verticalAlign: 'middle' }} />
              </div>
            </div>
          </div>

          {/* Right Editor */}
          <div style={{
            flex: 1,
            height: '100%',
            padding: '24px 28px',
            background: '#fffdfa',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <div style={{ fontSize: '10px', color: '#a19789', textAlign: 'center', fontWeight: 600 }}>2026년 5월 20일 오후 2:15</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontFamily: 'inherit' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#1f1d1a', letterSpacing: '-0.2px' }}>회의 질문 리스트</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: '#4f493f', lineHeight: 1.6, fontWeight: 500 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '4px', height: '4px', background: '#c48e24', borderRadius: '1px', flexShrink: 0 }} />
                  <span>지난주 피드백 반영 사항 확인</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '4px', height: '4px', background: '#c48e24', borderRadius: '1px', flexShrink: 0 }} />
                  <span>신규 디자인 QA 진행 상황</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '4px', height: '4px', background: '#c48e24', borderRadius: '1px', flexShrink: 0 }} />
                  <span>다음 스프린트 일정 조율</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AppleKeycapProps {
  symbol?: React.ReactNode;
  label: string;
  width?: string;
  height?: string;
}

function AppleKeycap({ symbol, label, width = '54px', height = '36px' }: AppleKeycapProps) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '5px',
      minWidth: width,
      height: height,
      background: '#ffffff',
      border: '1px solid rgba(196, 142, 36, 0.2)',
      borderBottom: '3.5px solid rgba(196, 142, 36, 0.35)',
      borderRadius: '8px',
      padding: '0 8px',
      boxShadow: '0 2px 4px rgba(196, 142, 36, 0.04)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      userSelect: 'none',
      flexShrink: 0
    }}>
      {symbol && (
        <span style={{ fontSize: '13px', color: '#1f1d1a', display: 'flex', alignItems: 'center' }}>
          {symbol}
        </span>
      )}
      {label && (
        <span style={{ fontSize: '9px', fontWeight: 700, color: '#8c8273', textTransform: 'lowercase' }}>
          {label}
        </span>
      )}
    </div>
  );
}
