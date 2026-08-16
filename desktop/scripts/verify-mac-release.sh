#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:?Usage: verify-mac-release.sh /path/Subnota.app /path/Subnota.dmg}"
DMG_PATH="${2:?Usage: verify-mac-release.sh /path/Subnota.app /path/Subnota.dmg}"
INFO_PLIST="$APP_PATH/Contents/Info.plist"

BUNDLE_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$INFO_PLIST")
[ "$BUNDLE_ID" = 'com.sunghoonoh.subnota.macos' ] || {
  echo "Error: unexpected bundle identifier: $BUNDLE_ID" >&2
  exit 1
}
if /usr/libexec/PlistBuddy -c 'Print :CFBundleDocumentTypes' "$INFO_PLIST" >/dev/null 2>&1; then
  echo 'Error: Markdown document association is enabled for this release.' >&2
  exit 1
fi
ATS_ARBITRARY=$(/usr/libexec/PlistBuddy -c 'Print :NSAppTransportSecurity:NSAllowsArbitraryLoads' "$INFO_PLIST")
[ "$ATS_ARBITRARY" = 'false' ] || {
  echo 'Error: NSAllowsArbitraryLoads must be false.' >&2
  exit 1
}

codesign --verify --deep --strict --verbose=2 "$APP_PATH"
codesign --display --verbose=4 "$APP_PATH" 2>&1 | grep -q 'runtime'
xcrun stapler validate "$APP_PATH"
spctl --assess --type execute --verbose=2 "$APP_PATH"

codesign --verify --verbose=2 "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG_PATH"
