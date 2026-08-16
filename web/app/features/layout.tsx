import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '../components/site';

export default function FeaturesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
