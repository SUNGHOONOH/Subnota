export const DEFAULT_RELEASE_REPOSITORY = 'SUNGHOONOH/subnota';
const RELEASE_REPOSITORY_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

export function getReleaseRepository(): string | null {
  const configuredRepository = (
    process.env.SUBNOTA_RELEASE_REPO ||
    process.env.GITHUB_REPOSITORY ||
    DEFAULT_RELEASE_REPOSITORY
  ).trim();

  return RELEASE_REPOSITORY_PATTERN.test(configuredRepository)
    ? configuredRepository
    : null;
}

export function getReleaseDownloadBaseUrl(): string | null {
  const releaseRepository = getReleaseRepository();
  if (!releaseRepository) return null;

  const expectedUrl =
    `https://github.com/${releaseRepository}/releases/latest/download`;
  const explicitUrl = (
    process.env.SUBNOTA_RELEASE_DOWNLOAD_BASE_URL || ''
  ).trim();
  if (!explicitUrl) return expectedUrl;

  try {
    const parsed = new URL(explicitUrl);
    return parsed.toString().replace(/\/$/, '') === expectedUrl
      ? expectedUrl
      : null;
  } catch {
    return null;
  }
}

export function getMacUpdateFeedUrl(): string | null {
  const downloadBaseUrl = getReleaseDownloadBaseUrl();
  if (!downloadBaseUrl) return null;
  const expectedUrl = `${downloadBaseUrl}/RELEASES.json`;
  const explicitFeedUrl = (
    process.env.SUBNOTA_MAC_UPDATE_FEED_URL || ''
  ).trim();
  if (!explicitFeedUrl) return expectedUrl;

  try {
    return new URL(explicitFeedUrl).toString() === expectedUrl
      ? expectedUrl
      : null;
  } catch {
    return null;
  }
}

export function normalizeReleaseAssetUrl(
  value: unknown,
  releaseRepository = getReleaseRepository(),
): string | null {
  if (typeof value !== 'string' || !releaseRepository) return null;
  try {
    const url = new URL(value);
    const expectedPrefix = `/${releaseRepository}/releases/download/`;
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.username ||
      url.password ||
      !url.pathname.toLowerCase().startsWith(expectedPrefix.toLowerCase())
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
