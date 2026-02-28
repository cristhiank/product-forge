#!/usr/bin/env bash
set -euo pipefail

# Publish experts-council skill to ~/.copilot/skills/experts-council/
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_NAME="$(basename "$SCRIPT_DIR")"
TARGET="${1:-$HOME/.copilot/skills/$SKILL_NAME}"

echo "📦 Publishing $SKILL_NAME skill..."
echo "   Source: $SCRIPT_DIR"
echo "   Target: $TARGET"

mkdir -p "$TARGET"

cp "$SCRIPT_DIR/SKILL.md" "$TARGET/"

echo "✅ Published to $TARGET"
