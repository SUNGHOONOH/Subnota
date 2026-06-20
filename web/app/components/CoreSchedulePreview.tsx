'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays } from 'lucide-react';

export default function CoreSchedulePreview() {
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
