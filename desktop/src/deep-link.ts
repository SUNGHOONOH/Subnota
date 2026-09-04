// Parser for Subnota custom-scheme deep links (`subnota://...`).
//
// Ported from the legacy RN macOS app, which emitted:
//   subnota://memo?text=<text>            (Quick Subnota quick memo)
//   subnota://capture?url=<url>&title=... (web clipper from the menu bar)
//
// Kept free of Electron imports so it can be unit-tested in plain Node.

import { normalizeWebUrl } from './lib/url-policy';

export type SubnotaDeepLink =
  | { kind: 'auth'; code: string | null; error: string | null }
  | { kind: 'memo'; text: string }
  | { kind: 'link' }
  | { kind: 'capture'; url: string; title: string };

export const parseSubnotaUrl = (raw: string): SubnotaDeepLink | null => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== 'subnota:') {
    return null;
  }

  // For `subnota://memo?...` the action is the host; tolerate `subnota:///memo`.
  const action = url.hostname || url.pathname.replace(/^\/+/, '');

  if (action === 'auth' && url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    const error =
      url.searchParams.get('error_description') ?? url.searchParams.get('error');
    if (!code && !error) {
      return null;
    }
    return { kind: 'auth', code, error };
  }

  if (action === 'memo') {
    return { kind: 'memo', text: url.searchParams.get('text') ?? '' };
  }

  // Windows 점프 리스트(작업 표시줄 우클릭)가 쓰는 동사. 붙여넣을 링크가 아직
  // 없으니 파라미터도 없다 — Quick을 링크 입력 상태로 열기만 한다.
  if (action === 'link') {
    return { kind: 'link' };
  }

  if (action === 'capture') {
    const captureUrl = normalizeWebUrl(url.searchParams.get('url'));
    if (!captureUrl) {
      return null;
    }
    return {
      kind: 'capture',
      url: captureUrl,
      title: url.searchParams.get('title') ?? '',
    };
  }

  return null;
};
