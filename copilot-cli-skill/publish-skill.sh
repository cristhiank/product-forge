#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_NAME="copilot-cli-skill"
TARGET="$HOME/.copilot/skills/$SKILL_NAME"

echo "📦 Publishing $SKILL_NAME skill..."
echo "   Source: $SCRIPT_DIR"
echo "   Target: $TARGET"

cd "$SCRIPT_DIR"

rm -rf "$TARGET"
mkdir -p "$TARGET"

cp SKILL.md "$TARGET/"
cp -R references/ "$TARGET/references/"
cp -R scripts/ "$TARGET/scripts/"

echo "✅ Published to $TARGET"
ls -la "$TARGET"
