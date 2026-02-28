#!/usr/bin/env bash
set -euo pipefail

# Publish frontend-architecture skill to ~/.copilot/skills/frontend-architecture/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_NAME="$(basename "$SCRIPT_DIR")"
TARGET="${1:-$HOME/.copilot/skills/$SKILL_NAME}"

echo "📦 Publishing $SKILL_NAME skill..."
echo "   Source: $SCRIPT_DIR"
echo "   Target: $TARGET"

mkdir -p "$TARGET/references"

cp "$SCRIPT_DIR/SKILL.md" "$TARGET/"
cp "$SCRIPT_DIR/references/"*.md "$TARGET/references/"

echo "✅ Published to $TARGET"
echo "   Files: SKILL.md + $(ls "$TARGET/references/" | wc -l | tr -d ' ') references"
