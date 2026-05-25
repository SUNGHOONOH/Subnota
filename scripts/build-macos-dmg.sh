#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="Subnota"
SCHEME="MemoApp-macOS"
WORKSPACE="$ROOT_DIR/macos/MemoApp.xcworkspace"
DERIVED_DATA="$ROOT_DIR/macos/build/DerivedData"
APP_PATH="$DERIVED_DATA/Build/Products/Release/$APP_NAME.app"
DIST_DIR="$ROOT_DIR/dist/macos"
VERSION="$(node -p "require('./package.json').version")"
STAMP="$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="$DIST_DIR/$APP_NAME-$VERSION-$STAMP"
STAGING_DIR="$RELEASE_DIR/staging"
DMG_PATH="$RELEASE_DIR/$APP_NAME-$VERSION.dmg"

require_https_backend() {
  if [[ "${ALLOW_LOCALHOST_BACKEND:-}" == "1" ]]; then
    return
  fi

  if [[ -f "$ROOT_DIR/.env" ]] && grep -Eq '^MEMO_BACKEND_URL=http://(localhost|127\.0\.0\.1|0\.0\.0\.0)' "$ROOT_DIR/.env"; then
    echo "Refusing release DMG with local MEMO_BACKEND_URL in .env." >&2
    echo "Set MEMO_BACKEND_URL to the deployed HTTPS backend, or use ALLOW_LOCALHOST_BACKEND=1 for a local-only test DMG." >&2
    exit 1
  fi
}

run_verification() {
  if [[ "${SKIP_VERIFY:-}" == "1" ]]; then
    echo "Skipping TypeScript/Jest/ESLint checks because SKIP_VERIFY=1."
    return
  fi

  corepack pnpm exec tsc --noEmit
  corepack pnpm test --runInBand
  corepack pnpm lint
}

build_app() {
  xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Release \
    -derivedDataPath "$DERIVED_DATA" \
    CODE_SIGNING_ALLOWED=NO \
    build
}

sign_app_if_configured() {
  if [[ -z "${DEVELOPER_ID_APPLICATION:-}" ]]; then
    echo "DEVELOPER_ID_APPLICATION is not set; creating an unsigned local-test DMG."
    echo "Set DEVELOPER_ID_APPLICATION='Developer ID Application: ...' for public distribution."
    return
  fi

  codesign \
    --force \
    --deep \
    --options runtime \
    --timestamp \
    --entitlements "$ROOT_DIR/macos/MemoApp-macOS/MemoApp.entitlements" \
    --sign "$DEVELOPER_ID_APPLICATION" \
    "$APP_PATH"

  codesign --verify --deep --strict --verbose=2 "$APP_PATH"
  spctl --assess --type execute --verbose=2 "$APP_PATH"
}

create_dmg() {
  mkdir -p "$STAGING_DIR"
  cp -R "$APP_PATH" "$STAGING_DIR/"
  ln -s /Applications "$STAGING_DIR/Applications"

  hdiutil create \
    -volname "$APP_NAME $VERSION" \
    -srcfolder "$STAGING_DIR" \
    -format UDZO \
    "$DMG_PATH"

  if [[ -n "${DEVELOPER_ID_APPLICATION:-}" ]]; then
    codesign --force --timestamp --sign "$DEVELOPER_ID_APPLICATION" "$DMG_PATH"
    codesign --verify --verbose=2 "$DMG_PATH"
  fi
}

notarize_if_configured() {
  if [[ -z "${NOTARYTOOL_PROFILE:-}" ]]; then
    echo "NOTARYTOOL_PROFILE is not set; skipping notarization."
    echo "Create a notarytool keychain profile and set NOTARYTOOL_PROFILE for public distribution."
    return
  fi

  xcrun notarytool submit "$DMG_PATH" \
    --keychain-profile "$NOTARYTOOL_PROFILE" \
    --wait
  xcrun stapler staple "$DMG_PATH"
  spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG_PATH"
}

require_https_backend
run_verification
build_app

if [[ ! -d "$APP_PATH" ]]; then
  echo "Expected app bundle was not produced: $APP_PATH" >&2
  exit 1
fi

sign_app_if_configured
create_dmg
notarize_if_configured

echo "DMG created at: $DMG_PATH"
