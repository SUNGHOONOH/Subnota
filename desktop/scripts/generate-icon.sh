#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ICONSET="$ROOT_DIR/resources/icon.iconset"
ICNS="$ROOT_DIR/resources/icon.icns"
MASTER_PNG="$ROOT_DIR/resources/icon-1024.png"

# 예전에는 여기서 qlmanage로 SVG를 래스터화했다. Quick Look 썸네일은 투명
# 배경을 흰색으로 채워서 아이콘의 둥근 모서리가 흰 사각형이 됐다.
# 이제 sharp로 알파를 보존해 굽고(generate-brand-assets.mjs), 여기서는
# 그 결과물을 크기별로 자르기만 한다.
echo "Generating brand rasters..."
node "$SCRIPT_DIR/generate-brand-assets.mjs"

if [ ! -f "$MASTER_PNG" ]; then
  echo "Error: $MASTER_PNG missing." >&2
  exit 1
fi

# Build iconset with all required sizes
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

sips -z 16   16   "$MASTER_PNG" --out "$ICONSET/icon_16x16.png"      -s format png >/dev/null
sips -z 32   32   "$MASTER_PNG" --out "$ICONSET/icon_16x16@2x.png"   -s format png >/dev/null
sips -z 32   32   "$MASTER_PNG" --out "$ICONSET/icon_32x32.png"       -s format png >/dev/null
sips -z 64   64   "$MASTER_PNG" --out "$ICONSET/icon_32x32@2x.png"   -s format png >/dev/null
sips -z 128  128  "$MASTER_PNG" --out "$ICONSET/icon_128x128.png"     -s format png >/dev/null
sips -z 256  256  "$MASTER_PNG" --out "$ICONSET/icon_128x128@2x.png" -s format png >/dev/null
sips -z 256  256  "$MASTER_PNG" --out "$ICONSET/icon_256x256.png"     -s format png >/dev/null
sips -z 512  512  "$MASTER_PNG" --out "$ICONSET/icon_256x256@2x.png" -s format png >/dev/null
sips -z 512  512  "$MASTER_PNG" --out "$ICONSET/icon_512x512.png"     -s format png >/dev/null
sips -z 1024 1024 "$MASTER_PNG" --out "$ICONSET/icon_512x512@2x.png" -s format png >/dev/null

# Convert iconset → .icns
iconutil -c icns "$ICONSET" -o "$ICNS"
rm -rf "$ICONSET"

echo "Icon ready: $ICNS"
