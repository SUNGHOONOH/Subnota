import type { Metadata } from 'next';

const PATH = '/features/connected-memory';
const TITLE = '문장 단위 메모 연결';
const DESCRIPTION =
  '지금 쓰는 문장의 의미를 읽어 관련된 과거 문장을 옆에 띄웁니다. 제목이 다르고 키워드가 겹치지 않아도 의미가 통하면 이어집니다.';

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

export default function ConnectedMemoryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
