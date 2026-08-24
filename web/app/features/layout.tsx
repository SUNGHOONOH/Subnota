'use client';

import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '../components/site';
import { useText } from '../lib/i18n';

export default function FeaturesLayout({ children }: { children: ReactNode }) {
  const text = useText();

  return (
    <>
      <a className="skip-link" href="#main">
        {text('본문으로 건너뛰기', 'Skip to content')}
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
