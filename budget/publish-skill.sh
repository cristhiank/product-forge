#!/usr/bin/env bash
set -euo pipefail

SKILL_NAME="budget-planner"
TARGET="$HOME/.copilot/skills/$SKILL_NAME"

echo "Building budget engine..."
npm run build
npm run bundle

echo "Publishing $SKILL_NAME skill..."
rm -rf "$TARGET"
mkdir -p "$TARGET/scripts" "$TARGET/references"

cp SKILL.md "$TARGET/"
cp scripts/budget.js "$TARGET/scripts/"
cp references/*.md "$TARGET/references/"

echo "✅ Published to $TARGET"
ls -la "$TARGET"
echo ""
echo "Bundle size: $(wc -c < "$TARGET/scripts/budget.js") bytes"
