import type { Metadata } from 'next';

const PATH = '/features/memo-to-calendar';
const TITLE = '메모 속 날짜를 일정으로';
const DESCRIPTION =
  '본문에 적어둔 약속과 마감을 찾아 일정으로 제안하고, 날짜가 애매한 약속은 일정 저장함에 남겨 둡니다.';

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

export default function MemoToCalendarLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
