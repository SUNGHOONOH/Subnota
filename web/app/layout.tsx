import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Subnota - 메모가 일정과 기억으로 이어지는 앱',
  description:
    '메모를 캘린더 블럭, 비슷한 기억, 데일리 브리핑으로 이어주는 개인 메모 앱입니다.',
  openGraph: {
    title: 'Subnota - 메모가 일정과 아이디어로 이어지는 앱',
    description:
      '빠르게 쓰고, 일정을 자동으로 등록하고, 예전 아이디어를 무의식에서 다시 꺼내주는 메모 경험.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
