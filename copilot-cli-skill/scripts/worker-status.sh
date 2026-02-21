#!/usr/bin/env bash
set -euo pipefail

# worker-status.sh - Check status of a Copilot CLI worker
#
# Usage:
#   worker-status.sh [worker-id]
#   worker-status.sh --list
#
# Options:
#   --list    List all workers (default if no worker-id provided)

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

WORKER_ID=""
LIST_MODE=false

# Parse arguments
if [[ $# -eq 0 ]] || [[ "$1" == "--list" ]]; then
  LIST_MODE=true
else
  WORKER_ID="$1"
fi

WORKERS_DIR="$REPO_ROOT/.copilot-workers"

# List mode: show all workers
if [[ "$LIST_MODE" == "true" ]]; then
  if [[ ! -d "$WORKERS_DIR" ]] || [[ -z "$(ls -A "$WORKERS_DIR" 2>/dev/null)" ]]; then
    printf '{\n'
    printf '  "workers": []\n'
    printf '}\n'
    exit 0
  fi
  
  printf '{\n'
  printf '  "workers": [\n'
  
  FIRST=true
  for STATE_DIR in "$WORKERS_DIR"/*; do
    if [[ ! -d "$STATE_DIR" ]]; then
      continue
    fi
    
    WORKER_ID=$(basename "$STATE_DIR")
    
    if [[ "$FIRST" == "true" ]]; then
      FIRST=false
    else
      printf ',\n'
    fi
    
    printf '    {\n'
    printf '      "worker_id": "%s",\n' "$(json_escape "$WORKER_ID")"
    
    # Read PID and check status
    if [[ -f "$STATE_DIR/worker.pid" ]]; then
      WORKER_PID=$(cat "$STATE_DIR/worker.pid")
      if kill -0 "$WORKER_PID" 2>/dev/null; then
        printf '      "pid": %d,\n' "$WORKER_PID"
        printf '      "status": "running"\n'
      else
        printf '      "pid": %d,\n' "$WORKER_PID"
        printf '      "status": "stopped"\n'
      fi
    else
      printf '      "pid": null,\n'
      printf '      "status": "unknown"\n'
    fi
    
    printf '    }'
  done
  
  printf '\n  ]\n'
  printf '}\n'
  exit 0
fi

# Single worker mode
STATE_DIR="$WORKERS_DIR/$WORKER_ID"

if [[ ! -d "$STATE_DIR" ]]; then
  printf '{\n'
  printf '  "error": "Worker not found",\n'
  printf '  "worker_id": "%s"\n' "$(json_escape "$WORKER_ID")"
  printf '}\n'
  exit 1
fi

# Read metadata
if [[ ! -f "$STATE_DIR/meta.json" ]]; then
  printf '{\n'
  printf '  "error": "Metadata not found",\n'
  printf '  "worker_id": "%s"\n' "$(json_escape "$WORKER_ID")"
  printf '}\n'
  exit 1
fi

# Extract metadata using grep/sed
WORKTREE_PATH=$(grep -o '"worktree_path": "[^"]*"' "$STATE_DIR/meta.json" | sed 's/"worktree_path": "\(.*\)"/\1/')
BRANCH_NAME=$(grep -o '"branch_name": "[^"]*"' "$STATE_DIR/meta.json" | sed 's/"branch_name": "\(.*\)"/\1/')
PROMPT=$(grep -o '"prompt": "[^"]*"' "$STATE_DIR/meta.json" | sed 's/"prompt": "\(.*\)"/\1/')
STARTED_AT=$(grep -o '"started_at": "[^"]*"' "$STATE_DIR/meta.json" | sed 's/"started_at": "\(.*\)"/\1/')

AGENT=$(grep -o '"agent": "[^"]*"' "$STATE_DIR/meta.json" | sed 's/"agent": "\(.*\)"/\1/' || echo "")
MODEL=$(grep -o '"model": "[^"]*"' "$STATE_DIR/meta.json" | sed 's/"model": "\(.*\)"/\1/' || echo "")

# Read PID and validate
WORKER_PID=""
STATUS="unknown"

if [[ -f "$STATE_DIR/worker.pid" ]]; then
  WORKER_PID=$(cat "$STATE_DIR/worker.pid")
  if kill -0 "$WORKER_PID" 2>/dev/null; then
    STATUS="running"
  else
    STATUS="stopped"
  fi
fi

# Check if worktree exists
WORKTREE_EXISTS=false
if [[ -d "$WORKTREE_PATH" ]]; then
  WORKTREE_EXISTS=true
fi

# Check output log size
OUTPUT_LOG="$STATE_DIR/output.log"
LOG_SIZE=0
LOG_LINES=0
if [[ -f "$OUTPUT_LOG" ]]; then
  LOG_SIZE=$(wc -c < "$OUTPUT_LOG" | tr -d ' ')
  LOG_LINES=$(wc -l < "$OUTPUT_LOG" | tr -d ' ')
fi

# Output JSON
printf '{\n'
printf '  "worker_id": "%s",\n' "$(json_escape "$WORKER_ID")"
printf '  "status": "%s",\n' "$STATUS"

if [[ -n "$WORKER_PID" ]]; then
  printf '  "pid": %d,\n' "$WORKER_PID"
else
  printf '  "pid": null,\n'
fi

printf '  "worktree_path": "%s",\n' "$(json_escape "$WORKTREE_PATH")"
printf '  "worktree_exists": %s,\n' "$WORKTREE_EXISTS"
printf '  "branch_name": "%s",\n' "$(json_escape "$BRANCH_NAME")"
printf '  "prompt": "%s",\n' "$(json_escape "$PROMPT")"

if [[ -n "$AGENT" ]]; then
  printf '  "agent": "%s",\n' "$(json_escape "$AGENT")"
else
  printf '  "agent": null,\n'
fi

if [[ -n "$MODEL" ]]; then
  printf '  "model": "%s",\n' "$(json_escape "$MODEL")"
else
  printf '  "model": null,\n'
fi

printf '  "started_at": "%s",\n' "$STARTED_AT"
printf '  "output_log": "%s",\n' "$(json_escape "$OUTPUT_LOG")"
printf '  "log_size_bytes": %d,\n' "$LOG_SIZE"
printf '  "log_lines": %d\n' "$LOG_LINES"
printf '}\n'
