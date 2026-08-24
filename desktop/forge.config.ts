import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import fs from 'node:fs';
import path from 'node:path';
import {
  getReleaseDownloadBaseUrl,
  getReleaseRepository,
} from './src/release-channel';

const releaseRepo = getReleaseRepository();
const [releaseOwner, releaseName] = releaseRepo?.split('/') ?? [];
const releaseDownloadBaseUrl = getReleaseDownloadBaseUrl() ?? undefined;
const macNotarizeConfig = process.env.APPLE_NOTARY_KEYCHAIN_PROFILE
  ? {
      keychainProfile: process.env.APPLE_NOTARY_KEYCHAIN_PROFILE,
      ...(process.env.APPLE_NOTARY_KEYCHAIN
        ? { keychain: process.env.APPLE_NOTARY_KEYCHAIN }
        : {}),
    }
  : process.env.APPLE_API_KEY &&
      process.env.APPLE_API_KEY_ID &&
      process.env.APPLE_API_ISSUER
    ? {
        appleApiIssuer: process.env.APPLE_API_ISSUER,
        appleApiKey: process.env.APPLE_API_KEY,
        appleApiKeyId: process.env.APPLE_API_KEY_ID,
      }
    : process.env.APPLE_ID &&
        process.env.APPLE_ID_PASSWORD &&
        process.env.APPLE_TEAM_ID
      ? {
          appleId: process.env.APPLE_ID,
          appleIdPassword: process.env.APPLE_ID_PASSWORD,
          teamId: process.env.APPLE_TEAM_ID,
        }
      : undefined;
const isMacBuild = process.platform === 'darwin';
const isLocalMacBuild = process.env.SUBNOTA_LOCAL_BUILD === '1';

// Forge의 Vite 플러그인은 기본적으로 `.vite` 말고 전부 제외한다 — Vite가 모든
// 의존성을 번들한다고 보기 때문이다. 하지만 onnxruntime-node는 네이티브
// 바이너리를 자기 파일 구조 기준으로 찾으므로 번들할 수 없고(external),
// 그래서 node_modules에 실물이 있어야 한다. 플러그인은 `ignore`가 이미 있으면
// 덮어쓰지 않으므로(VitePlugin.js resolveForgeConfig) 여기서 직접 정의한다.
//
// 이 목록이 틀리면 패키징된 앱에서만 ERR_MODULE_NOT_FOUND로 터진다. 개발
// 모드는 node_modules를 그대로 보기 때문에 절대 재현되지 않는다.
// 로컬 임베딩이 런타임에 실제로 require하는 것들. 나머지는 Vite가 번들한다.
// (onnxruntime-web은 transformers.node.mjs 안에 이미 인라인돼 있어 130MB를
//  따로 넣을 필요가 없다. @huggingface/jinja, tokenizers도 마찬가지다.)
const RUNTIME_ROOTS = ['@huggingface/transformers', 'onnxruntime-node', 'sharp'];
const RUNTIME_SKIP = new Set(['onnxruntime-web', '@types/node', 'undici-types', 'type-fest']);

// 손으로 나열하면 전이 의존성이 빠지고, 그 실수는 패키징된 앱에서만 드러난다
// (실제로 detect-libc가 빠져 sharp 로딩이 터졌다). 그래서 package.json을 따라
// 폐쇄를 직접 계산한다.
const collectRuntimeModules = (): Set<string> => {
  const found = new Set<string>();
  const visit = (name: string) => {
    if (found.has(name) || RUNTIME_SKIP.has(name)) return;
    const manifest = path.join(__dirname, 'node_modules', name, 'package.json');
    if (!fs.existsSync(manifest)) return;
    found.add(name);
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8')) as {
      dependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep);
    // sharp의 네이티브 바이너리는 optionalDependencies로 플랫폼별로 갈린다.
    for (const dep of Object.keys(pkg.optionalDependencies ?? {})) {
      if (dep.startsWith('@img/') && !dep.includes(platformSlug)) continue;
      visit(dep);
    }
  };
  RUNTIME_ROOTS.forEach(visit);
  return found;
};

const platformSlug = `${process.platform === 'win32' ? 'win32' : process.platform}-${process.arch}`;
const runtimeModules = collectRuntimeModules();
const runtimePrefixes = [...runtimeModules].map(m => `/node_modules/${m}`);

