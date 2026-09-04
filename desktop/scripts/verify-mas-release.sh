#!/usr/bin/env bash
# Structural, signing, entitlement, and localization checks for a MAS package.
set -euo pipefail

APP_PATH="${1:-}"
PKG_PATH="${2:-}"
BROWSER_CAPTURE="${3:-1}"
[ -d "$APP_PATH" ] || { echo "Usage: verify-mas-release.sh <Subnota.app> <Subnota.pkg> [1|0]" >&2; exit 2; }
[ -f "$PKG_PATH" ] || { echo "PKG not found: $PKG_PATH" >&2; exit 2; }
case "$BROWSER_CAPTURE" in
  0|1) ;;
  *) echo "Browser capture policy must be 1 or 0." >&2; exit 2 ;;
esac

VERIFY_TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$VERIFY_TEMP_DIR"' EXIT
SIGNED_ENTITLEMENTS="$VERIFY_TEMP_DIR/main-entitlements.plist"
PROFILE_PLIST="$VERIFY_TEMP_DIR/profile.plist"

fail() {
  echo "MAS verification failed: $*" >&2
  exit 1
}

plist_value() {
  /usr/libexec/PlistBuddy -c "Print :$2" "$1" 2>/dev/null
}

require_true() {
  [ "$(plist_value "$1" "$2" || true)" = 'true' ] || fail "Required entitlement is missing or false: $2"
}

require_absent_or_false() {
  local value
  value=$(plist_value "$1" "$2" || true)
  [ -z "$value" ] || [ "$value" = 'false' ] || fail "Distribution build must not enable: $2"
}

echo "==> Verifying app and nested code signatures"
codesign --verify --deep --strict --verbose=4 "$APP_PATH"
SIGNING_DETAILS=$(codesign --display --verbose=4 "$APP_PATH" 2>&1)
printf '%s\n' "$SIGNING_DETAILS" | grep -Eq '^Authority=(Apple Distribution|3rd Party Mac Developer Application):' || \
  fail "The app is not signed with an App Store distribution identity."

codesign --display --entitlements :- "$APP_PATH" >"$SIGNED_ENTITLEMENTS" 2>/dev/null
plutil -lint "$SIGNED_ENTITLEMENTS" >/dev/null
require_true "$SIGNED_ENTITLEMENTS" 'com.apple.security.app-sandbox'
require_true "$SIGNED_ENTITLEMENTS" 'com.apple.security.network.client'
require_true "$SIGNED_ENTITLEMENTS" 'com.apple.security.files.user-selected.read-write'
require_true "$SIGNED_ENTITLEMENTS" 'com.apple.security.files.bookmarks.app-scope'
require_absent_or_false "$SIGNED_ENTITLEMENTS" 'com.apple.security.get-task-allow'

EXPECTED_BROWSERS=(
  'com.apple.Safari'
  'com.google.Chrome'
  'company.thebrowser.Browser'
  'com.microsoft.edgemac'
  'com.brave.Browser'
)
APPLE_EVENTS_KEY='com.apple.security.temporary-exception.apple-events'
if [ "$BROWSER_CAPTURE" = '1' ]; then
  require_true "$SIGNED_ENTITLEMENTS" 'com.apple.security.automation.apple-events'
  for index in "${!EXPECTED_BROWSERS[@]}"; do
    actual=$(plist_value "$SIGNED_ENTITLEMENTS" "$APPLE_EVENTS_KEY:$index" || true)
    [ "$actual" = "${EXPECTED_BROWSERS[$index]}" ] || \
      fail "Unexpected Apple Events target at index $index: ${actual:-missing}"
  done
  extra=$(plist_value "$SIGNED_ENTITLEMENTS" "$APPLE_EVENTS_KEY:${#EXPECTED_BROWSERS[@]}" || true)
  [ -z "$extra" ] || fail "Unexpected extra Apple Events target: $extra"
  [ "$(grep -c '<key>com.apple.security.temporary-exception' "$SIGNED_ENTITLEMENTS")" -eq 1 ] || \
    fail "Only the reviewed Apple Events temporary exception is allowed."
else
  [ -z "$(plist_value "$SIGNED_ENTITLEMENTS" 'com.apple.security.automation.apple-events' || true)" ] || \
    fail "Fallback build still contains Apple Events automation permission."
  [ -z "$(plist_value "$SIGNED_ENTITLEMENTS" "$APPLE_EVENTS_KEY" || true)" ] || \
    fail "Fallback build still contains the Apple Events temporary exception."
  ! grep -q '<key>com.apple.security.temporary-exception' "$SIGNED_ENTITLEMENTS" || \
    fail "Fallback build contains a temporary exception entitlement."
