'use client';

/* 페이지 층 공통 조각 — 헤더, 다운로드 줄, 푸터. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  AppWindow,
  CalendarDays,
  Columns2,
  NotebookText,
  SubnotaMark,
} from '../subnota-ui/icons';

export const CHAPTERS = [
  {
    Icon: NotebookText,
    blurb: '지금 쓰는 문장과 관련된 과거 문장',
    anchor: '/#connected-memory',
    href: '/features/connected-memory',
    id: 'connected-memory',
    tone: 'blue',
    tab: '관련 기억',
    title: '기록이 연결되고 다시 나타납니다',
  },
  {
    Icon: CalendarDays,
    blurb: '문장 속 날짜가 캘린더 일정으로',
    anchor: '/#memo-to-calendar',
    href: '/features/memo-to-calendar',
    id: 'memo-to-calendar',
    tone: 'green',
    tab: '메모 → 일정',
    title: '메모가 바로 일정으로 이어집니다',
  },
  {
    Icon: AppWindow,
    blurb: '저장한 링크가 필요할 때 다시',
    anchor: '/#reuse-inbox',
    href: '/features/reuse-inbox',
    id: 'reuse-inbox',
    tone: 'amber',
    tab: '수집과 재사용',
    title: '모아둔 정보가 다시 쓰이게 됩니다',
  },
  {
    Icon: Columns2,
    blurb: '빠른 기록과 나란히 보기',
    anchor: '/#productivity',
    href: '/features/productivity',
    id: 'productivity',
    tone: 'clay',
    tab: '작업 흐름',
    title: '흐름을 끊지 않고 더 많이 합니다',
  },
] as const;

export function Brand() {
  return (
    <Link aria-label="Subnota 홈" className="brand" href="/">
      <SubnotaMark size={26} />
      <span>Subnota</span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setScrolled(window.scrollY > 8);
    sync();
    window.addEventListener('scroll', sync, { passive: true });
    return () => window.removeEventListener('scroll', sync);
  }, []);

  /* 메뉴 바깥을 누르거나 Esc 로 닫는다. 마우스가 벗어나는 것만으로 닫으면
     키보드로 연 사람이 닫을 방법이 없다. */
  useEffect(() => {
    if (!featuresOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setFeaturesOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFeaturesOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [featuresOpen]);

  return (
    <header className={scrolled ? 'site-header scrolled' : 'site-header'}>
      <Brand />
      <nav aria-label="주요 메뉴" className="nav-links">
        {/* hover 로 열고 닫는다. 트리거와 메뉴 사이 틈을 투명한 다리로 메워야
            아래로 내리는 도중에 닫히지 않는다 — 예전 랜딩이 쓰던 방식이다. */}
        <div className="nav-menu" ref={menuRef}>
          <button
            aria-expanded={featuresOpen}
            aria-haspopup="true"
            className="nav-menu-trigger"
            onClick={() => setFeaturesOpen((open) => !open)}
            type="button"
          >
            Features
          </button>
          <div
            className={
              featuresOpen ? 'nav-menu-dropdown forced' : 'nav-menu-dropdown'
            }
          >
            <p className="nav-menu-heading">Features</p>
            {CHAPTERS.map(({ Icon, ...chapter }) => (
              <Link
                className="nav-menu-item"
                href={chapter.anchor}
                key={chapter.id}
                onClick={() => setFeaturesOpen(false)}
              >
                <span className={`nav-menu-icon tone-${chapter.tone}`}>
                  <Icon size={17} />
                </span>
                <span>
                  <strong>{chapter.tab}</strong>
                  <span>{chapter.blurb}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
        <Link href="/#about">About</Link>
      </nav>
      <Link className="header-cta" href="/#download">
        무료로 시작하기 <span aria-hidden="true">→</span>
      </Link>
    </header>
  );
}

const MAC_URL = process.env.NEXT_PUBLIC_DOWNLOAD_MAC_URL;
const WINDOWS_URL = process.env.NEXT_PUBLIC_DOWNLOAD_WIN_URL;

const AppleGlyph = () => (
  <svg aria-hidden="true" fill="currentColor" height="19" viewBox="0 0 384 512" width="19">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

const WindowsGlyph = () => (
  <svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 448 512" width="18">
    <path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 512V268.4H203.8v177.9zm0-380.6v180.1H448V0L203.8 65.7z" />
  </svg>
);

function DownloadButton({
  glyph,
  href,
  platform,
}: {
  glyph: React.ReactNode;
  href?: string;
  platform: string;
}) {
  const copy = (
    <>
      {glyph}
      <span className="download-btn-copy">
        <span>{href ? 'Download for' : '출시 예정'}</span>
        <strong>{platform}</strong>
      </span>
    </>
  );

  /* 링크가 준비되기 전에는 눌리는 것처럼 보이게 두지 않는다 — 404로 보내는
     버튼은 없는 버튼보다 나쁘다. */
  return href ? (
    <a className="download-btn" href={href}>
      {copy}
    </a>
  ) : (
    <span aria-disabled="true" className="download-btn" role="link">
      {copy}
    </span>
  );
}

export function DownloadRow({ note = true }: { note?: boolean }) {
  return (
    <>
      <div className="hero-actions">
        <DownloadButton glyph={<AppleGlyph />} href={MAC_URL} platform="macOS" />
        <DownloadButton
          glyph={<WindowsGlyph />}
          href={WINDOWS_URL}
          platform="Windows"
        />
      </div>
      {note && (
        <p className="hero-note">
          macOS·Windows 앱을 준비하고 있습니다. iOS 앱은 그다음입니다.
        </p>
      )}
    </>
  );
}

export function SiteFooter() {
  const pathname = usePathname();

  return (
    <footer className="site-footer">
      <div className="shell footer-content">
        <div>
          <Brand />
          <p className="footer-slogan">정리하지 말고 작성만 하세요.</p>
          <p className="footer-copyright">
            © {new Date().getFullYear()} Subnota. All rights reserved.
          </p>
        </div>
        <div className="footer-info-side">
          <div>
            <p className="footer-col-title">기능</p>
            <div className="footer-links">
              {CHAPTERS.map((chapter) => (
                <Link
                  aria-current={pathname === chapter.href ? 'page' : undefined}
                  href={chapter.href}
                  key={chapter.id}
                >
                  {chapter.tab}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="footer-col-title">문서</p>
            <div className="footer-links">
              <Link href="/privacy">개인정보 처리방침</Link>
              <Link href="/terms">서비스 이용약관</Link>
              <Link href="/account-deletion">계정 삭제</Link>
            </div>
          </div>
          <div>
            <p className="footer-col-title">문의</p>
            <div className="footer-links">
              <a className="footer-email" href="mailto:contact@subnota.com">
                contact@subnota.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