const shouldIgnore = (file: string): boolean => {
  if (!file) return false;
  if (file.startsWith('/.vite')) return false;

  // 원하는 경로의 조상 디렉터리는 남겨야 한다 — 제외하면 하위 전체가 빠진다.
  const wanted = runtimePrefixes.some(
    prefix => file === prefix || file.startsWith(`${prefix}/`) || prefix.startsWith(`${file}/`),
  );
  if (!wanted) return true;

  // 타입 정의는 런타임에 필요 없다 (3.8MB).
  if (file.startsWith('/node_modules/@huggingface/transformers/types')) return true;
  // onnxruntime-node는 5개 플랫폼 바이너리(210MB)를 함께 배포한다. 하나만 남긴다.
  const binRoot = '/node_modules/onnxruntime-node/bin/napi-v6/';
  if (file.startsWith(binRoot)) {
    const rest = file.slice(binRoot.length);
    return rest.includes('/') && !rest.startsWith(`${process.platform}/${process.arch}`);
  }
  return false;
};

const config: ForgeConfig = {
  packagerConfig: {
    // onnxruntime-node의 네이티브 바이너리는 asar 안에서 로드할 수 없다.
    // (읽기 전용 아카이브라 dlopen 불가) 반드시 unpack해야 한다.
    asar: {
      unpack: '**/node_modules/{onnxruntime-node,@img,sharp}/**',
    },
    ignore: shouldIgnore,
    icon: './resources/icon',
    extraResource: isMacBuild
      // 메뉴바 아이콘은 Retina용 @2x 를 같은 폴더에 두면 Electron이 알아서
      // 고른다. 하나만 넣으면 고해상도 화면에서 뭉갠다.
      ? ['./resources/tray.png', './resources/tray@2x.png']
      : ['./resources/icon.ico'],
    ...(isMacBuild
      ? {
          appBundleId: 'com.sunghoonoh.subnota.macos',
          appCategoryType: 'public.app-category.productivity',
          ...(isLocalMacBuild
            ? { osxSign: false as const }
            : {
                osxSign: {
                  ...(process.env.APPLE_SIGNING_IDENTITY
                    ? { identity: process.env.APPLE_SIGNING_IDENTITY }
                    : {}),
                  optionsForFile: (filePath: string) => {
                    if (filePath.endsWith('.app') && !filePath.includes('.app/')) {
                      return { entitlements: 'build/entitlements.mac.plist' };
                    }
                    return null;
                  },
                },
                ...(macNotarizeConfig ? { osxNotarize: macNotarizeConfig } : {}),
              }),
          extendInfo: {
            // TODO(markdown-files): Reintroduce Markdown import/edit only with
            // an OS file picker and per-window scoped path authorization.
            CFBundleURLTypes: [
              {
                CFBundleURLName: 'Subnota',
                CFBundleURLSchemes: ['subnota'],
              },
            ],
            NSAppleEventsUsageDescription:
              'Subnota가 현재 브라우저 페이지의 주소와 제목을 수집함에 저장하기 위해 사용합니다.',
            NSAppTransportSecurity: {
              NSAllowsArbitraryLoads: false,
            },
          },
        }
      : {
          protocols: [
            {
              name: 'Subnota',
              schemes: ['subnota'],
            },
          ],
        }),
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP(
      releaseDownloadBaseUrl
        ? { macUpdateManifestBaseUrl: releaseDownloadBaseUrl }
        : {},
      ['darwin'],
    ),
    // 설치 창. 배경의 꽃잎 궤적이 앱 아이콘(x:180)과 Applications 별칭(x:480)
    // 사이의 빈 폭에 정확히 들어가므로 좌표를 배경과 맞춰 둔다
    // (배경은 scripts/generate-brand-assets.mjs 가 굽는다).
    new MakerDMG(
      {
        background: './resources/dmg-background.png',
        format: 'ULFO',
        icon: './resources/icon.icns',
        iconSize: 110,
        additionalDMGOptions: {
          window: { size: { height: 400, width: 660 } },
        },
        contents: [
          { path: '/Applications', type: 'link', x: 480, y: 262 },
          {
            path: `${process.cwd()}/out/Subnota-darwin-${process.arch}/Subnota.app`,
            type: 'file',
            x: 180,
            y: 262,
          },
        ],
      },
      ['darwin'],
    ),
    new MakerSquirrel(
      {
        name: 'subnota',
        setupIcon: './resources/icon.ico',
      },
      ['win32'],
    ),
  ],
  publishers:
    isMacBuild && releaseOwner && releaseName
      ? [
          new PublisherGithub({
            repository: { owner: releaseOwner, name: releaseName },
            prerelease: false,
            draft: false,
          }),
        ]
      : [],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