fi

while IFS= read -r helper_binary; do
  helper_entitlements="$VERIFY_TEMP_DIR/$(basename "$helper_binary")-$RANDOM.plist"
  codesign --verify --strict "$helper_binary"
  codesign --display --entitlements :- "$helper_binary" >"$helper_entitlements" 2>/dev/null
  require_true "$helper_entitlements" 'com.apple.security.app-sandbox'
  require_true "$helper_entitlements" 'com.apple.security.inherit'
  ! grep -q 'temporary-exception\|automation.apple-events' "$helper_entitlements" || \
    fail "Apple Events permission leaked into helper: $helper_binary"
done < <(find "$APP_PATH/Contents/Frameworks" -path '*.app/Contents/MacOS/*' -type f)

echo "==> Verifying provisioning profile and bundle identity"
PROFILE="$APP_PATH/Contents/embedded.provisionprofile"
[ -f "$PROFILE" ] || fail "embedded.provisionprofile is missing from the MAS app."
security cms -D -i "$PROFILE" >"$PROFILE_PLIST"
plutil -lint "$PROFILE_PLIST" >/dev/null

INFO_PLIST="$APP_PATH/Contents/Info.plist"
BUNDLE_ID=$(plist_value "$INFO_PLIST" 'CFBundleIdentifier' || true)
[ "$BUNDLE_ID" = 'com.sunghoonoh.subnota.macos' ] || fail "Unexpected bundle ID: ${BUNDLE_ID:-missing}"
PROFILE_APP_ID=$(plist_value "$PROFILE_PLIST" 'Entitlements:application-identifier' || true)
case "$PROFILE_APP_ID" in
  *."$BUNDLE_ID") ;;
  *) fail "Provisioning profile does not match the app bundle ID: ${PROFILE_APP_ID:-missing}" ;;
esac
require_true "$PROFILE_PLIST" 'Entitlements:com.apple.security.app-sandbox'
require_absent_or_false "$PROFILE_PLIST" 'Entitlements:com.apple.security.get-task-allow'

echo "==> Verifying Apple Events purpose strings"
BASE_PURPOSE=$(plist_value "$INFO_PLIST" 'NSAppleEventsUsageDescription' || true)
if [ "$BROWSER_CAPTURE" = '1' ]; then
  [ -n "$BASE_PURPOSE" ] || fail "NSAppleEventsUsageDescription is missing."
  for locale in en ko; do
    strings_file="$APP_PATH/Contents/Resources/$locale.lproj/InfoPlist.strings"
    [ -f "$strings_file" ] || fail "Missing localized Apple Events purpose string: $locale"
    plutil -lint "$strings_file" >/dev/null
    localized=$(plutil -extract NSAppleEventsUsageDescription raw -o - "$strings_file")
    [ -n "$localized" ] || fail "Empty Apple Events purpose string: $locale"
  done
else
  [ -z "$BASE_PURPOSE" ] || fail "Fallback build still declares NSAppleEventsUsageDescription."
fi

echo "==> Verifying native module architectures and signatures"
MAIN_BINARY="$APP_PATH/Contents/MacOS/Subnota"
[ -f "$MAIN_BINARY" ] || fail "Main executable not found: $MAIN_BINARY"
[ "$(lipo -archs "$MAIN_BINARY")" = 'arm64' ] || fail "MAS main executable must be arm64-only."
while IFS= read -r binary; do
  codesign --verify --strict "$binary"
  [ "$(lipo -archs "$binary")" = 'arm64' ] || fail "Non-arm64 native binary found: $binary"
done < <(find "$APP_PATH/Contents" -type f \( -name '*.node' -o -name '*.dylib' \))

echo "==> Verifying installer signature"
PKG_SIGNATURE=$(pkgutil --check-signature "$PKG_PATH" 2>&1)
printf '%s\n' "$PKG_SIGNATURE"
printf '%s\n' "$PKG_SIGNATURE" | grep -Eq '(Mac Installer Distribution|3rd Party Mac Developer Installer)' || \
  fail "The installer is not signed with a Mac App Store installer identity."

echo "MAS artifact verification passed (browser capture: $BROWSER_CAPTURE)."
