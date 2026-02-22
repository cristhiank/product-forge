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

# Run copilot with all arguments (no set -e — we must capture the exit code)
copilot "$@"
EXIT_CODE=$?

# Write exit metadata
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "$WORKER_STATE_DIR/exit.json" <<EOF
{
  "exitCode": $EXIT_CODE,
  "completedAt": "$TIMESTAMP"
}
EOF

# Exit with the same code
exit $EXIT_CODE
