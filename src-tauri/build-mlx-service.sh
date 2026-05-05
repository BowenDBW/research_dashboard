#!/bin/bash
# Build MLX chat service binary for Tauri app
# Usage: ./build-mlx-service.sh [--clean]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SOURCE_FILE="mlx_chat_service.py"
OUTPUT_NAME="mlx-chat-service"
TARGET_DIR="binaries"
TARGET_TRIPLE="aarch64-apple-darwin"

echo "Building MLX chat service..."

# Build with PyInstaller
pyinstaller --onefile --name "$OUTPUT_NAME" "$SOURCE_FILE"

# Move to target location
mkdir -p "$TARGET_DIR"
mv "dist/$OUTPUT_NAME" "$TARGET_DIR/$OUTPUT_NAME-$TARGET_TRIPLE"

# Clean up intermediate files
rm -rf build dist "$OUTPUT_NAME.spec"

echo "✅ Build complete: $TARGET_DIR/$OUTPUT_NAME-$TARGET_TRIPLE"

# Optional: clean mode - remove final binary too
if [ "$1" == "--clean" ]; then
    echo "Cleaning build artifact..."
    rm -f "$TARGET_DIR/$OUTPUT_NAME-$TARGET_TRIPLE"
    echo "✅ Cleaned"
fi