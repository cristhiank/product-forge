#!/usr/bin/env bash
set -euo pipefail

SKILL_NAME="invoice-parser"
TARGET="$HOME/.copilot/skills/$SKILL_NAME"

echo "Publishing $SKILL_NAME skill..."
rm -rf "$TARGET"
mkdir -p "$TARGET"

cp SKILL.md "$TARGET/"
cp -R references/ "$TARGET/references/"
cp -R scripts/ "$TARGET/scripts/"

echo "✅ Published to $TARGET"
ls -la "$TARGET"
