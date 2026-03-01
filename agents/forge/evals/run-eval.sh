#!/usr/bin/env bash
set -euo pipefail

# Forge Eval Runner — spawns a Copilot session with --agent Forge,
# sends a test prompt, then grades the session transcript.
#
# Usage:
#   ./run-eval.sh "implement the auth endpoint"
#   ./run-eval.sh                              # runs all test cases

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GRADER="$SCRIPT_DIR/grade-session.py"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

# Test cases: prompts that SHOULD trigger dispatch (not inline execution)
declare -a TEST_CASES=(
  "implement the auth endpoint for user login"
  "fix the pricing calculation bug in PricingEngine.cs"
  "proceed with the backlog items"
  "refactor the memory extraction pipeline"
  "look at the auth module and understand how it works"
)

run_eval() {
  local prompt="$1"
  local label
  label=$(echo "$prompt" | tr ' ' '_' | cut -c1-40)
  local timestamp
  timestamp=$(date +%Y%m%d_%H%M%S)
  local run_id="${timestamp}_${label}"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  EVAL: $prompt"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Run copilot in non-interactive prompt mode
  local session_output
  session_output=$(copilot \
    --agent Forge \
    --prompt "$prompt" \
    --allow-all-tools \
    --max-autopilot-continues 3 \
    --model claude-sonnet-4.6 \
    --no-color \
    2>&1) || true

  # Find the most recent session
  local latest_session
  latest_session=$(ls -t ~/.copilot/session-state/ | head -1)

  if [ -z "$latest_session" ]; then
    echo "  ❌ No session found"
    return 1
  fi

  local session_dir="$HOME/.copilot/session-state/$latest_session"

  # Save output
  echo "$session_output" > "$RESULTS_DIR/${run_id}.output.txt"

  # Grade it
  echo ""
  python3 "$GRADER" "$session_dir" | tee "$RESULTS_DIR/${run_id}.grade.txt"

  return 0
}

if [ $# -ge 1 ]; then
  # Run single eval
  run_eval "$1"
else
  # Run all test cases
  echo "🔨 Forge Eval Suite — $(date)"
  echo "   Test cases: ${#TEST_CASES[@]}"
  echo ""

  PASS=0
  FAIL=0
  for tc in "${TEST_CASES[@]}"; do
    if run_eval "$tc"; then
      PASS=$((PASS + 1))
    else
      FAIL=$((FAIL + 1))
    fi
  done

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  SUMMARY: $PASS passed, $FAIL failed (${#TEST_CASES[@]} total)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi
