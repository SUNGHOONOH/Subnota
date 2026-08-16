const MAX_URL_LENGTH = 8_192;

const parseUrl = (value: unknown): URL | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
};

const hasEmbeddedCredentials = (url: URL) =>
  Boolean(url.username || url.password);

export const normalizeWebUrl = (value: unknown): string | null => {
  const url = parseUrl(value);
  if (
    !url ||
    !['http:', 'https:'].includes(url.protocol) ||
    hasEmbeddedCredentials(url)
  ) {
    return null;
  }
  return url.toString();
};

export const normalizeExternalUrl = (value: unknown): string | null => {
  const webUrl = normalizeWebUrl(value);
  if (webUrl) return webUrl;

  const url = parseUrl(value);
  if (!url || url.protocol !== 'mailto:' || hasEmbeddedCredentials(url)) {
    return null;
  }
  return url.toString();
};

export const normalizeOAuthAuthorizeUrl = (
  value: unknown,
  configuredSupabaseUrl: unknown,
  options: { allowLocalHttp?: boolean } = {},
): string | null => {
  const candidate = parseUrl(value);
  const configured = parseUrl(configuredSupabaseUrl);
  if (!candidate || !configured || hasEmbeddedCredentials(candidate)) return null;

  const configuredIsSecure = configured.protocol === 'https:';
  const configuredIsLocal =
    configured.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(configured.hostname);
  if (
    (!configuredIsSecure && !(options.allowLocalHttp && configuredIsLocal)) ||
    candidate.origin !== configured.origin ||
    candidate.pathname !== '/auth/v1/authorize'
  ) {
    return null;
  }

  return candidate.toString();
};
