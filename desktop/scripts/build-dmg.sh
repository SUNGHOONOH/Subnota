#!/usr/bin/env bash
set -euo pipefail
trap 'echo "Error: script failed at line $LINENO" >&2' ERR

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
cd "$ROOT"

VERSION=$(node -p "require('./package.json').version")

# --- Icon ---
if [ ! -f resources/icon.icns ]; then
  echo "==> Generating icon..."
  sh scripts/generate-icon.sh
fi

# --- Clean previous build ---
rm -rf out/

# --- Package ---
echo "==> Packaging app for v${VERSION}..."
pnpm exec electron-forge package

APP_PATH=$(find out -maxdepth 2 -name "Subnota.app" -type d | head -1)
if [ -z "$APP_PATH" ]; then
  echo "Error: Subnota.app not found in out/" >&2
  exit 1
fi

# Electron fuses mutate the framework binary during packaging. Without a
# signing identity, the local app can be left with a broken inherited Electron
# signature and macOS kills it with "Code Signature Invalid". Re-sign ad-hoc
# for local DMG smoke builds; production release still uses the configured
# Developer ID signing/notarization path.
sh scripts/resign-local-mac-app.sh "$APP_PATH"

# --- Build DMG ---
echo "==> Building DMG for v${VERSION}..."
pnpm exec electron-forge make --skip-package --targets @electron-forge/maker-dmg

# --- Find DMG ---
DMG_PATH=$(find out/make -name "*.dmg" -maxdepth 3 | head -1)
if [ -z "$DMG_PATH" ]; then
  echo "Error: DMG not found in out/make/"
  exit 1
fi

echo "==> DMG built: $DMG_PATH"
