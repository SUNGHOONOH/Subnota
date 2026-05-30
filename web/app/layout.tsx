import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Subnota - 적기만 하면 일정과 기억으로 이어지는 메모',
  description:
    '그저 기록하는 것만으로 충분합니다. 약속을 메모하면 캘린더 일정이 되고, 잊고 있던 예전의 생각들은 오늘의 기록과 연결되어 자연스럽게 살아납니다.',
  openGraph: {
    title: '쓰기만 하세요, 정리는 Subnota가 할게요.',
    description:
      '메모가 일정이 되고, 과거의 생각이 오늘의 아이디어로 이어지는 가장 편안한 메모장.',
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
        <link rel="stylesheet" as="style" crossOrigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
