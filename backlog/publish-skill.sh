#!/usr/bin/env bash
set -euo pipefail

# Publish backlog skill to ~/.copilot/skills/backlog/
# Usage: ./publish-skill.sh [--target <dir>]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$HOME/.copilot/skills/backlog}"

echo "📦 Building and publishing backlog skill..."
echo "   Source: $SCRIPT_DIR"
echo "   Target: $TARGET"

# Build TypeScript
echo "→ Compiling TypeScript..."
cd "$SCRIPT_DIR"
npm run build --silent

# Bundle with esbuild
echo "→ Bundling scripts/backlog.js..."
npm run bundle --silent

# Create target directory (clean)
echo "→ Preparing target..."
rm -rf "$TARGET"
mkdir -p "$TARGET/scripts" "$TARGET/references"

# Copy skill files
echo "→ Copying skill files..."
cp "$SCRIPT_DIR/SKILL.md" "$TARGET/"
cp "$SCRIPT_DIR/scripts/backlog.js" "$TARGET/scripts/"
cp "$SCRIPT_DIR/references/"*.md "$TARGET/references/"

echo ""
echo "✅ Skill published to $TARGET"
echo ""
echo "Files:"
find "$TARGET" -maxdepth 2 -not -name '.DS_Store' | sort | sed 's|^|   |'
