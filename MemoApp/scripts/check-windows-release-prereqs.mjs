import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = new URL('..', import.meta.url).pathname;
const packageJson = JSON.parse(
  readFileSync(join(rootDir, 'package.json'), 'utf8'),
);

const dependencyVersions = {
  reactNative: packageJson.dependencies?.['react-native'] ?? null,
  reactNativeWindows: packageJson.dependencies?.['react-native-windows'] ?? null,
};

const checks = [
  {
    ok: process.platform === 'win32',
    message:
      process.platform === 'win32'
        ? 'Windows host detected.'
        : 'Windows release packaging must run on a Windows host with Visual Studio Build Tools.',
  },
  {
    ok: existsSync(join(rootDir, 'windows')),
    message: existsSync(join(rootDir, 'windows'))
      ? 'windows/ project exists.'
      : 'windows/ project is not initialized yet.',
  },
  {
    ok: Boolean(dependencyVersions.reactNativeWindows),
    message: dependencyVersions.reactNativeWindows
      ? `react-native-windows is configured: ${dependencyVersions.reactNativeWindows}`
      : 'react-native-windows is not installed yet.',
  },
  {
    ok:
      Boolean(dependencyVersions.reactNativeWindows) &&
      dependencyVersions.reactNative?.replace(/^[^\d]*/, '').split('.').slice(0, 2).join('.') ===
        dependencyVersions.reactNativeWindows
          ?.replace(/^[^\d]*/, '')
          .split('.')
          .slice(0, 2)
          .join('.'),
    message:
      'react-native and react-native-windows major/minor versions must match before generating release packages.',
  },
];

console.log('Windows release prerequisites');
console.log(`react-native: ${dependencyVersions.reactNative ?? 'missing'}`);
console.log(
  `react-native-windows: ${dependencyVersions.reactNativeWindows ?? 'missing'}`,
);

let failed = false;

for (const check of checks) {
  console.log(`${check.ok ? 'OK' : 'BLOCKED'} ${check.message}`);
  failed ||= !check.ok;
}

if (failed) {
  process.exitCode = 1;
}
