#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-}"

if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "Usage: scripts/resign-local-mac-app.sh /path/to/Subnota.app" >&2
  exit 1
fi

echo "==> Re-signing local app bundle with ad-hoc identity..."
codesign --force --deep --sign - "$APP_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
