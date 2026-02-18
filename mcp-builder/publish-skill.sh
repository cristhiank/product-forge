#!/usr/bin/env bash
set -euo pipefail

SKILL_NAME="mcp-builder"
TARGET="$HOME/.copilot/skills/$SKILL_NAME"

echo "Publishing $SKILL_NAME skill..."
rm -rf "$TARGET"
mkdir -p "$TARGET"

cp SKILL.md "$TARGET/"
cp -R reference/ "$TARGET/reference/"
cp -R scripts/ "$TARGET/scripts/"

echo "✅ Published to $TARGET"
ls -la "$TARGET"
