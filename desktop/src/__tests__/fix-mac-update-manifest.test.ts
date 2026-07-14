import { describe, expect, it } from 'vitest';

const { normalizeManifest, normalizeZipName } = await import(
  '../../scripts/fix-mac-update-manifest.mjs'
);

describe('fix mac update manifest', () => {
  it('normalizes GitHub release zip names with spaces', () => {
    expect(normalizeZipName('Subnota Desktop-darwin-arm64-1.1.14.zip')).toBe(
      'Subnota.Desktop-darwin-arm64-1.1.14.zip',
    );
  });

  it('rewrites only the current release update URL', () => {
    const manifest = {
      currentRelease: '1.1.14',
      releases: [
        {
          version: '1.1.13',
          updateTo: {
            url: 'https://github.com/acme/subnota/releases/latest/download/Subnota%20Desktop-darwin-arm64-1.1.13.zip',
          },
        },
        {
          version: '1.1.14',
          updateTo: {
            url: 'https://github.com/acme/subnota/releases/latest/download/Subnota%20Desktop-darwin-arm64-1.1.14.zip',
          },
        },
      ],
    };

    const normalized = normalizeManifest(
      manifest,
      'Subnota.Desktop-darwin-arm64-1.1.14.zip',
    );

    expect(normalized.releases[0].updateTo.url).toBe(
      manifest.releases[0].updateTo.url,
    );
    expect(normalized.releases[1].updateTo.url).toBe(
      'https://github.com/acme/subnota/releases/latest/download/Subnota.Desktop-darwin-arm64-1.1.14.zip',
    );
  });
});
