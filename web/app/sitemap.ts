import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://subnota.com';

const ROUTES = [
  { path: '/', priority: 1 },
  { path: '/features/connected-memory', priority: 0.8 },
  { path: '/features/memo-to-calendar', priority: 0.8 },
  { path: '/features/reuse-inbox', priority: 0.8 },
  { path: '/features/productivity', priority: 0.8 },
  { path: '/privacy', priority: 0.3 },
  { path: '/terms', priority: 0.3 },
  { path: '/account-deletion', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  /* lastModified 는 넣지 않는다. 배포마다 new Date() 를 찍으면 내용이 그대로인
     페이지까지 매번 갱신됐다고 신고하게 되고, 반복되면 크롤러가 이 신호 자체를
     무시한다. 실제 수정일을 추적할 수 있게 되면 그때 넣는다. */
  return ROUTES.map((route) => ({
    priority: route.priority,
    url: `${SITE_URL}${route.path}`,
  }));
}
