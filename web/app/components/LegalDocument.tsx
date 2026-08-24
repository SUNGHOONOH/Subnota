 'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SubnotaGlassMark } from '../subnota-ui/icons';
import { useLanguage } from '../lib/i18n';

export interface LocalizedValue {
  en: string;
  ko: string;
}

export type LegalTranslations = Record<string, string>;

interface LegalDocumentProps {
  children: ReactNode;
  effectiveDate: LocalizedValue;
  title: LocalizedValue;
  translations: LegalTranslations;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '');
}

export default function LegalDocument({
  children,
  effectiveDate,
  title,
  translations,
}: LegalDocumentProps) {
  const { language, setLanguage } = useLanguage();
  const isEnglish = language === 'en';
  const legalContentRef = useRef<HTMLDivElement>(null);
  const originalTextRef = useRef(new Map<Text, string>());

  useEffect(() => {
    const updateTitle = () => {
      document.title = `${isEnglish ? title.en : title.ko} | Subnota`;
    };
    updateTitle();
    const frame = window.requestAnimationFrame(updateTitle);
    return () => window.cancelAnimationFrame(frame);
  }, [isEnglish, title.en, title.ko]);

  useEffect(() => {
    const content = legalContentRef.current;
    if (!content) return;

    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const textNode = current as Text;
      if (!originalTextRef.current.has(textNode)) {
        originalTextRef.current.set(textNode, textNode.nodeValue ?? '');
      }
      const korean = originalTextRef.current.get(textNode) ?? '';
      textNode.nodeValue = isEnglish
        ? translations[normalizeText(korean)] ?? korean
        : korean;
      current = walker.nextNode();
    }
  }, [isEnglish, translations]);

  return (
    <main className="legal-page">
      <div className="legal-page-shell">
        <header className="legal-page-header">
          <Link className="legal-brand" href="/">
            <SubnotaGlassMark className="legal-brand-mark" size={28} />
            <span>Subnota</span>
          </Link>
          <div className="legal-page-header-actions">
            <nav aria-label={isEnglish ? 'Legal documents' : '법적 문서'}>
              <Link href="/privacy">{isEnglish ? 'Privacy policy' : '개인정보 처리방침'}</Link>
              <Link href="/terms">{isEnglish ? 'Terms of service' : '서비스 이용약관'}</Link>
              <Link href="/account-deletion">{isEnglish ? 'Delete account' : '계정 삭제'}</Link>
            </nav>
            <div
              aria-label={isEnglish ? 'Language selection' : '언어 선택'}
              className="lang-switch"
              role="group"
            >
              <button
                aria-pressed={language === 'en'}
                onClick={() => setLanguage('en')}
                type="button"
              >
                EN
              </button>
              <button
                aria-pressed={language === 'ko'}
                onClick={() => setLanguage('ko')}
                type="button"
              >
                KO
              </button>
            </div>
          </div>
        </header>

        <article className="legal-article">
          <p className="legal-eyebrow">SUBNOTA</p>
          <h1>{isEnglish ? title.en : title.ko}</h1>
          <p className="legal-effective-date">
            {isEnglish ? 'Effective date: ' : '시행일: '}
            {isEnglish ? effectiveDate.en : effectiveDate.ko}
          </p>
          <div className="legal-content" ref={legalContentRef}>{children}</div>
        </article>

        <footer className="legal-page-footer">
          <Link href="/">{isEnglish ? 'Subnota home' : 'Subnota 홈'}</Link>
          <a href="mailto:contact@subnota.com">contact@subnota.com</a>
        </footer>
      </div>
    </main>
  );
}
