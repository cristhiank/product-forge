#!/usr/bin/env bash
set -euo pipefail

# Publish backlog skill to ~/.copilot/skills/backlog/
# Usage: ./publish-skill.sh [--target <dir>]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$HOME/.copilot/skills/backlog}"

echo "📦 Publishing backlog skill..."
echo "   Source: $SCRIPT_DIR"
echo "   Target: $TARGET"

# Build (ncc compiles TS + bundles all deps into single file)
echo "→ Building with ncc..."
cd "$SCRIPT_DIR"
npm run build --silent

# Create target directory (clean)
echo "→ Preparing target..."
rm -rf "$TARGET"
mkdir -p "$TARGET/references"

# Copy skill files
echo "→ Copying skill files..."
cp "$SCRIPT_DIR/SKILL.md" "$TARGET/"
cp -R "$SCRIPT_DIR/scripts/" "$TARGET/scripts/"
cp "$SCRIPT_DIR/references/"*.md "$TARGET/references/"

echo ""
echo "✅ Skill published to $TARGET"
echo ""
echo "Files:"
find "$TARGET" -maxdepth 2 -not -name '.DS_Store' | sort | sed 's|^|   |'
