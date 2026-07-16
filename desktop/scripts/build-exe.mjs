#!/usr/bin/env node
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const isDryRun = process.argv.includes('--dry-run');
const force = process.env.FORCE_WINDOWS_MAKE === '1';
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const findExeFiles = (dir) => {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return findExeFiles(entryPath);
    }
    return entry.isFile() && entry.name.toLowerCase().endsWith('.exe')
      ? [entryPath]
      : [];
  });
};

if (process.platform !== 'win32' && !force && !isDryRun) {
  console.error(
    'Windows EXE/Squirrel builds must run on Windows. Set FORCE_WINDOWS_MAKE=1 only if your environment is configured for cross-builds.',
  );
  process.exit(1);
}

if (!existsSync(join(root, 'resources', 'icon.ico'))) {
  console.error('Missing resources/icon.ico, required for the Windows installer.');
  process.exit(1);
}

const command = [
  'exec',
  'electron-forge',
  'make',
  '--targets',
  '@electron-forge/maker-squirrel',
];

if (isDryRun) {
  console.log(`${pnpm} ${command.join(' ')}`);
  process.exit(0);
}

rmSync(join(root, 'out'), { force: true, recursive: true });

const result = spawnSync(pnpm, command, {
  cwd: root,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const exeFiles = findExeFiles(join(root, 'out', 'make'));
if (exeFiles.length === 0) {
  console.error('Windows installer .exe not found under out/make.');
  process.exit(1);
}

console.log(`Windows installer built: ${exeFiles[0]}`);
