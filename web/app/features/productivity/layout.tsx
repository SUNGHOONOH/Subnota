import type { Metadata } from 'next';

const PATH = '/features/productivity';
const TITLE = '메모와 캘린더를 한 화면에';
const DESCRIPTION =
  '메모, 캘린더, 저장한 링크를 한 창 안에 나란히 열어 앱을 오가지 않고 작업 흐름을 이어 갑니다.';

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

export default function ProductivityLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
