#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
BUILD_TYPE="${1:-Debug}"
VST3_NAME="Subtreactional.vst3"
VST3_INSTALL_DIR="$HOME/Library/Audio/Plug-Ins/VST3"

echo "=== Configuring ($BUILD_TYPE) ==="
cmake -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE="$BUILD_TYPE" "$SCRIPT_DIR"

echo "=== Building ==="
cmake --build "$BUILD_DIR" -j "$(sysctl -n hw.ncpu)"

SRC="$BUILD_DIR/SubtreactionalVST_artefacts/$BUILD_TYPE/VST3/$VST3_NAME"
DEST="$VST3_INSTALL_DIR/$VST3_NAME"

echo "=== Installing ==="
rm -rf "$DEST"
cp -R "$SRC" "$DEST"

echo "=== Done: $DEST ==="
