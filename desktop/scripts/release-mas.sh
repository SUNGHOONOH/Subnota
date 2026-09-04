#!/usr/bin/env bash
# Mac App Store build: App Sandbox, Apple Distribution signing, and PKG.
# This is intentionally separate from release.sh (Developer ID DMG release).
set -euo pipefail
trap 'echo "Error: MAS release failed at line $LINENO" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

fail() {
  echo "Error: $*" >&2
  exit 1
}

for command in bash node pnpm security codesign pkgutil xcrun shasum lipo plutil; do
  command -v "$command" >/dev/null || fail "Required command is missing: $command"
done

[ "$(uname -s)" = "Darwin" ] || fail "MAS builds must be created on macOS."
[ "$(uname -m)" = 'arm64' ] || \
  fail "The arm64-only MAS package must be built on an Apple silicon runner."
[ "$(node -p 'process.versions.node.split(`.`)[0]')" = '24' ] || \
  fail "Node 24 is required. Run 'nvm use' in the desktop directory."
[ -n "${MAS_PROVISIONING_PROFILE:-}" ] || \
  fail "MAS_PROVISIONING_PROFILE must point to a Mac App Store provisioning profile."
[ -f "$MAS_PROVISIONING_PROFILE" ] || \
  fail "Provisioning profile not found: $MAS_PROVISIONING_PROFILE"

VERSION=$(node -p "require('./package.json').version")
TARGET_ARCH="${MAS_ARCH:-arm64}"
BROWSER_CAPTURE="${SUBNOTA_MAS_BROWSER_CAPTURE:-1}"
[ "$TARGET_ARCH" = 'arm64' ] || fail "The first MAS pipeline is arm64-only (MAS_ARCH=$TARGET_ARCH)."
case "$BROWSER_CAPTURE" in
  0|1) ;;
  *) fail "SUBNOTA_MAS_BROWSER_CAPTURE must be 1 (temporary exception) or 0 (review fallback)." ;;
esac

if [ "$BROWSER_CAPTURE" = '1' ]; then
  MAIN_ENTITLEMENTS='build/entitlements.mas.plist'
  CAPTURE_MODE='temporary-exception'
else
  MAIN_ENTITLEMENTS='build/entitlements.mas.fallback.plist'
  CAPTURE_MODE='fallback'
fi
plutil -lint "$MAIN_ENTITLEMENTS" build/entitlements.mas.child.plist >/dev/null

echo "==> Building Subnota ${VERSION} for the Mac App Store (${TARGET_ARCH}, ${CAPTURE_MODE})"
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test
pnpm run lint
# high 이상만 릴리스를 막는다. 패치가 없는 moderate 권고 하나로 출시가
# 통째로 멈추면, 급할 때 검사를 건너뛰는 습관이 생긴다.
pnpm audit --prod --audit-level high

node --input-type=module <<'NODE'
import { loadEnv } from 'vite';
const env = loadEnv('production', process.cwd(), '');
for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_MEMO_BACKEND_URL']) {
  if (!env[name]?.trim()) throw new Error(`Missing production build configuration: ${name}`);
}
for (const name of ['VITE_SUPABASE_URL', 'VITE_MEMO_BACKEND_URL']) {
  const url = new URL(env[name]);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${name} must be a credential-free HTTPS URL.`);
  }
}
NODE

if [ ! -f resources/icon.icns ]; then
  sh scripts/generate-icon.sh
fi

rm -rf out/
SUBNOTA_MAS_BUILD=1 \
SUBNOTA_MAS_BROWSER_CAPTURE="$BROWSER_CAPTURE" \
SUBNOTA_TARGET_ARCH="$TARGET_ARCH" \
MAS_SIGNING_TYPE=distribution \
MAS_BUILD_NUMBER="${MAS_BUILD_NUMBER:-${GITHUB_RUN_NUMBER:-1}}" \
MAS_PROVISIONING_PROFILE="$MAS_PROVISIONING_PROFILE" \
MAS_APP_SIGNING_IDENTITY="${MAS_APP_SIGNING_IDENTITY:-}" \
MAS_INSTALLER_SIGNING_IDENTITY="${MAS_INSTALLER_SIGNING_IDENTITY:-}" \
node node_modules/@electron-forge/cli/dist/electron-forge.js make \
  --platform mas \
  --arch "$TARGET_ARCH" \
  --targets pkg

APP_PATH=$(find out -maxdepth 3 -name 'Subnota.app' -type d | head -1)
PKG_PATH=$(find out/make -maxdepth 3 -name '*.pkg' -type f | head -1)
[ -n "$APP_PATH" ] || fail "Subnota.app was not produced."
[ -n "$PKG_PATH" ] || fail "The MAS PKG was not produced."

bash scripts/verify-mas-release.sh "$APP_PATH" "$PKG_PATH" "$BROWSER_CAPTURE"

mkdir -p out/make
digest=$(shasum -a 256 "$PKG_PATH" | awk '{print $1}')
printf '%s  %s\n' "$digest" "$(basename "$PKG_PATH")" > out/make/MAS-SHA256SUM.txt
echo "==> MAS package ready: $PKG_PATH"
echo "==> Browser capture policy: $CAPTURE_MODE"
echo "==> Upload this PKG to App Store Connect or TestFlight."
