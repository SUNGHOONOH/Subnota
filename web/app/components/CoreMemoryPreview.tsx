'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers } from 'lucide-react';

export default function CoreMemoryPreview() {
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
      {/* Glassmorphic App Window Mockup */}
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
