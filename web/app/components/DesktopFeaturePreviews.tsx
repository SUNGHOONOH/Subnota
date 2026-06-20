'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MacScreenWrapperProps {
  children: React.ReactNode;
  wallpaper?: string;
}

export function MacScreenWrapper({ children, wallpaper }: MacScreenWrapperProps) {
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

export function DesktopInboxPreview() {
  const [phase, setPhase] = useState<'idle' | 'subnota_popup' | 'webpage_sucking' | 'subnota_done' | 'subnota_closing'>('idle');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const runLoop = () => {
      setPhase('idle');
      timer = setTimeout(() => {
        setPhase('subnota_popup');
        timer = setTimeout(() => {
          setPhase('webpage_sucking');
          timer = setTimeout(() => {
            setPhase('subnota_done');
            timer = setTimeout(() => {
              setPhase('subnota_closing');
              timer = setTimeout(runLoop, 700);
            }, 1600);
          }, 1400);
        }, 1200);
      }, 1500);
    };

    runLoop();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="demo-backplate" style={{ width: '100%', position: 'relative' }}>
      <style>{`
        @keyframes spin-collect {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Hand-drawn Arrow pointing to Subnota menu bar item from outside */}
      <div style={{
        position: 'absolute',
        right: '7.5%',
        top: '-20px', // placed on the white background above the mockup
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none'
      }}>
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
        <svg width="45" height="25" viewBox="0 0 45 25" fill="none" style={{ transform: 'scaleY(-1)' }}>
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

      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1440/900',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #e65c87 0%, #9a51ce 50%, #476bec 100%)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(255,255,255,0.1)',
        fontFamily: '"SF Pro", "SF Pro KR", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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

        {/* Zoomed-in Notch (visible on the left side of the top edge) - Added to match DesktopMiniPreview zoom */}
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
          background: 'rgba(230, 92, 135, 0.45)',
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
          zIndex: 20
        }}>
          {/* Left Menus (Cropped) */}
          <div style={{ display: 'flex', alignItems: 'center', opacity: 0.9 }}>
            <span>lp</span>
          </div>

          {/* Right Icons */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', opacity: 0.9 }}>
            {/* Subnota Menu Bar Icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '22px',
              height: '22px',
              borderRadius: '6px',
              background: phase !== 'idle' && phase !== 'subnota_closing' ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
              color: phase !== 'idle' && phase !== 'subnota_closing' ? '#ffffff' : '#1f1d1a',
              transition: 'background 0.2s ease, color 0.2s ease',
              marginRight: '4px'
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: phase !== 'idle' && phase !== 'subnota_closing' ? '#ffffff' : 'var(--amber)' }}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>

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
            <span style={{ fontSize: '12px', fontWeight: 600 }}>오후 9:41</span>
          </div>
        </div>

        {/* Zoomed-in Browser Window (Floating on desktop) */}
        <AnimatePresence>
          {(phase === 'idle' || phase === 'subnota_popup' || phase === 'webpage_sucking') && (
            <motion.div
              className="safari-window"
              initial={{ opacity: 0, scale: 0.9, y: '5%' }}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.97,
                y: '2%'
              }}
              transition={{
                type: 'spring',
                damping: 24,
                stiffness: phase === 'subnota_popup' ? 90 : 120,
                mass: phase === 'subnota_popup' ? 1.0 : 0.8
              }}
              style={{
                position: 'absolute',
                left: '-15%',
                top: '15%',
                width: '85%',
                height: '80%',
                background: '#ffffff',
                borderRadius: '12px',
                border: '1.5px solid rgba(0, 0, 0, 0.08)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transformOrigin: '90% 10%',
                zIndex: 10
              }}
            >
              {/* Browser Header */}
              <div className="safari-header" style={{
                height: '32px',
                background: '#ebebeb',
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                position: 'relative'
              }}>
                <div className="dots" style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ee6a5f' }} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f4bf4f' }} />
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#61c554' }} />
                </div>
                {/* Address Bar */}
                <div className="address-bar" style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  borderRadius: '6px',
                  width: '240px',
                  height: '22px',
                  fontSize: '12px',
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

              {/* Webpage Content */}
              <div style={{
                flex: 1,
                padding: '24px',
                background: '#fcfcfc',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--amber)' }}>S Subnota</div>
                  <strong style={{ fontSize: '20px', color: '#1f1d1a', textAlign: 'center', lineHeight: 1.3 }}>적으면,<br />알아서 정리됩니다.</strong>
                  <span style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>정리는 Subnota가 알아서 처리하니까요.</span>
                </div>
                {/* Visual Content representation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <div style={{ height: '32px', background: 'rgba(107, 143, 91, 0.08)', borderRadius: '6px', border: '1px solid rgba(107, 143, 91, 0.15)', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '11px', color: '#6b8f5b', fontWeight: 600 }}>
                    ✓ 유튜브 핵심 요약 완료
                  </div>
                  <div style={{ height: '32px', background: 'rgba(196, 142, 36, 0.08)', borderRadius: '6px', border: '1px solid rgba(196, 142, 36, 0.15)', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: '11px', color: 'var(--amber)', fontWeight: 600 }}>
                    ⚡ 주요 키워드 추출 완료
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Flying fragment: summary pulled from the browser, up into the menu bar icon, then down into the inbox */}
        <AnimatePresence>
          {phase === 'webpage_sucking' && (
            <motion.div
              initial={{ opacity: 0, left: '24%', top: '58%', scale: 0.7 }}
              animate={{
                opacity: [0, 1, 1, 1],
                left: ['24%', '52%', '75%', '64%'],
                top: ['58%', '30%', '4%', '44%'],
                scale: [0.7, 0.82, 0.3, 1],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.3, times: [0, 0.4, 0.62, 1], ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                zIndex: 16,
                transformOrigin: 'center',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px solid rgba(196, 142, 36, 0.25)',
                boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
                padding: '7px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <span style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                background: 'rgba(107, 143, 91, 0.16)',
                color: '#6b8f5b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 900,
                flexShrink: 0
              }}>✓</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#1f1d1a' }}>유튜브 요약</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Subnota Inbox Window (popping from the menu bar status icon) */}
        <AnimatePresence>
          {(phase !== 'idle' && phase !== 'subnota_closing') && (
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.05,
                x: '30%',
                y: '-60%'
              }}
              animate={{
                opacity: 1,
                scale: 1,
                x: 0,
                y: 0
              }}
              exit={{
                opacity: 0,
                scale: 0.05,
                x: '30%',
                y: '-60%'
              }}
              transition={{
                type: 'spring',
                damping: 22,
                stiffness: 150,
                mass: 0.8
              }}
              style={{
                position: 'absolute',
                right: '5%',
                top: '12%',
                width: '45%',
                height: '75%',
                background: 'rgba(255, 253, 248, 0.98)',
                borderRadius: '16px',
                border: '1.5px solid rgba(196, 142, 36, 0.25)',
                boxShadow: '0 30px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(196, 142, 36, 0.05)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                zIndex: 15,
                transformOrigin: '90% 0%'
              }}
            >
              {/* Window Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(196, 142, 36, 0.1)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#6b8f5b' }} />
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--amber)' }}>Subnota Inbox</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>수집함</span>
              </div>

              {/* Status and Collected Content */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
                {/* Sucking Status / Loading Indicator */}
                {phase === 'subnota_popup' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: 'var(--muted)' }}>
                    <div className="collecting-spinner" style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: '2.5px solid rgba(196, 142, 36, 0.1)',
                      borderTopColor: 'var(--amber)',
                      animation: 'spin-collect 1s linear infinite'
                    }} />
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>수집함 여는 중...</span>
                  </div>
                )}

                {phase === 'webpage_sucking' && (
                  <motion.div
                    initial={{ opacity: 0.45 }}
                    animate={{ opacity: [0.45, 0.85, 0.45] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '18px 14px',
                      border: '1.5px dashed rgba(196, 142, 36, 0.45)',
                      borderRadius: '10px',
                      color: 'var(--amber)'
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span style={{ fontSize: '11px', fontWeight: 700 }}>수집 중...</span>
                  </motion.div>
                )}

                {phase === 'subnota_done' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>수집 완료된 메모</div>
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '10px',
                      border: '1px solid rgba(196, 142, 36, 0.15)',
                      padding: '16px 14px',
                      boxShadow: '0 4px 12px rgba(196, 142, 36, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#1f1d1a' }}>subnota.com</div>
                      <div style={{ fontSize: '10px', color: '#6b8f5b', fontWeight: 600 }}>✓ 유튜브 요약 및 주요 키워드 수집됨</div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function DesktopMiniPreview() {
  const [phase, setPhase] = useState<'idle' | 'opening' | 'typing' | 'done' | 'closing'>('idle');
  const [typedText, setTypedText] = useState('');
  const fullNote = '회의 질문 리스트 보강해야 함';

  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    const runLoop = () => {
      setPhase('idle');
      setTypedText('');
      
      // 1. Idle for 1500ms
      timer = setTimeout(() => {
        setPhase('opening');
        
        // 2. Open animation for 600ms
        timer = setTimeout(() => {
          setPhase('typing');
          let index = 0;
          
          const type = () => {
            if (index < fullNote.length) {
              setTypedText(fullNote.slice(0, index + 1));
              index++;
              timer = setTimeout(type, 100 + Math.random() * 50);
            } else {
              setPhase('done');
              
              // 3. Stays open for 3500ms
              timer = setTimeout(() => {
                setPhase('closing');
                
                // 4. Closing animation for 600ms, then restart
                timer = setTimeout(runLoop, 600);
              }, 3500);
            }
          };
          type();
        }, 600);
      }, 1500);
    };

    runLoop();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="demo-backplate" style={{ width: '100%', position: 'relative' }}>
      {/* Hand-drawn Arrow pointing to Subnota menu bar item from outside */}
      <div style={{
        position: 'absolute',
        right: '7.5%',
        top: '-20px', // placed on the white background above the mockup
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'none'
      }}>
        <span style={{
          fontFamily: "'Nanum Pen Script', cursive",
          fontSize: '20px',
          color: 'var(--amber)',
          transform: 'rotate(-2deg)',
          whiteSpace: 'nowrap',
          marginRight: '4px',
          marginTop: '4px'
        }}>
          Subnota는 여기서 항상 대기하고 있어요!
        </span>
        <svg width="45" height="25" viewBox="0 0 45 25" fill="none" style={{ transform: 'scaleY(-1)' }}>
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
            {/* Subnota Menu Bar Icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '22px',
              height: '22px',
              borderRadius: '6px',
              background: phase !== 'idle' && phase !== 'closing' ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
              color: phase !== 'idle' && phase !== 'closing' ? '#ffffff' : '#1f1d1a',
              transition: 'all 0.2s ease',
              marginRight: '4px'
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: phase !== 'idle' && phase !== 'closing' ? '#ffffff' : 'var(--amber)' }}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>

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
        <AnimatePresence>
          {(phase !== 'idle' && phase !== 'closing') && (
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.05,
                x: '12%',
                y: '-120%'
              }}
              animate={{
                opacity: 1,
                scale: 1,
                x: 0,
                y: 0
              }}
              exit={{
                opacity: 0,
                scale: 0.05,
                x: '12%',
                y: '-120%'
              }}
              transition={{
                type: 'spring',
                damping: 24,
                stiffness: 180,
                mass: 0.8
              }}
              style={{
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
                zIndex: 10,
                transformOrigin: '90% 0%'
              }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function DesktopSplitPreview() {
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

export function AppleKeycap({ symbol, label, width = '54px', height = '36px' }: AppleKeycapProps) {
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
