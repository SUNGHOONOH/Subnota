#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import core from './update-manifest-core.cjs';

export const { normalizeManifest, normalizeZipName } = core;

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
