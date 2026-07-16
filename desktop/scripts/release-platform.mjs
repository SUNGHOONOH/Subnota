#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const command = isWindows ? 'node' : 'sh';
const script = isWindows
  ? 'scripts/release-windows.mjs'
  : 'scripts/release.sh';
const result = spawnSync(command, [script, ...process.argv.slice(2)], {
  shell: false,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
