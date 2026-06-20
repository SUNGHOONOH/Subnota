#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# --- Icon ---
if [ ! -f resources/icon.icns ]; then
  echo "No icon found — generating..."
  sh scripts/generate-icon.sh
fi

# --- Package ---
echo "Packaging app..."
pnpm exec electron-forge package

APP_PATH=$(find out -maxdepth 2 -name "Subnota.app" -type d | head -1)
if [ -z "$APP_PATH" ]; then
  echo "Error: Subnota.app not found in out/" >&2
  exit 1
fi

sh scripts/resign-local-mac-app.sh "$APP_PATH"

# --- Build installers ---
echo "Making distributables..."
pnpm exec electron-forge make --skip-package

# --- Find artifacts ---
ZIP_PATH=$(find out/make -name "*.zip" -maxdepth 5 | head -1)

echo ""
echo "Build complete!"
[ -n "$APP_PATH" ] && echo "  App:  $ROOT_DIR/$APP_PATH"
[ -n "$ZIP_PATH" ] && echo "  ZIP:  $ROOT_DIR/$ZIP_PATH"
echo ""

# --- Install prompt ---
if [ -n "$APP_PATH" ]; then
  APP_NAME=$(basename "$APP_PATH")
  read -rp "Install $APP_NAME to ~/Applications? [y/N] " answer
  case "$answer" in
    [yY]*)
      mkdir -p ~/Applications
      rm -rf ~/Applications/"$APP_NAME"
      cp -R "$APP_PATH" ~/Applications/"$APP_NAME"
      echo "Installed to ~/Applications/$APP_NAME"
      open ~/Applications
      ;;
    *)
      echo "Skipping install. You can copy $APP_PATH manually."
      ;;
  esac
fi
