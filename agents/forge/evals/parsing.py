"""Session event parsing for Forge dispatch-discipline evals.

Reads events.jsonl and produces structured Turn objects for downstream grading.
"""

import json
import os
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
MUTATING_BASH_OPERATOR_PATTERNS = [
    r"\bsed\s+-i\b",
    r"\bawk\s+-i\b",
    r"\bperl\s+-pi\b",
    r"\bpatch\b",
    r"\becho\s*>",
    r"\bcat\s*>",
    r"\btee\b",
    r">>",
]
# Segments starting with these prefixes are known-safe CLI tool invocations
# (backlog CLI, hub CLI, git, read-only utilities) and skip mutation checks.
SAFE_SEGMENT_PREFIXES = [
    "node ", "git ", "grep ", "jq ", "cat ", "head ", "tail ",
    "ls ", "find ", "wc ", "sort ", "uniq ", "which ", "pwd",
    "python3 ", "python ", "cd ", "pushd ", "popd ",
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
    stripped = re.sub(r'"[^"]*"|\'[^\']*\'|`[^`]*`', '""', cmd)
    for seg in re.split('\\s*(?:&&|\\|\\||[;|\x07])\\s*', stripped):
        seg = re.sub(r'[\x00-\x1f]', ' ', seg).strip()
        # Strip leading env var assignments (e.g. NODE_ENV=prod ...)
        while re.match(r'[A-Za-z_]\w*=\S+\s', seg):
            seg = re.sub(r'^[A-Za-z_]\w*=\S+\s+', '', seg)
        if not seg:
            continue
        seg_lower = seg.lower()
        # Check for mutating operators FIRST (before safe prefixes)
        for pattern in MUTATING_BASH_OPERATOR_PATTERNS:
            if re.search(pattern, seg_lower):
                return True
        # Skip known-safe CLI tool invocations (backlog, hub, git, etc.)
        if any(seg_lower.startswith(p) for p in SAFE_SEGMENT_PREFIXES):
            continue
        # Skip MCP bootstrap/shell setup segments that are non-mutating.
        if re.match(r'^[^a-z0-9]*(?:n?pm|pnpm|yarn)\s+exec\s+.*\bmcp\b', seg_lower):
            continue
        if "\\windows\\system32\\cmd.exe" in seg_lower:
            continue
        # Check mutating commands
        for pattern in MUTATING_BASH_COMMANDS:
            if seg_lower.startswith(pattern):
                # Word boundary: pattern must be followed by whitespace or end
                rest = seg[len(pattern):]
                if not rest or rest[0].isspace():
                    return True
        # Default: unrecognized command is treated as mutating
        return True
    return False


def _is_workspace_path(path: str, workspace_root: str) -> bool:
    """True when path is inside the evaluated workspace (or unknown)."""
    if not path or not workspace_root:
        return True
    try:
        path_norm = os.path.normcase(os.path.abspath(path))
        root_norm = os.path.normcase(os.path.abspath(workspace_root))
        return os.path.commonpath([path_norm, root_norm]) == root_norm
    except Exception:
        return True


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
    has_clarification: bool = False
    bash_commands: list = field(default_factory=list)
    assistant_content: str = ""
    is_pressure_signal: bool = False


def parse_session(events_path: Path) -> tuple[list[Turn], str]:
    """Parse events.jsonl into turns."""
    turns = []
    current_turn: Optional[Turn] = None
    turn_idx = 0
    agent = ""
    workspace_root = ""

    with open(events_path, encoding="utf-8", errors="replace") as f:
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
                workspace_root = ctx.get("gitRoot") or ctx.get("cwd") or workspace_root

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
                content = data.get("content", "")
                current_turn.assistant_content += content
                if "?" in content:
                    current_turn.has_clarification = True

            elif etype == "tool.execution_start" and current_turn:
                tool_name = data.get("toolName", "")
                args = data.get("arguments", {})
                if data.get("parentToolCallId"):
                    continue
                current_turn.tools_used.append(tool_name)

                if tool_name == "ask_user":
                    current_turn.has_clarification = True
                
                if tool_name in MUTATING_TOOLS:
                    if not _is_workspace_path(args.get("path", ""), workspace_root):
                        continue
                    if tool_name == "edit":
                        current_turn.has_edit = True
                    elif tool_name == "create":
                        current_turn.has_create = True

                elif tool_name in DISPATCH_TOOLS:
                    current_turn.has_task_dispatch = True

                elif tool_name in SKILL_TOOLS:
                    current_turn.has_skill_load = True

                elif tool_name in {"bash", "powershell"}:
                    cmd = args.get("command", "")
                    current_turn.bash_commands.append(cmd)
                    if _is_mutating_bash(cmd):
                        current_turn.has_mutating_bash = True

    return turns, agent
