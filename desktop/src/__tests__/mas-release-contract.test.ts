import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readProjectFile = (path: string) =>
  readFileSync(resolve(__dirname, '../..', path), 'utf8');

const BROWSER_BUNDLE_IDS = [
  'com.apple.Safari',
  'com.google.Chrome',
  'company.thebrowser.Browser',
  'com.microsoft.edgemac',
  'com.brave.Browser',
];

describe('Mac App Store review contract', () => {
  it('keeps the temporary Apple Events exception limited to reviewed browsers', () => {
    const entitlements = readProjectFile('build/entitlements.mas.plist');
    const declaredBundleIds = [
      ...entitlements.matchAll(/<string>([^<]+)<\/string>/g),
    ].map(match => match[1]);

    expect(entitlements).toContain(
      '<key>com.apple.security.temporary-exception.apple-events</key>',
    );
    expect(declaredBundleIds).toEqual(BROWSER_BUNDLE_IDS);
    expect(entitlements.match(/com\.apple\.security\.temporary-exception/g)).toHaveLength(1);
  });

  it('provides a fallback with the same core sandbox access and no automation exception', () => {
    const entitlements = readProjectFile(
      'build/entitlements.mas.fallback.plist',
    );

    for (const key of [
      'com.apple.security.app-sandbox',
      'com.apple.security.network.client',
      'com.apple.security.files.user-selected.read-write',
      'com.apple.security.files.bookmarks.app-scope',
    ]) {
      expect(entitlements).toContain(`<key>${key}</key>`);
    }
    expect(entitlements).not.toContain('automation.apple-events');
    expect(entitlements).not.toContain('temporary-exception');
  });

  it('builds browser capture and its entitlement from the same MAS policy switch', () => {
    const forge = readProjectFile('forge.config.ts');
    const mainVite = readProjectFile('vite.main.config.ts');
    const preloadVite = readProjectFile('vite.preload.config.ts');
    const releaseScript = readProjectFile('scripts/release-mas.sh');
    const main = readProjectFile('src/main.ts');

    expect(forge).toContain("process.env.SUBNOTA_MAS_BROWSER_CAPTURE !== '0'");
    expect(forge).toContain("'build/entitlements.mas.fallback.plist'");
    expect(mainVite).toContain('__SUBNOTA_NATIVE_PAGE_CAPTURE_ENABLED__');
    expect(preloadVite).toContain('__SUBNOTA_NATIVE_PAGE_CAPTURE_ENABLED__');
    expect(releaseScript).toContain(
      'SUBNOTA_MAS_BROWSER_CAPTURE="$BROWSER_CAPTURE"',
    );
    expect(
      main.match(/DESKTOP_PLATFORM_FEATURES\.nativeCurrentPageCapture/g),
    ).toHaveLength(2);
  });

  it('ships clear English and Korean Apple Events purpose strings', () => {
    const english = readProjectFile('resources/en.lproj/InfoPlist.strings');
    const korean = readProjectFile('resources/ko.lproj/InfoPlist.strings');

    expect(english).toContain('title and URL');
    expect(english).toContain('Save Current Page');
    expect(korean).toContain('제목과 주소만');
    expect(korean).toContain('현재 페이지 저장');
  });

  // 모델을 번들하면 앱이 343MB에서 900MB가 되고, 받은 파일을 캐시로 한 번 더
  // 복사해 디스크를 두 배로 먹는다. MAS도 DMG와 같은 다운로드 경로를 쓴다.
  it('does not bundle the embedding model into the MAS app', () => {
    const forge = readProjectFile('forge.config.ts');
    const embedding = readProjectFile('src/local-embedding.ts');
    const packageJson = readProjectFile('package.json');
    const workflow = readProjectFile('../.github/workflows/desktop-mas.yml');

    expect(forge).not.toContain('embedding-model');
    expect(packageJson).not.toContain('prepare:mas-model');
    expect(workflow).not.toContain('embedding-model');
    // 번들 가중치를 캐시로 복사하던 분기가 남아 있으면 디스크가 두 배가 된다.
    expect(embedding).not.toContain('hasBundledWeights');
    expect(embedding).not.toContain('bundledWeightsPath');
  });

  // 로그인은 온라인에서 끝나도 그 뒤 끊길 수 있다. 그때 [다운로드]를 눌러도
  // 받아지지 않으므로, 관문이 이유를 말하고 버튼을 막아야 한다.
  it('blocks the model download gate while offline', () => {
    const gate = readProjectFile('src/features/search/EmbeddingModelGate.tsx');

    expect(gate).toContain('navigator.onLine');
    expect(gate).toContain("window.addEventListener('offline', sync)");
    expect(gate).toContain('disabled={isOffline || shortfallMb !== null}');
    // 한국어 라벨이 영어 문구에 섞여 들어가지 않아야 한다.
    expect(gate).toContain("MODEL_SIZE_LABEL = { en:");
    expect(gate).toContain('${MODEL_SIZE_LABEL.en}');
  });

  // Electron이 넣는 빈 .lproj 55개를 두면 App Store가 한/영 앱을 55개 언어
  // 지원으로 표시한다. 실제 빌드에서 55 → 2(en, ko)로 줄어드는 것을 확인했다.
  it('ships only the localizations it actually has', () => {
    const forge = readProjectFile('forge.config.ts');

    expect(forge).toContain("const KEPT_LOCALIZATIONS = new Set(['en', 'ko']);");
    expect(forge).toContain('pruneUnusedLocalizations');
    // 서명 전에 지워야 서명이 깨지지 않는다.
    expect(forge).toContain('afterCopy: [');
  });

  // 없으면 App Store Connect가 업로드마다 수출 규정 질문을 반복한다.
  it('declares export-compliance exemption up front', () => {
    expect(readProjectFile('forge.config.ts')).toContain(
      'ITSAppUsesNonExemptEncryption: false,',
    );
  });

  // 패치 없는 moderate 권고 하나로 출시가 멈추면 검사를 건너뛰는 습관이 생긴다.
  it('lets a release proceed past non-critical advisories', () => {
    expect(readProjectFile('scripts/release-mas.sh')).toContain(
      'pnpm audit --prod --audit-level high',
    );
  });

  it('blocks temporary-exception upload until review metadata is confirmed', () => {
    const workflow = readProjectFile('../.github/workflows/desktop-mas.yml');

    expect(workflow).toContain('apple_events_feedback_id:');
    expect(workflow).toContain('app_sandbox_usage_info_confirmed:');
    expect(workflow).toContain('^FB[0-9]+$');
    expect(workflow).toContain(
      '[ "$APP_SANDBOX_USAGE_INFO_CONFIRMED" = "true" ]',
    );
  });
});
