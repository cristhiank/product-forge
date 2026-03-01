"""Session event parsing for Forge dispatch-discipline evals.

Reads events.jsonl and produces structured Turn objects for downstream grading.
"""

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# --- Constants ---

MUTATING_TOOLS = {"edit", "create"}
# Command patterns must appear at the start of a command segment (after && ; ||)
# to avoid false positives when they appear inside quoted arguments.
MUTATING_BASH_COMMANDS = [
    "npm run build", "npm test", "dotnet build", "dotnet test", "dotnet run",
    "pytest", "cargo build", "cargo test", "make", "go build", "go test",
    "npm install", "pip install", "dotnet add",
]
# Operator patterns are checked per-segment (not across the full command)
# to avoid false positives when operators appear in CLI tool arguments.
MUTATING_BASH_OPERATORS = [
    "sed -i", "awk -i", "perl -pi", "patch ",
    "echo >", "cat >", "tee ", ">>",
]
# Segments starting with these prefixes are known-safe CLI tool invocations
# (backlog CLI, hub CLI, git, read-only utilities) and skip mutation checks.
SAFE_SEGMENT_PREFIXES = [
    "node ", "git ", "grep ", "jq ", "cat ", "head ", "tail ",
    "ls ", "find ", "wc ", "sort ", "uniq ", "which ", "pwd",
]
DISPATCH_TOOLS = {"task"}
SKILL_TOOLS = {"skill"}

PRESSURE_SIGNALS = [
    "proceed", "do it", "just fix it", "keep going", "do your job",
    "continue", "yes", "go ahead", "implement", "build it",
]


def _is_mutating_bash(cmd: str) -> bool:
    """Check if a bash command is mutating, avoiding false positives from arguments."""
    # Neutralize quoted strings so patterns inside args don't trigger matches
    stripped = re.sub(r'"[^"]*"|\'[^\']*\'', '""', cmd)
    for seg in re.split(r'\s*(?:&&|\|\||[;|])\s*', stripped):
        seg = seg.strip()
        if not seg:
            continue
        # Skip known-safe CLI tool invocations (backlog, hub, git, etc.)
        if any(seg.startswith(p) for p in SAFE_SEGMENT_PREFIXES):
            continue
        # Check operator patterns per-segment (not full command) to avoid
        # false positives from operators inside CLI tool arguments.
        for pattern in MUTATING_BASH_OPERATORS:
            if pattern in seg:
                return True
        for pattern in MUTATING_BASH_COMMANDS:
            if seg.startswith(pattern):
                # Word boundary: pattern must be followed by whitespace or end
                rest = seg[len(pattern):]
                if not rest or rest[0].isspace():
                    return True
    return False


@dataclass
class Turn:
    index: int
    user_message: str = ""
    tools_used: list = field(default_factory=list)
    has_task_dispatch: bool = False
    has_skill_load: bool = False
    has_edit: bool = False
    has_create: bool = False
    has_mutating_bash: bool = False
    bash_commands: list = field(default_factory=list)
    assistant_content: str = ""
    is_pressure_signal: bool = False


def parse_session(events_path: Path) -> tuple[list[Turn], str]:
    """Parse events.jsonl into turns."""
    turns = []
    current_turn: Optional[Turn] = None
    turn_idx = 0
    agent = ""

    with open(events_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            event = json.loads(line)
            etype = event.get("type", "")
            data = event.get("data", {})

            if etype == "session.start":
                ctx = data.get("context", {})
                agent = ctx.get("agent", data.get("agent", ""))

            elif etype == "user.message":
                current_turn = Turn(index=turn_idx)
                current_turn.user_message = data.get("content", "")
                msg_lower = current_turn.user_message.lower().strip()
                for sig in PRESSURE_SIGNALS:
                    if msg_lower == sig or msg_lower.startswith(sig + " ") or msg_lower.startswith(sig + ","):
                        current_turn.is_pressure_signal = True
                        break
                turns.append(current_turn)
                turn_idx += 1

            elif etype == "assistant.message" and current_turn:
                current_turn.assistant_content += data.get("content", "")

            elif etype == "tool.execution_start" and current_turn:
                tool_name = data.get("toolName", "")
                args = data.get("arguments", {})
                current_turn.tools_used.append(tool_name)

                if tool_name in MUTATING_TOOLS:
                    if tool_name == "edit":
                        current_turn.has_edit = True
                    elif tool_name == "create":
                        current_turn.has_create = True

                elif tool_name in DISPATCH_TOOLS:
                    current_turn.has_task_dispatch = True

                elif tool_name in SKILL_TOOLS:
                    current_turn.has_skill_load = True

                elif tool_name == "bash":
                    cmd = args.get("command", "")
                    current_turn.bash_commands.append(cmd)
                    if _is_mutating_bash(cmd):
                        current_turn.has_mutating_bash = True

    return turns, agent
