"""Session grading logic for Forge dispatch-discipline evals.

Scores a parsed session based on how well the coordinator delegates
instead of performing mutations directly.
"""

from dataclasses import dataclass, field

from parsing import Turn, _is_mutating_bash


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
