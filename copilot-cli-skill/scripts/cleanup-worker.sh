#!/usr/bin/env bash
set -euo pipefail

# cleanup-worker.sh - Clean up a Copilot CLI worker and its worktree
#
# Usage:
#   cleanup-worker.sh <worker-id> [--force]
#
# Options:
#   --force    Kill the process even if graceful shutdown fails

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

WORKER_ID=""
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE=true
      shift
      ;;
    *)
      if [[ -z "$WORKER_ID" ]]; then
        WORKER_ID="$1"
        shift
      else
        echo "Unknown option: $1" >&2
        exit 1
      fi
      ;;
  esac
done

# Validate required arguments
if [[ -z "$WORKER_ID" ]]; then
  echo "Error: worker-id is required" >&2
  echo "Usage: cleanup-worker.sh <worker-id> [--force]" >&2
  exit 1
fi

STATE_DIR="$REPO_ROOT/.copilot-workers/$WORKER_ID"

# Check if worker exists
if [[ ! -d "$STATE_DIR" ]]; then
  echo "Error: Worker $WORKER_ID not found" >&2
  exit 1
fi

# Read metadata
if [[ ! -f "$STATE_DIR/meta.json" ]]; then
  echo "Error: Worker metadata not found" >&2
  exit 1
fi

# Extract metadata using grep/sed (no jq dependency)
WORKTREE_PATH=$(grep -o '"worktree_path": "[^"]*"' "$STATE_DIR/meta.json" | sed 's/"worktree_path": "\(.*\)"/\1/')
BRANCH_NAME=$(grep -o '"branch_name": "[^"]*"' "$STATE_DIR/meta.json" | sed 's/"branch_name": "\(.*\)"/\1/')

# Read PID
if [[ -f "$STATE_DIR/worker.pid" ]]; then
  WORKER_PID=$(cat "$STATE_DIR/worker.pid")
  
  # Check if process is running
  if kill -0 "$WORKER_PID" 2>/dev/null; then
    # Process is running, attempt graceful shutdown
    echo "Stopping worker process $WORKER_PID..." >&2
    kill "$WORKER_PID" 2>/dev/null || true
    
    # Wait for graceful shutdown (max 5 seconds)
    for i in {1..10}; do
      if ! kill -0 "$WORKER_PID" 2>/dev/null; then
        break
      fi
      sleep 0.5
    done
    
    # Check if still running
    if kill -0 "$WORKER_PID" 2>/dev/null; then
      if [[ "$FORCE" == "true" ]]; then
        echo "Force killing worker process $WORKER_PID..." >&2
        kill -9 "$WORKER_PID" 2>/dev/null || true
      else
        echo "Error: Process $WORKER_PID still running. Use --force to kill." >&2
        exit 1
      fi
    fi
  fi
fi

# Remove worktree
if [[ -n "$WORKTREE_PATH" ]] && [[ -d "$WORKTREE_PATH" ]]; then
  cd "$REPO_ROOT"
  echo "Removing worktree at $WORKTREE_PATH..." >&2
  git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || true
fi

# Delete branch
if [[ -n "$BRANCH_NAME" ]]; then
  cd "$REPO_ROOT"
  echo "Deleting branch $BRANCH_NAME..." >&2
  git branch -D "$BRANCH_NAME" 2>/dev/null || true
fi

# Remove state directory
echo "Removing state directory..." >&2
rm -rf "$STATE_DIR"

# Prune worktrees (cleanup stale references)
cd "$REPO_ROOT"
git worktree prune 2>/dev/null || true

# Output JSON result
printf '{\n'
printf '  "worker_id": "%s",\n' "$WORKER_ID"
printf '  "status": "cleaned",\n'
printf '  "worktree_removed": true,\n'
printf '  "branch_deleted": true,\n'
printf '  "state_removed": true\n'
printf '}\n'
