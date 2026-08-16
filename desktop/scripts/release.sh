#!/usr/bin/env bash
# Production macOS release: clean build, Developer ID signing, notarization,
# Gatekeeper verification, checksums, tag, and GitHub release upload.
set -euo pipefail
trap 'echo "Error: release failed at line $LINENO" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

fail() {
  echo "Error: $*" >&2
  exit 1
}

for command in gh git node pnpm security codesign spctl xcrun shasum; do
  command -v "$command" >/dev/null || fail "Required command is missing: $command"
done

[ "$(uname -s)" = "Darwin" ] || fail "macOS releases must be built on macOS."
[ "$(node -p 'process.versions.node.split(`.`)[0]')" = '24' ] || \
  fail "Node 24 is required. Run 'nvm use' in the desktop directory."
gh auth status >/dev/null 2>&1 || fail "GitHub CLI is not authenticated. Run: gh auth login"

VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"
RELEASE_NOTE="${1:-}"
CHECKSUM_PATH="out/make/SHA256SUMS.txt"

release_exists() { gh release view "$TAG" >/dev/null 2>&1; }
release_assets() {
  gh release view "$TAG" --json assets -q '.assets[].name' 2>/dev/null
}
fully_released() {
  local assets
  assets=$(release_assets) || return 1
  echo "$assets" | grep -qi '\.dmg$' \
    && echo "$assets" | grep -qi '\.zip$' \
    && echo "$assets" | grep -qx 'RELEASES.json' \
    && echo "$assets" | grep -qx 'SHA256SUMS.txt'
}

echo "==> Releasing ${TAG}"
if release_exists && fully_released; then
  echo "==> ${TAG} already has every verified release asset."
  exit 0
fi

[ -z "$(git status --porcelain)" ] || \
  fail "The working tree must be completely clean before a release."
git fetch --tags origin

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  [ "$(git rev-list -n 1 "$TAG")" = "$(git rev-parse HEAD)" ] || \
    fail "Existing tag ${TAG} does not point to HEAD. Bump the version instead of reusing the tag."
fi

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
if [ -z "$SIGNING_IDENTITY" ]; then
  SIGNING_IDENTITY=$(security find-identity -v -p codesigning 2>/dev/null \
    | sed -n 's/.*"\(Developer ID Application:.*\)"/\1/p' \
    | head -1)
fi
[ -n "$SIGNING_IDENTITY" ] || \
  fail "No Developer ID Application signing identity is installed."

NOTARY_ARGS=()
if [ -n "${APPLE_NOTARY_KEYCHAIN_PROFILE:-}" ]; then
  NOTARY_ARGS=(--keychain-profile "$APPLE_NOTARY_KEYCHAIN_PROFILE")
  if [ -n "${APPLE_NOTARY_KEYCHAIN:-}" ]; then
    NOTARY_ARGS+=(--keychain "$APPLE_NOTARY_KEYCHAIN")
  fi
elif [ -n "${APPLE_API_KEY:-}" ] && [ -n "${APPLE_API_KEY_ID:-}" ] && [ -n "${APPLE_API_ISSUER:-}" ]; then
  NOTARY_ARGS=(--key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER")
elif [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_ID_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
  NOTARY_ARGS=(--apple-id "$APPLE_ID" --password "$APPLE_ID_PASSWORD" --team-id "$APPLE_TEAM_ID")
else
  fail "Notarization credentials are missing. Configure a keychain profile, App Store Connect API key, or Apple ID app-specific password."
fi

if ! release_exists && [ -z "$RELEASE_NOTE" ]; then
  read -rp "Release statement for ${TAG}: " RELEASE_NOTE
fi

echo "==> Running release gates..."
pnpm install --frozen-lockfile
node --input-type=module <<'NODE'
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), '');
for (const name of [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_MEMO_BACKEND_URL',
]) {
  if (!env[name]?.trim()) {
    throw new Error(`Missing production build configuration: ${name}`);
  }
}
for (const name of ['VITE_SUPABASE_URL', 'VITE_MEMO_BACKEND_URL']) {
  const url = new URL(env[name]);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${name} must be a credential-free HTTPS URL.`);
  }
}
NODE
pnpm exec tsc --noEmit
pnpm test
pnpm run lint
pnpm audit --prod

if [ ! -f resources/icon.icns ]; then
  sh scripts/generate-icon.sh
fi

echo "==> Building a fresh signed and notarized app..."
rm -rf out/
node node_modules/@electron-forge/cli/dist/electron-forge.js make

APP_PATH=$(find out -maxdepth 2 -name 'Subnota.app' -type d | head -1)
DMG_PATH=$(find out/make -maxdepth 3 -name "*${VERSION}*.dmg" -type f | head -1)
ZIP_PATH=$(find out/make/zip -maxdepth 4 -name "*${VERSION}*.zip" -type f | head -1)
RELEASES_JSON=$(find out/make/zip -maxdepth 4 -name 'RELEASES.json' -type f | head -1)
[ -n "$APP_PATH" ] || fail "Subnota.app was not produced."
[ -n "$DMG_PATH" ] || fail "The release DMG was not produced."
[ -n "$ZIP_PATH" ] || fail "The update ZIP was not produced."
[ -n "$RELEASES_JSON" ] || fail "RELEASES.json was not produced."

ZIP_PATH=$(node scripts/fix-mac-update-manifest.mjs "$RELEASES_JSON" "$ZIP_PATH")

echo "==> Signing and notarizing the DMG..."
codesign --force --timestamp --sign "$SIGNING_IDENTITY" "$DMG_PATH"
xcrun notarytool submit "$DMG_PATH" --wait "${NOTARY_ARGS[@]}"
xcrun stapler staple "$DMG_PATH"
sh scripts/verify-mac-release.sh "$APP_PATH" "$DMG_PATH"

mkdir -p "$(dirname "$CHECKSUM_PATH")"
: > "$CHECKSUM_PATH"
for asset in "$DMG_PATH" "$ZIP_PATH" "$RELEASES_JSON"; do
  digest=$(shasum -a 256 "$asset" | awk '{print $1}')
  printf '%s  %s\n' "$digest" "$(basename "$asset")" >> "$CHECKSUM_PATH"
done

if ! git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  git tag -a "$TAG" -m "${RELEASE_NOTE:-$TAG}"
fi
CURRENT_BRANCH=$(git symbolic-ref --quiet --short HEAD || true)
if [ -n "$CURRENT_BRANCH" ]; then
  git push origin "$CURRENT_BRANCH"
fi
git push origin "$TAG"

if release_exists; then
  gh release upload "$TAG" \
    "$DMG_PATH" "$ZIP_PATH" "$RELEASES_JSON" "$CHECKSUM_PATH" --clobber
  if [ -n "$RELEASE_NOTE" ]; then
    gh release edit "$TAG" --notes "$RELEASE_NOTE"
  fi
else
  gh release create "$TAG" \
    "$DMG_PATH" "$ZIP_PATH" "$RELEASES_JSON" "$CHECKSUM_PATH" \
    --title "$TAG" --notes "$RELEASE_NOTE"
fi

echo "==> Released ${TAG}: $(gh release view "$TAG" --json url -q .url)"
