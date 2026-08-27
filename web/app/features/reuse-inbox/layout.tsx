import type { Metadata } from 'next';

const PATH = '/features/reuse-inbox';
const TITLE = '웹페이지 저장과 AI 요약';
const DESCRIPTION =
  '보고 있는 페이지를 버튼 하나로 저장하면 링크와 함께 제목·요약·키워드가 담기고, 관련된 내용을 쓸 때 다시 나타납니다.';

/* canonical 과 openGraph 는 루트 레이아웃에서 상속되므로 페이지마다 덮어써야 한다.
   비워 두면 네 페이지 모두 홈의 중복본으로 선언되어 색인에서 빠진다. */
export const metadata: Metadata = {
  alternates: { canonical: PATH },
  description: DESCRIPTION,
  openGraph: {
    description: DESCRIPTION,
    title: `${TITLE} · Subnota`,
    url: PATH,
  },
  title: TITLE,
  twitter: {
    description: DESCRIPTION,
    title: `${TITLE} · Subnota`,
  },
};

export default function ReuseInboxLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
