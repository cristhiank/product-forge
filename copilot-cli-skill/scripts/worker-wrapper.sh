#!/bin/sh
#
# Wrapper script for copilot worker processes.
# Captures exit code and writes exit.json with completion metadata.
#
# Usage: worker-wrapper.sh <copilot-args>
# Environment: WORKER_STATE_DIR must be set

if [ -z "$WORKER_STATE_DIR" ]; then
  echo "ERROR: WORKER_STATE_DIR not set" >&2
  exit 1
fi

# Run copilot as a child process so traps can forward shutdown signals.
CHILD_PID=""
EXIT_CODE=0

write_exit_json() {
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  cat > "$WORKER_STATE_DIR/exit.json" <<EOF
{
  "exitCode": $EXIT_CODE,
  "completedAt": "$TIMESTAMP"
}
EOF
}

handle_shutdown() {
  if [ -n "$CHILD_PID" ]; then
    kill -TERM "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID"
    EXIT_CODE=$?
  else
    EXIT_CODE=143
  fi

  write_exit_json
  exit "$EXIT_CODE"
}

trap 'handle_shutdown' TERM INT HUP

copilot "$@" &
CHILD_PID=$!
wait "$CHILD_PID"
EXIT_CODE=$?

write_exit_json

# Exit with the same code
exit $EXIT_CODE
