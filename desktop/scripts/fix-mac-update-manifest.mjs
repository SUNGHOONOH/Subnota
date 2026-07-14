#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export const normalizeZipName = (name) => name.replace(/ /g, '.');

export const normalizeManifest = (manifest, normalizedZipName) => {
  const releases = (manifest.releases ?? []).map((release) => {
    if (release.version !== manifest.currentRelease) {
      return release;
    }
    if (!release.updateTo?.url) {
      return release;
    }

    const url = new URL(release.updateTo.url);
    const segments = url.pathname.split('/');
    segments[segments.length - 1] = normalizedZipName;
    url.pathname = segments.join('/');

    return {
      ...release,
      updateTo: {
        ...release.updateTo,
        url: url.toString(),
      },
    };
  });

  return { ...manifest, releases };
};

const main = (argv) => {
  const [manifestPath, zipPath] = argv;
  if (!manifestPath || !zipPath) {
    console.error('Usage: fix-mac-update-manifest.mjs <RELEASES.json> <zip>');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const normalizedName = normalizeZipName(path.basename(zipPath));
  const normalized = normalizeManifest(manifest, normalizedName);
  fs.writeFileSync(manifestPath, JSON.stringify(normalized));

  const normalizedZipPath = path.join(path.dirname(zipPath), normalizedName);
  if (normalizedZipPath !== zipPath) {
    fs.renameSync(zipPath, normalizedZipPath);
  }

  process.stdout.write(normalizedZipPath);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
