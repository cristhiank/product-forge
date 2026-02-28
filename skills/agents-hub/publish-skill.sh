#!/usr/bin/env bash
set -euo pipefail

# Publish agents-hub skill to ~/.copilot/skills/agents-hub/
# Usage: ./publish-skill.sh [--target <dir>]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$HOME/.copilot/skills/agents-hub}"

echo "📦 Publishing agents-hub skill..."
echo "   Source: $SCRIPT_DIR"
echo "   Target: $TARGET"

# Build (ncc compiles TS + bundles deps + copies native assets)
echo "→ Building with ncc..."
cd "$SCRIPT_DIR"
npm run build --silent

# Create target directory
rm -rf "$TARGET"
mkdir -p "$TARGET/references"

# Copy skill files
echo "→ Copying skill files..."
cp "$SCRIPT_DIR/SKILL.md" "$TARGET/"
cp "$SCRIPT_DIR/.worker-context.json" "$TARGET/"
cp -R "$SCRIPT_DIR/scripts/" "$TARGET/scripts/"
cp "$SCRIPT_DIR/references/"*.md "$TARGET/references/"

echo "✅ Published to $TARGET"
echo ""
echo "Skill layout:"
find "$TARGET" -type f | sort | head -20
