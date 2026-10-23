#!/usr/bin/env bash
# 编译 macOS Vision OCR 助手。
#
# 用法：
#   ./build-vision-ocr.sh [输出路径]
#
# 默认输出到 apps/desktop/dist-native/ziban-vision-ocr。
# 发布时建议在 macOS CI 上分别编译 x86_64 / arm64：
#   xcrun --sdk macosx swiftc -O -target x86_64-apple-macos11 ...
#   xcrun --sdk macosx swiftc -O -target arm64-apple-macos11 ...
#   lipo -create ... -output ziban-vision-ocr
# 本脚本默认按当前机器架构编译，够本机测试用。

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:-$HERE/../../../dist-native/ziban-vision-ocr}"
mkdir -p "$(dirname "$OUT")"

# 最低 macOS 11（中文 Vision OCR 的下限），避免在更高系统上编译出的二进制
# 拿到旧 Mac 上跑不起来。
case "$(uname -m)" in
  arm64) TARGET_ARCH="arm64" ;;
  *) TARGET_ARCH="x86_64" ;;
esac
TARGET="${TARGET_ARCH}-apple-macos11.0"

if ! command -v xcrun >/dev/null 2>&1; then
  echo "找不到 xcrun。请先安装 Xcode Command Line Tools：xcode-select --install" >&2
  exit 1
fi

if ! xcrun --sdk macosx --find swiftc >/dev/null 2>&1; then
  echo "找不到 swiftc。请先安装 Xcode Command Line Tools：xcode-select --install" >&2
  exit 1
fi

xcrun --sdk macosx swiftc \
  -O \
  -whole-module-optimization \
  -target "$TARGET" \
  -framework Vision \
  -framework ImageIO \
  -framework CoreGraphics \
  "$HERE/vision-ocr.swift" \
  -o "$OUT"

echo "built: $OUT"
