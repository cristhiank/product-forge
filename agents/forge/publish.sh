#!/usr/bin/env bash
set -euo pipefail

# Forge Publisher — builds the plugin and installs it locally.
#
# This is a convenience wrapper around build-plugin.sh.
# The plugin system is now the canonical distribution method.
#
# Usage:
#   ./publish.sh                # build + install plugin
#   ./publish.sh --dry-run      # preview without installing

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔨 Forge Publisher (via plugin system)"
echo ""

# Build the plugin
"$REPO_ROOT/build-plugin.sh" "$@"

# Install unless dry-run
if [[ ! " $* " =~ " --dry-run " ]]; then
  echo ""
  echo "🚀 Installing plugin..."
  copilot plugin uninstall forge 2>/dev/null || true
  copilot plugin install "$REPO_ROOT/dist"
  echo ""
  copilot plugin list
fi
