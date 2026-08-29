import { afterEach, describe, expect, it } from 'vitest';

import {
  getMacUpdateFeedUrl,
  getReleaseDownloadBaseUrl,
  getReleaseRepository,
  normalizeReleaseAssetUrl,
} from '../release-channel';

const originalEnv = {
  GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
  SUBNOTA_MAC_UPDATE_FEED_URL: process.env.SUBNOTA_MAC_UPDATE_FEED_URL,
  SUBNOTA_RELEASE_DOWNLOAD_BASE_URL:
    process.env.SUBNOTA_RELEASE_DOWNLOAD_BASE_URL,
  SUBNOTA_RELEASE_REPO: process.env.SUBNOTA_RELEASE_REPO,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('release channel policy', () => {
  it('accepts a GitHub owner/repository pair and rejects path injection', () => {
    process.env.SUBNOTA_RELEASE_REPO = 'SUNGHOONOH/subnota';
    expect(getReleaseRepository()).toBe('SUNGHOONOH/subnota');

    process.env.SUBNOTA_RELEASE_REPO = 'SUNGHOONOH/subnota/releases/other';
    expect(getReleaseRepository()).toBeNull();
  });

  it('allows only the configured GitHub latest-download base and manifest', () => {
    process.env.SUBNOTA_RELEASE_REPO = 'SUNGHOONOH/subnota';
    process.env.SUBNOTA_RELEASE_DOWNLOAD_BASE_URL =
      'https://attacker.example/releases/latest/download';
    expect(getReleaseDownloadBaseUrl()).toBeNull();
    expect(getMacUpdateFeedUrl()).toBeNull();
  });

  it('accepts assets only from the configured repository release path', () => {
    expect(
      normalizeReleaseAssetUrl(
        'https://github.com/SUNGHOONOH/subnota/releases/download/v1.2.0/Subnota.dmg',
        'SUNGHOONOH/subnota',
      ),
    ).toBe(
      'https://github.com/SUNGHOONOH/subnota/releases/download/v1.2.0/Subnota.dmg',
    );
    expect(
      normalizeReleaseAssetUrl(
        'https://github.com/SUNGHOONOH/Subnota/releases/download/v1.2.0/Subnota.dmg',
        'SUNGHOONOH/subnota',
      ),
    ).toBe(
      'https://github.com/SUNGHOONOH/Subnota/releases/download/v1.2.0/Subnota.dmg',
    );
    expect(
      normalizeReleaseAssetUrl(
        'https://github.com/attacker/subnota/releases/download/v1.2.0/Subnota.dmg',
        'SUNGHOONOH/subnota',
      ),
    ).toBeNull();
  });
});
