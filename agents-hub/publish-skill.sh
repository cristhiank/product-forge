#!/usr/bin/env bash
set -euo pipefail

# Publish agents-hub skill to ~/.copilot/skills/agents-hub/
# Usage: ./publish-skill.sh [--target <dir>]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$HOME/.copilot/skills/agents-hub}"

echo "📦 Building and publishing agents-hub skill..."
echo "   Source: $SCRIPT_DIR"
echo "   Target: $TARGET"

# Build TypeScript
echo "→ Compiling TypeScript..."
cd "$SCRIPT_DIR"
npm run build --silent

# Bundle with esbuild
echo "→ Bundling scripts/hub.js..."
npm run bundle --silent

# Create target directory
mkdir -p "$TARGET/scripts" "$TARGET/references"

# Copy skill files
echo "→ Copying skill files..."
cp "$SCRIPT_DIR/SKILL.md" "$TARGET/"
cp "$SCRIPT_DIR/scripts/hub.js" "$TARGET/scripts/"
cp "$SCRIPT_DIR/references/"*.md "$TARGET/references/"

# Copy native dependency
echo "→ Copying better-sqlite3..."
mkdir -p "$TARGET/node_modules"
cp -R "$SCRIPT_DIR/node_modules/better-sqlite3" "$TARGET/node_modules/"
cp -R "$SCRIPT_DIR/node_modules/bindings" "$TARGET/node_modules/" 2>/dev/null || true
cp -R "$SCRIPT_DIR/node_modules/file-uri-to-path" "$TARGET/node_modules/" 2>/dev/null || true
cp -R "$SCRIPT_DIR/node_modules/prebuild-install" "$TARGET/node_modules/" 2>/dev/null || true
cp -R "$SCRIPT_DIR/node_modules/node-addon-api" "$TARGET/node_modules/" 2>/dev/null || true

echo "✅ Published to $TARGET"
echo ""
echo "Skill layout:"
find "$TARGET" -type f | sort | head -20
