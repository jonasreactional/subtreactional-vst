#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
BUILD_TYPE="${1:-Debug}"
VST3_NAME="Subtreactional.vst3"
VST3_INSTALL_DIR="/Library/Audio/Plug-Ins/VST3"

# ── Developer ID for signing + notarization ───────────────────────────────────
# Set these or export them in your shell environment before running ./build.sh dist
SIGN_IDENTITY="${SIGN_IDENTITY:-Developer ID Application: Jonas Kjellberg}"
NOTARYTOOL_PROFILE="${NOTARYTOOL_PROFILE:-notarytool-profile}"   # keychain profile name

echo "=== Configuring ($BUILD_TYPE) ==="
cmake -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE="$BUILD_TYPE" "$SCRIPT_DIR"

echo "=== Building ==="
cmake --build "$BUILD_DIR" -j "$(sysctl -n hw.ncpu)"

SRC="$BUILD_DIR/SubtreactionalVST_artefacts/$BUILD_TYPE/VST3/$VST3_NAME"
DEST="$VST3_INSTALL_DIR/$VST3_NAME"

if [[ "${2:-}" == "dist" ]]; then
    DIST_DIR="$SCRIPT_DIR/dist"
    ZIP="$DIST_DIR/$VST3_NAME.zip"

    mkdir -p "$DIST_DIR"

    echo "=== Signing ==="
    codesign --deep --force --options runtime \
             --sign "$SIGN_IDENTITY" \
             "$SRC"

    echo "=== Verifying signature ==="
    codesign --verify --deep --strict --verbose=2 "$SRC"

    echo "=== Zipping ==="
    rm -f "$ZIP"
    ditto -c -k --keepParent "$SRC" "$ZIP"

    echo "=== Notarizing (this takes ~1 min) ==="
    xcrun notarytool submit "$ZIP" \
          --keychain-profile "$NOTARYTOOL_PROFILE" \
          --wait

    echo "=== Stapling ==="
    xcrun stapler staple "$SRC"

    echo "=== Re-zipping with stapled ticket ==="
    rm -f "$ZIP"
    ditto -c -k --keepParent "$SRC" "$ZIP"

    echo "=== Verifying notarization ==="
    spctl --assess --type exec --verbose "$SRC"

    echo ""
    echo "=== Distributable ready: $ZIP ==="
else
    echo "=== Installing ==="
    sudo rm -rf "$DEST"
    sudo cp -R "$SRC" "$DEST"

    echo "=== Done: $DEST ==="
fi
