import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const releaseRepo =
  process.env.SUBNOTA_RELEASE_REPO || process.env.GITHUB_REPOSITORY || '';
const [releaseOwner, releaseName] = releaseRepo.split('/');
const releaseDownloadBaseUrl =
  process.env.SUBNOTA_RELEASE_DOWNLOAD_BASE_URL ||
  (releaseOwner && releaseName
    ? `https://github.com/${releaseOwner}/${releaseName}/releases/latest/download`
    : undefined);
const macNotarizeConfig = process.env.APPLE_ID
  ? {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD!,
      teamId: process.env.APPLE_TEAM_ID!,
    }
  : undefined;

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.sunghoonoh.subnota.macos',
    appCategoryType: 'public.app-category.productivity',
    asar: true,
    icon: './resources/icon',
    // Ship the menu-bar/tray icon alongside the packaged app (→ Contents/Resources).
    extraResource: ['./resources/tray.png'],
    osxSign: {
      optionsForFile: (filePath) => {
        if (filePath.endsWith('.app') && !filePath.includes('.app/')) {
          return { entitlements: 'build/entitlements.mac.plist' };
        }
        return null;
      },
    },
    ...(macNotarizeConfig ? { osxNotarize: macNotarizeConfig } : {}),
    extendInfo: {
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'Markdown Document',
          CFBundleTypeRole: 'Editor',
          LSHandlerRank: 'Default',
          CFBundleTypeExtensions: ['md', 'markdown'],
        },
      ],
      // subnota:// deep links (Mini Subnota quick memo + web clipper capture).
      CFBundleURLTypes: [
        {
          CFBundleURLName: 'Subnota',
          CFBundleURLSchemes: ['subnota'],
        },
      ],
      // Required to run AppleScript against browsers for "현재 페이지 저장".
      NSAppleEventsUsageDescription:
        'Subnota가 현재 브라우저 페이지의 주소와 제목을 수집함에 저장하기 위해 사용합니다.',
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP(
      releaseDownloadBaseUrl
        ? { macUpdateManifestBaseUrl: releaseDownloadBaseUrl }
        : {},
      ['darwin'],
    ),
    new MakerDMG({ format: 'ULFO' }),
  ],
  publishers:
    releaseOwner && releaseName
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
