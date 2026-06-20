'use client';

import { CSSProperties } from 'react';
import { Layers } from 'lucide-react';

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

export default function MacroMockup() {
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
