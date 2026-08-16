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
  return ROUTES.map((route) => ({
    lastModified: new Date(),
    priority: route.priority,
    url: `${SITE_URL}${route.path}`,
  }));
}
