#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
const tag = `v${version}`;
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const releaseNoteArgs = args.filter((arg) => arg !== '--dry-run').join(' ');
const releaseNote = (process.env.RELEASE_NOTES ?? releaseNoteArgs).trim();
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const isWindows = process.platform === 'win32';

const fail = (message) => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: false,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) {
    console.error(`Failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const capture = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  return result.status === 0 ? result.stdout.trim() : '';
};

const findFiles = (dir) => {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return findFiles(entryPath);
    }
    return entry.isFile() ? [entryPath] : [];
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
  console.log(
    `gh release upload/create ${tag} <windows-installer.exe> <RELEASES> <full.nupkg>`,
  );
  process.exit(0);
}

const productionEnv = {
  ...loadEnv('production', root, ''),
  ...process.env,
};
for (const name of [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_MEMO_BACKEND_URL',
]) {
  if (!productionEnv[name]?.trim()) {
    fail(`Missing production build configuration: ${name}`);
  }
}
for (const name of ['VITE_SUPABASE_URL', 'VITE_MEMO_BACKEND_URL']) {
  let url;
  try {
    url = new URL(productionEnv[name]);
  } catch {
    fail(`${name} must be a valid URL.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    fail(`${name} must be a credential-free HTTPS URL.`);
  }
}

const headCommit = capture('git', ['rev-parse', 'HEAD']);
const tagCommit = capture('git', ['rev-list', '-n', '1', tag]);
if (!headCommit || !tagCommit) {
  fail(`Release tag ${tag} is missing. The macOS release job must create it first.`);
}
if (headCommit !== tagCommit) {
  fail(`Release tag ${tag} does not point to HEAD. Bump the version instead of reusing the tag.`);
}

if (process.env.SKIP_TESTS === '1') {
  console.log('Skipping tests because SKIP_TESTS=1');
} else {
  run(pnpm, ['test'], { shell: isWindows });
}

run(process.execPath, ['scripts/build-exe.mjs'], {
  env: {
    ...process.env,
    FORCE_WINDOWS_MAKE:
      process.env.FORCE_WINDOWS_MAKE ?? process.env.FORCE_WINDOWS_RELEASE,
  },
});

const makeFiles = findFiles(join(root, 'out', 'make'));
const exePaths = makeFiles.filter((file) => file.toLowerCase().endsWith('.exe'));
const releasesPath = makeFiles.find((file) => file.split(/[\\/]/).at(-1) === 'RELEASES');
const nupkgPaths = makeFiles.filter((file) => file.toLowerCase().endsWith('.nupkg'));
const fullNupkgPath = nupkgPaths.find((file) => /-full\.nupkg$/i.test(file));

if (exePaths.length === 0) {
  fail('Windows installer .exe not found under out/make.');
}
if (!releasesPath) {
  fail('Squirrel.Windows RELEASES file not found under out/make.');
}
if (!fullNupkgPath) {
  fail('Squirrel.Windows full update package not found under out/make.');
}

const releaseAssets = [...exePaths, releasesPath, ...nupkgPaths].sort();

const releaseUrl = capture('gh', ['release', 'view', tag, '--json', 'url', '-q', '.url']);
if (releaseUrl) {
  run('gh', ['release', 'upload', tag, ...releaseAssets, '--clobber']);
  if (releaseNote) {
    run('gh', ['release', 'edit', tag, '--notes', releaseNote]);
  }
  console.log(`Released ${tag}: ${releaseUrl}`);
} else {
  run('gh', [
    'release',
    'create',
    tag,
    ...releaseAssets,
    '--title',
    tag,
    '--notes',
    releaseNote || `Windows release ${tag}`,
  ]);
  console.log(capture('gh', ['release', 'view', tag, '--json', 'url', '-q', '.url']));
}
