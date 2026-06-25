// Parser for Subnota custom-scheme deep links (`subnota://...`).
//
// Windows receives capture links from the future Chrome extension:
//   subnota://capture?url=<url>&title=...
// The parser still tolerates `memo` links for protocol compatibility, but the
// Windows Electron app does not open an in-app Mini Subnota surface.
//
// Kept free of Electron imports so it can be unit-tested in plain Node.

export type SubnotaDeepLink =
  | { kind: 'auth'; code: string | null; error: string | null }
  | { kind: 'memo'; text: string }
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

  if (action === 'capture') {
    const captureUrl = url.searchParams.get('url') ?? '';
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
