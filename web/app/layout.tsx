import type { Metadata } from 'next';
import './globals.css';
import { LanguageProvider } from './lib/i18n';
import MotionProvider from './motion-provider';
import PostHogProvider from './posthog-provider';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://subnota.com';

const DESCRIPTION =
  'Subnota는 메모 속 날짜를 캘린더로 잇고, 지금 쓰는 문장과 관련된 과거의 문장을 작성 중에 보여줍니다. 로그인 없이 먼저 적고, 정리는 나중에 따라옵니다.';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  description: DESCRIPTION,
  icons: {
    // Safari and Chrome both use this transparent raster mark in browser tabs.
    icon: [
      { url: '/subnota-mark-glass.png?v=1', type: 'image/png', sizes: '1024x1024' },
    ],
    apple: [
      { url: '/subnota-mark-glass.png?v=1', type: 'image/png', sizes: '1024x1024' },
    ],
  },
  metadataBase: new URL(SITE_URL),
  openGraph: {
    description: DESCRIPTION,
    locale: 'ko_KR',
    siteName: 'Subnota',
    title: '메모가 일정이 되고, 필요한 기억이 돌아옵니다',
    type: 'website',
    url: '/',
  },
  title: {
    default: 'Subnota — 메모가 일정이 되고, 필요한 기억이 돌아옵니다',
    template: '%s · Subnota',
  },
  twitter: {
    card: 'summary_large_image',
    description: DESCRIPTION,
    title: '메모가 일정이 되고, 필요한 기억이 돌아옵니다',
  },
};

/* 구조화 데이터는 실제로 제공하는 것만 적는다. 아직 받을 수 있는 파일이
   없으므로 다운로드 URL이나 가격은 넣지 않는다. */
const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  applicationCategory: 'ProductivityApplication',
  description: DESCRIPTION,
  name: 'Subnota',
  operatingSystem: 'macOS, Windows',
  url: SITE_URL,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          rel="stylesheet"
        />
        {/* 제목 전용. 본문·제품 UI 는 Pretendard 그대로 두고 제목에만 쓴다 —
            화면 안 앱은 어디까지나 앱의 서체여야 한다. */}
        <link
          href="https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.min.css"
          rel="stylesheet"
        />
        {/* 워드마크 전용. 마크 옆 글자에만 쓴다 — 본문에 쓰면 로고가 아니라
            그냥 다른 서체가 된다. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@700&display=swap"
          rel="stylesheet"
        />
        {/* 손글씨 주석 전용. CSS @import 로 두면 CSS→CSS→폰트 3단 블로킹이 된다. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
          type="application/ld+json"
        />
      </head>
      <body>
        <MotionProvider>
          <LanguageProvider>
            <PostHogProvider>{children}</PostHogProvider>
          </LanguageProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
