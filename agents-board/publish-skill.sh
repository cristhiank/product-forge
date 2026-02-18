#!/usr/bin/env bash
set -euo pipefail

# Publish agents-board skill to ~/.copilot/skills/agents-board/
# Usage: ./publish-skill.sh [--target <dir>]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-$HOME/.copilot/skills/agents-board}"

echo "📦 Building and publishing agents-board skill..."
echo "   Source: $SCRIPT_DIR"
echo "   Target: $TARGET"

# Build TypeScript
echo "→ Compiling TypeScript..."
cd "$SCRIPT_DIR"
npm run build --silent

# Bundle with esbuild
echo "→ Bundling scripts/board.js..."
npm run bundle --silent

# Create target directory
mkdir -p "$TARGET/scripts" "$TARGET/references"

# Copy skill files
echo "→ Copying skill files..."
cp "$SCRIPT_DIR/SKILL.md" "$TARGET/"
cp "$SCRIPT_DIR/scripts/board.js" "$TARGET/scripts/"
cp "$SCRIPT_DIR/references/"*.md "$TARGET/references/"

# Copy node_modules/better-sqlite3 (native dependency needed at runtime)
if [ -d "$SCRIPT_DIR/node_modules/better-sqlite3" ]; then
  echo "→ Copying better-sqlite3 runtime dependency..."
  mkdir -p "$TARGET/node_modules"
  cp -R "$SCRIPT_DIR/node_modules/better-sqlite3" "$TARGET/node_modules/"
  # Also copy bindings and prebuild-install if present
  for dep in bindings file-uri-to-path node-addon-api prebuild-install; do
    if [ -d "$SCRIPT_DIR/node_modules/$dep" ]; then
      cp -R "$SCRIPT_DIR/node_modules/$dep" "$TARGET/node_modules/"
    fi
  done
fi

echo ""
echo "✅ Skill published to $TARGET"
echo ""
echo "Files:"
find "$TARGET" -maxdepth 2 -not -path '*/node_modules/*' -not -name '.DS_Store' | sort | sed 's|^|   |'
