#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ICONSET="$ROOT_DIR/resources/icon.iconset"
ICNS="$ROOT_DIR/resources/icon.icns"
GLASS_PNG="$ROOT_DIR/resources/icon-glass-1024.png"
ICON_COMPOSER="$ROOT_DIR/resources/Subnota.icon"
ICTOOL="${ICON_COMPOSER_TOOL:-/Applications/Xcode.app/Contents/Applications/Icon Composer.app/Contents/Executables/ictool}"

if [ ! -d "$ICON_COMPOSER" ]; then
  echo "Error: $ICON_COMPOSER missing." >&2
  exit 1
fi

if [ ! -x "$ICTOOL" ]; then
  echo "Error: Icon Composer ictool not found at $ICTOOL" >&2
  exit 1
fi

echo "Exporting Liquid Glass icon..."
"$ICTOOL" "$ICON_COMPOSER" \
  --export-image \
  --output-file "$GLASS_PNG" \
  --platform macOS \
  --rendition Default \
  --width 1024 \
  --height 1024 \
  --scale 1

# ictool emits a 16-bit PNG. Keep the same rendered pixels while reducing the
# raster size used by the DMG, Windows icon, and web copies.
ICON_MASTER_PATH="$GLASS_PNG" node --input-type=module <<'NODE'
import sharp from 'sharp';
import { rename } from 'node:fs/promises';

const input = process.env.ICON_MASTER_PATH;
const output = `${input}.optimized`;
await sharp(input)
  .png({ bitdepth: 8, compressionLevel: 9, adaptiveFiltering: true })
  .toFile(output);
await rename(output, input);
NODE

# 메뉴바·Windows·DMG 보조 자산은 방금 렌더링한 PNG를 기준으로 생성한다.
echo "Generating brand rasters..."
node "$SCRIPT_DIR/generate-brand-assets.mjs"

# Build iconset with all required sizes
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

sips -z 16   16   "$GLASS_PNG" --out "$ICONSET/icon_16x16.png"      -s format png >/dev/null
sips -z 32   32   "$GLASS_PNG" --out "$ICONSET/icon_16x16@2x.png"   -s format png >/dev/null
sips -z 32   32   "$GLASS_PNG" --out "$ICONSET/icon_32x32.png"       -s format png >/dev/null
sips -z 64   64   "$GLASS_PNG" --out "$ICONSET/icon_32x32@2x.png"   -s format png >/dev/null
sips -z 128  128  "$GLASS_PNG" --out "$ICONSET/icon_128x128.png"     -s format png >/dev/null
sips -z 256  256  "$GLASS_PNG" --out "$ICONSET/icon_128x128@2x.png" -s format png >/dev/null
sips -z 256  256  "$GLASS_PNG" --out "$ICONSET/icon_256x256.png"     -s format png >/dev/null
sips -z 512  512  "$GLASS_PNG" --out "$ICONSET/icon_256x256@2x.png" -s format png >/dev/null
sips -z 512  512  "$GLASS_PNG" --out "$ICONSET/icon_512x512.png"     -s format png >/dev/null
sips -z 1024 1024 "$GLASS_PNG" --out "$ICONSET/icon_512x512@2x.png" -s format png >/dev/null

# Convert iconset → .icns
iconutil -c icns "$ICONSET" -o "$ICNS"
rm -rf "$ICONSET"

echo "Icon ready: $ICNS"
