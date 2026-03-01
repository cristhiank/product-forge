"""Report printing for Forge dispatch-discipline evals.

Formats and prints a human-readable grading report to stdout.
"""

from grading import SessionGrade
from parsing import Turn, MUTATING_TOOLS, DISPATCH_TOOLS


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
