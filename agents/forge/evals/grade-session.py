#!/usr/bin/env python3
"""Grade a Forge agent session for dispatch discipline.

Reads events.jsonl from a Copilot CLI session and scores the coordinator's
adherence to dispatch-only behavior.

Usage:
  python grade-session.py <session-dir-or-id>
  python grade-session.py ~/.copilot/session-state/<uuid>
  python grade-session.py <uuid>  # auto-resolves from ~/.copilot/session-state/
"""

import json
import re
import sys
import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

# --- Violation definitions ---

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
    "node ", "git ", "grep ", "jq ", "head ", "tail ",
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


@dataclass
class Violation:
    turn: int
    tool: str
    detail: str
    severity: str  # P0, P1, P2


@dataclass
class SessionGrade:
    session_id: str
    agent: str = ""
    total_turns: int = 0
    user_turns: int = 0
    dispatches: int = 0
    inline_edits: int = 0
    inline_creates: int = 0
    mutating_bashes: int = 0
    skill_loads: int = 0
    pressure_turns: int = 0
    pressure_correctly_dispatched: int = 0
    violations: list = field(default_factory=list)
    score: float = 0.0
    grade: str = ""


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


def grade_session(turns: list[Turn], agent: str) -> SessionGrade:
    """Grade the session based on dispatch discipline."""
    g = SessionGrade(session_id="", agent=agent)
    g.total_turns = len(turns)
    g.user_turns = sum(1 for t in turns if t.user_message)

    for t in turns:
        if t.has_task_dispatch:
            g.dispatches += 1
        if t.has_edit:
            g.inline_edits += 1
            g.violations.append(Violation(
                turn=t.index, tool="edit",
                detail=f"Coordinator used edit tool directly",
                severity="P0"
            ))
        if t.has_create:
            g.inline_creates += 1
            g.violations.append(Violation(
                turn=t.index, tool="create",
                detail=f"Coordinator used create tool directly",
                severity="P0"
            ))
        if t.has_mutating_bash:
            g.mutating_bashes += 1
            cmds = [c for c in t.bash_commands if _is_mutating_bash(c)]
            g.violations.append(Violation(
                turn=t.index, tool="bash",
                detail=f"Mutating bash: {cmds[0][:80] if cmds else '?'}",
                severity="P1"
            ))
        if t.has_skill_load:
            g.skill_loads += 1

        if t.is_pressure_signal:
            g.pressure_turns += 1
            if t.has_task_dispatch and not t.has_edit and not t.has_create:
                g.pressure_correctly_dispatched += 1

    # Scoring
    total_actions = g.dispatches + g.inline_edits + g.inline_creates + g.mutating_bashes
    if total_actions == 0:
        g.score = 100.0  # No code actions taken (pure Q&A session)
    else:
        correct = g.dispatches
        incorrect = g.inline_edits + g.inline_creates + g.mutating_bashes
        g.score = (correct / total_actions) * 100

    if g.score >= 95:
        g.grade = "A"
    elif g.score >= 80:
        g.grade = "B"
    elif g.score >= 60:
        g.grade = "C"
    elif g.score >= 40:
        g.grade = "D"
    else:
        g.grade = "F"

    return g


def print_report(g: SessionGrade, turns: list[Turn]):
    """Print the grading report."""
    print(f"\n{'='*60}")
    print(f"  FORGE EVAL: Dispatch Discipline Report")
    print(f"{'='*60}")
    print(f"  Session:  {g.session_id}")
    print(f"  Agent:    {g.agent or 'unknown'}")
    print(f"  Turns:    {g.user_turns} user / {g.total_turns} total")
    print(f"{'='*60}\n")

    print(f"  📊 SCORE: {g.score:.0f}% — Grade {g.grade}\n")

    print(f"  ✅ Dispatches (task):       {g.dispatches}")
    print(f"  ❌ Inline edits:            {g.inline_edits}")
    print(f"  ❌ Inline creates:          {g.inline_creates}")
    print(f"  ❌ Mutating bash:           {g.mutating_bashes}")
    print(f"  🔧 Skill loads:            {g.skill_loads}")

    if g.pressure_turns > 0:
        print(f"\n  ⚡ Pressure Signals:")
        print(f"     Detected:               {g.pressure_turns}")
        correct = g.pressure_correctly_dispatched
        pct = (correct / g.pressure_turns * 100) if g.pressure_turns else 0
        print(f"     Correctly dispatched:   {correct}/{g.pressure_turns} ({pct:.0f}%)")

    if g.violations:
        print(f"\n  {'—'*50}")
        print(f"  ⚠️  VIOLATIONS ({len(g.violations)})")
        print(f"  {'—'*50}")
        for v in g.violations[:20]:
            print(f"  [{v.severity}] Turn {v.turn}: {v.tool} — {v.detail}")
        if len(g.violations) > 20:
            print(f"  ... and {len(g.violations) - 20} more")
    else:
        print(f"\n  ✅ No violations detected!")

    # Per-turn breakdown
    print(f"\n  {'—'*50}")
    print(f"  Turn-by-turn (code-touching turns only)")
    print(f"  {'—'*50}")
    shown = 0
    for t in turns:
        tools = set(t.tools_used)
        if tools & (MUTATING_TOOLS | DISPATCH_TOOLS):
            status = "✅" if t.has_task_dispatch and not t.has_edit and not t.has_create else "❌"
            pressure = " ⚡" if t.is_pressure_signal else ""
            msg = t.user_message[:60] if t.user_message else "(continuation)"
            actions = []
            if t.has_task_dispatch:
                actions.append("task()")
            if t.has_edit:
                actions.append("edit")
            if t.has_create:
                actions.append("create")
            if t.has_mutating_bash:
                actions.append("bash!")
            print(f"  {status} T{t.index:02d}{pressure}: {msg}")
            print(f"       Actions: {', '.join(actions)}")
            shown += 1
    if shown == 0:
        print("  (no code-touching turns)")

    print(f"\n{'='*60}\n")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    target = sys.argv[1]
    session_dir = Path(target)

    # Auto-resolve UUID
    if not session_dir.exists():
        candidate = Path.home() / ".copilot" / "session-state" / target
        if candidate.exists():
            session_dir = candidate
        else:
            print(f"Error: '{target}' not found")
            sys.exit(1)

    events_path = session_dir / "events.jsonl"
    if not events_path.exists():
        print(f"Error: no events.jsonl in {session_dir}")
        sys.exit(1)

    turns, agent = parse_session(events_path)
    grade = grade_session(turns, agent)
    grade.session_id = session_dir.name

    print_report(grade, turns)

    # Exit code reflects grade
    sys.exit(0 if grade.grade in ("A", "B") else 1)


if __name__ == "__main__":
    main()
