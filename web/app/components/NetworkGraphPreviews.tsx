'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CursorSvg = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,0.3))' }}>
    <path d="M4 4L11.5 20L14.5 14L20.5 11L4 4Z" fill="#2C2520" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round" />
  </svg>
);

export function StateAGraph() {
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

export function StateBGraph() {
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
