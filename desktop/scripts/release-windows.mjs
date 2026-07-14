#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const tag = `v${version}`;
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const releaseNote = args.filter((arg) => arg !== '--dry-run').join(' ').trim();
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const isWindows = process.platform === 'win32';

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const capture = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return result.status === 0 ? result.stdout.trim() : '';
};

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

if (!isWindows && process.env.FORCE_WINDOWS_RELEASE !== '1' && !isDryRun) {
  console.error(
    'Windows releases must run on Windows. Set FORCE_WINDOWS_RELEASE=1 only if your environment is configured for cross-builds.',
  );
  process.exit(1);
}

if (isDryRun) {
  if (process.env.SKIP_TESTS === '1') {
    console.log('SKIP_TESTS=1');
  } else {
    console.log(`${pnpm} test`);
  }
  console.log('node scripts/build-exe.mjs --dry-run');
  console.log(`gh release upload/create ${tag} <windows-installer.exe>`);
  process.exit(0);
}

if (process.env.SKIP_TESTS === '1') {
  console.log('Skipping tests because SKIP_TESTS=1');
} else {
  run(pnpm, ['test']);
}

run('node', ['scripts/build-exe.mjs'], {
  env: {
    ...process.env,
    FORCE_WINDOWS_MAKE:
      process.env.FORCE_WINDOWS_MAKE ?? process.env.FORCE_WINDOWS_RELEASE,
  },
});

const exePath = findExeFiles(join(root, 'out', 'make'))[0];
if (!exePath) {
  console.error('Windows installer .exe not found under out/make.');
  process.exit(1);
}

const releaseUrl = capture('gh', ['release', 'view', tag, '--json', 'url', '-q', '.url']);
if (releaseUrl) {
  run('gh', ['release', 'upload', tag, exePath, '--clobber']);
  if (releaseNote) {
    run('gh', ['release', 'edit', tag, '--notes', releaseNote]);
  }
  console.log(`Released ${tag}: ${releaseUrl}`);
} else {
  run('gh', [
    'release',
    'create',
    tag,
    exePath,
    '--title',
    tag,
    '--notes',
    releaseNote || `Windows release ${tag}`,
  ]);
  console.log(capture('gh', ['release', 'view', tag, '--json', 'url', '-q', '.url']));
}
