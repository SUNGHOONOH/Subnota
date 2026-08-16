import Link from 'next/link';
import type { ReactNode } from 'react';

interface LegalDocumentProps {
  children: ReactNode;
  effectiveDate: string;
  title: string;
}

export default function LegalDocument({
  children,
  effectiveDate,
  title,
}: LegalDocumentProps) {
  return (
    <main className="legal-page">
      <div className="legal-page-shell">
        <header className="legal-page-header">
          <Link className="legal-brand" href="/">
            <span aria-hidden="true" className="legal-brand-mark">✳</span>
            <span>Subnota</span>
          </Link>
          <nav aria-label="법적 문서">
            <Link href="/privacy">개인정보 처리방침</Link>
            <Link href="/terms">서비스 이용약관</Link>
            <Link href="/account-deletion">계정 삭제</Link>
          </nav>
        </header>

        <article className="legal-article">
          <p className="legal-eyebrow">SUBNOTA</p>
          <h1>{title}</h1>
          <p className="legal-effective-date">시행일: {effectiveDate}</p>
          <div className="legal-content">{children}</div>
        </article>

        <footer className="legal-page-footer">
          <Link href="/">Subnota 홈</Link>
          <a href="mailto:contact@subnota.com">contact@subnota.com</a>
        </footer>
      </div>
    </main>
  );
}
