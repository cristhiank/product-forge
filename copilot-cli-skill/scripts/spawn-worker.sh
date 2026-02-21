#!/usr/bin/env bash
set -euo pipefail

# spawn-worker.sh - Spawn a Copilot CLI worker in an isolated git worktree
#
# Usage:
#   spawn-worker.sh --prompt "implement feature X" [options]
#
# Options:
#   --prompt <text>          Prompt for the Copilot CLI worker (required)
#   --agent <agent>          Custom agent (e.g., Scout, Executor, Planner)
#   --model <model>          Model override (e.g., claude-opus-4.6)
#   --worktree-base <path>   Base directory for worktrees (default: ../worktrees/)
#   --branch-prefix <prefix> Branch name prefix (default: worker)
#   --add-dir <dir>          Allow access to directory (repeatable)
#   --allow-all-paths        Allow all paths (disables --add-dir)
#   --allow-all-urls         Allow all URL access
#   --autopilot              Enable autopilot mode

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# JSON escape helper
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

# Defaults
WORKTREE_BASE="../worktrees"
BRANCH_PREFIX="worker"
PROMPT=""
AGENT=""
MODEL=""
declare -a ADD_DIRS
ALLOW_ALL_PATHS=false
ALLOW_ALL_URLS=false
AUTOPILOT=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --prompt)
      PROMPT="$2"
      shift 2
      ;;
    --agent)
      AGENT="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --worktree-base)
      WORKTREE_BASE="$2"
      shift 2
      ;;
    --branch-prefix)
      BRANCH_PREFIX="$2"
      shift 2
      ;;
    --add-dir)
      ADD_DIRS+=("$2")
      shift 2
      ;;
    --allow-all-paths)
      ALLOW_ALL_PATHS=true
      shift
      ;;
    --allow-all-urls)
      ALLOW_ALL_URLS=true
      shift
      ;;
    --autopilot)
      AUTOPILOT=true
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Validate required arguments
if [[ -z "$PROMPT" ]]; then
  echo "Error: --prompt is required" >&2
  exit 1
fi

# Generate worker ID
if command -v uuidgen &> /dev/null; then
  WORKER_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
else
  # Fallback: date-based ID
  WORKER_ID="worker-$(date +%Y%m%d-%H%M%S)-$$"
fi

# Resolve worktree path
mkdir -p "$REPO_ROOT/$WORKTREE_BASE" 2>/dev/null || mkdir -p "$WORKTREE_BASE"
WORKTREE_ABS="$(cd "$REPO_ROOT" && cd "$WORKTREE_BASE" && pwd)"
WORKTREE_PATH="$WORKTREE_ABS/$WORKER_ID"

# Branch name
BRANCH_NAME="$BRANCH_PREFIX/$WORKER_ID"

# State directory
STATE_DIR="$REPO_ROOT/.copilot-workers/$WORKER_ID"
mkdir -p "$STATE_DIR"

# Create worktree
cd "$REPO_ROOT"
if ! git worktree add -b "$BRANCH_NAME" "$WORKTREE_PATH" HEAD >/dev/null 2>&1; then
  echo "Error: Failed to create git worktree" >&2
  exit 1
fi

# Build copilot command as array
COPILOT_CMD=(copilot --allow-all-tools)

if [[ -n "$AGENT" ]]; then
  COPILOT_CMD+=(--agent "$AGENT")
fi

if [[ -n "$MODEL" ]]; then
  COPILOT_CMD+=(--model "$MODEL")
fi

if [[ "$ALLOW_ALL_PATHS" == "true" ]]; then
  COPILOT_CMD+=(--allow-all-paths)
else
  if [[ ${#ADD_DIRS[@]} -gt 0 ]]; then
    for dir in "${ADD_DIRS[@]}"; do
      COPILOT_CMD+=(--add-dir "$dir")
    done
  fi
fi

if [[ "$ALLOW_ALL_URLS" == "true" ]]; then
  COPILOT_CMD+=(--allow-all-urls)
fi

if [[ "$AUTOPILOT" == "true" ]]; then
  COPILOT_CMD+=(--autopilot)
fi

COPILOT_CMD+=("$PROMPT")

# Spawn detached copilot process
cd "$WORKTREE_PATH"
OUTPUT_LOG="$STATE_DIR/output.log"
nohup "${COPILOT_CMD[@]}" > "$OUTPUT_LOG" 2>&1 &
WORKER_PID=$!

# Disown to fully detach
disown

# Write PID file
echo "$WORKER_PID" > "$STATE_DIR/worker.pid"

# Write metadata
cat > "$STATE_DIR/meta.json" <<EOF
{
  "worker_id": "$(json_escape "$WORKER_ID")",
  "pid": $WORKER_PID,
  "worktree_path": "$(json_escape "$WORKTREE_PATH")",
  "branch_name": "$(json_escape "$BRANCH_NAME")",
  "prompt": "$(json_escape "$PROMPT")",
  "agent": "$(json_escape "$AGENT")",
  "model": "$(json_escape "$MODEL")",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "running"
}
EOF

# Output JSON result
printf '{\n'
printf '  "worker_id": "%s",\n' "$(json_escape "$WORKER_ID")"
printf '  "pid": %d,\n' "$WORKER_PID"
printf '  "worktree_path": "%s",\n' "$(json_escape "$WORKTREE_PATH")"
printf '  "branch_name": "%s",\n' "$(json_escape "$BRANCH_NAME")"
printf '  "state_dir": "%s",\n' "$(json_escape "$STATE_DIR")"
printf '  "output_log": "%s",\n' "$(json_escape "$OUTPUT_LOG")"
printf '  "status": "running"\n'
printf '}\n'
