#!/usr/bin/env python3
"""Forge Loop Eval Runner — Multi-phase workflow evaluation.

Runs the 7 workflow loop evals against the Forge agent using either:
- Interactive mode (copilot -i) for 2-3 turn loops
- Resume mode (copilot --resume) for 5+ turn loops

Each turn is graded independently (dispatch discipline, skill loading,
Mission Brief quality) and the final outcome is graded via tests + LLM.

Usage:
  python run-loops.py                       # run all 7 loops
  python run-loops.py --loop loop1          # run specific loop
  python run-loops.py --loop loop5 --skip-llm  # mechanical only
  python run-loops.py --report results/<ts> # aggregate past run
"""

import json
import subprocess
import sys
import os
import re
import time
import shutil
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field

SCRIPT_DIR = Path(__file__).parent
LOOP_CASES_FILE = SCRIPT_DIR / "loop-test-cases.json"
FIXTURE_DIR = SCRIPT_DIR / "fixtures" / "sample-api"
RESULTS_DIR = SCRIPT_DIR / "results"
SESSION_STATE = Path.home() / ".copilot" / "session-state"


# ── Sandbox Management ──

def create_sandbox(eval_id: str) -> Path:
    sandbox = SCRIPT_DIR / "sandbox" / eval_id
    if sandbox.exists():
        shutil.rmtree(sandbox)
    shutil.copytree(FIXTURE_DIR, sandbox)
    subprocess.run(["git", "init", "-q"], cwd=sandbox, capture_output=True)
    subprocess.run(["git", "add", "."], cwd=sandbox, capture_output=True)
    subprocess.run(
        ["git", "commit", "-q", "-m", "initial: fixture with planted bugs"],
        cwd=sandbox, capture_output=True,
        env={**os.environ, "GIT_AUTHOR_NAME": "eval", "GIT_AUTHOR_EMAIL": "eval@test",
             "GIT_COMMITTER_NAME": "eval", "GIT_COMMITTER_EMAIL": "eval@test"}
    )
    # Install deps if package.json exists
    if (sandbox / "package.json").exists():
        subprocess.run(["npm", "install", "--silent"], cwd=sandbox,
                       capture_output=True, timeout=60)
    return sandbox


def cleanup_sandbox(sandbox: Path):
    if sandbox.exists():
        shutil.rmtree(sandbox)


# ── Session Discovery ──

def find_new_session(before: set) -> str | None:
    after = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()
    new = after - before
    return list(new)[0] if new else None


# ── Mechanical Grading (per-turn) ──

BUILD_PATTERNS = [
    "npm run build", "npm test", "dotnet build", "dotnet test", "dotnet run",
    "pytest", "cargo build", "cargo test", "node --test", "npx tsc",
]
MUTATE_PATTERNS = ["sed -i", "awk -i", "perl -pi", "echo >", "cat >", "tee ", ">>"]


def _is_mutating_bash(cmd: str) -> bool:
    for seg in re.split(r'&&|\|\||;', cmd):
        seg = seg.strip()
        for p in BUILD_PATTERNS + MUTATE_PATTERNS:
            if seg.startswith(p) or (seg.startswith("cd ") and p in seg):
                return True
    return False


@dataclass
class TurnGrade:
    turn_index: int
    prompt: str
    dispatches: int = 0
    inline_edits: int = 0
    inline_creates: int = 0
    mutating_bashes: int = 0
    skills_loaded: list = field(default_factory=list)
    has_clarification: bool = False
    task_prompts: list = field(default_factory=list)
    briefs_with_skill_line: int = 0
    briefs_with_sections: int = 0
    assistant_text: str = ""
    passed: bool = False


def grade_session_per_turn(session_id: str, turn_prompts: list[str]) -> list[TurnGrade]:
    """Grade a session on a per-user-turn basis."""
    events_path = SESSION_STATE / session_id / "events.jsonl"
    if not events_path.exists():
        return []

    turns = []
    current_turn_idx = -1
    current_grade: TurnGrade | None = None

    with open(events_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            event = json.loads(line)
            etype = event.get("type", "")
            data = event.get("data", {})

            if etype == "user.message":
                if current_grade:
                    turns.append(current_grade)
                current_turn_idx += 1
                prompt = turn_prompts[current_turn_idx] if current_turn_idx < len(turn_prompts) else data.get("content", "")[:100]
                current_grade = TurnGrade(turn_index=current_turn_idx, prompt=prompt)

            elif etype == "tool.execution_start" and current_grade:
                tool = data.get("toolName", "")
                args = data.get("arguments", {})

                if tool == "edit":
                    current_grade.inline_edits += 1
                elif tool == "create":
                    current_grade.inline_creates += 1
                elif tool == "task":
                    current_grade.dispatches += 1
                    prompt_text = args.get("prompt", "")
                    current_grade.task_prompts.append(prompt_text[:500])
                    if "invoke the `forge-" in prompt_text.lower():
                        current_grade.briefs_with_skill_line += 1
                    sections = sum(1 for s in ["## Mission", "## Context", "## Constraints", "## Expected"]
                                   if s in prompt_text)
                    if sections >= 3:
                        current_grade.briefs_with_sections += 1
                elif tool == "skill":
                    current_grade.skills_loaded.append(args.get("skill", ""))
                elif tool == "bash":
                    if _is_mutating_bash(args.get("command", "")):
                        current_grade.mutating_bashes += 1
                elif tool == "ask_user":
                    current_grade.has_clarification = True

            elif etype == "assistant.message" and current_grade:
                current_grade.assistant_text += data.get("content", "") + "\n"

    if current_grade:
        turns.append(current_grade)

    return turns


def evaluate_turn(grade: TurnGrade, expected: dict, all_skills_so_far: set = None) -> bool:
    """Check if a turn's behavior matches expectations.
    
    all_skills_so_far: accumulated skills from previous turns (they persist in session).
    """
    passed = True

    if expected.get("expect_dispatch") and grade.dispatches == 0:
        passed = False
    if expected.get("expect_no_edits") and (grade.inline_edits > 0 or grade.inline_creates > 0):
        passed = False
    if expected.get("expect_no_edits") and grade.mutating_bashes > 0:
        passed = False
    # Clarification: only fail if expected AND agent didn't clarify AND didn't dispatch
    # (dispatching with enough context is acceptable alternative to clarifying)
    if expected.get("expect_clarification") and not grade.has_clarification and grade.dispatches == 0:
        passed = False
    # Skill check: consider accumulated skills from prior turns (they persist)
    if expected.get("expect_skills"):
        available = set(grade.skills_loaded)
        if all_skills_so_far:
            available |= all_skills_so_far
        for s in expected["expect_skills"]:
            if s not in available:
                passed = False
    # Parallel workers: if expected, check for copilot-cli-skill or multiple task() calls
    if expected.get("expect_parallel_workers") and grade.dispatches < 2:
        passed = False  # at minimum 2+ dispatches indicate parallelism attempt

    grade.passed = passed
    return passed


# ── Outcome Grading ──

def grade_outcome(sandbox: Path, outcome_spec: dict) -> dict:
    result = {"passed": True, "details": {}}

    if outcome_spec.get("run_tests"):
        try:
            r = subprocess.run(
                ["node", "--test", "tests/bookings.test.js"],
                cwd=sandbox, capture_output=True, text=True, timeout=30
            )
            output = r.stdout + r.stderr
            pass_m = re.search(r"# pass (\d+)", output)
            fail_m = re.search(r"# fail (\d+)", output)
            total_m = re.search(r"# tests (\d+)", output)
            tests_pass = int(pass_m.group(1)) if pass_m else 0
            tests_fail = int(fail_m.group(1)) if fail_m else -1
            tests_total = int(total_m.group(1)) if total_m else 0

            result["details"]["tests_pass"] = tests_pass
            result["details"]["tests_fail"] = tests_fail
            result["details"]["tests_total"] = tests_total

            min_pass = outcome_spec.get("expect_tests_pass_min", 0)
            if tests_pass < min_pass:
                result["passed"] = False
        except Exception as e:
            result["details"]["error"] = str(e)
            result["passed"] = False

    if outcome_spec.get("check_files"):
        for f in outcome_spec["check_files"]:
            exists = (sandbox / f).exists()
            result["details"][f"file_{f}"] = exists
            if not exists:
                result["passed"] = False

    return result


# ── Loop Runner ──

def run_loop_resume(case: dict, sandbox: Path) -> tuple[str | None, list[TurnGrade]]:
    """Run a multi-turn loop using --resume between turns."""
    turns = case["turns"]
    session_id = None
    all_grades = []

    for i, turn in enumerate(turns):
        sessions_before = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()

        cmd = ["copilot", "--agent", "forge/Forge",
               "--allow-all-tools", "--max-autopilot-continues", "8",
               "--model", "claude-opus-4.6", "--no-color"]

        if session_id:
            cmd.extend(["--resume", session_id, "-p", turn["prompt"]])
        else:
            cmd.extend(["-p", turn["prompt"]])

        try:
            timeout = turn.get("timeout", 600)
            r = subprocess.run(cmd, capture_output=True, text=True,
                               timeout=timeout, cwd=str(sandbox))
        except subprocess.TimeoutExpired:
            print(f"    Turn {i}: TIMEOUT")
            break

        if not session_id:
            session_id = find_new_session(sessions_before)

        if not session_id:
            print(f"    Turn {i}: No session created")
            break

        # Grade this turn
        turn_grades = grade_session_per_turn(session_id, [t["prompt"] for t in turns[:i+1]])
        # Accumulate skills from all prior turns (they persist in session)
        accumulated_skills = set()
        for prev_tg in all_grades:
            accumulated_skills.update(prev_tg.skills_loaded)
        if i < len(turn_grades):
            tg = turn_grades[i]
            passed = evaluate_turn(tg, turn, accumulated_skills)
            status = "✅" if passed else "❌"
            print(f"    Turn {i} [{turn.get('expect_phase', '?')}]: {status} "
                  f"(dispatch={tg.dispatches}, edit={tg.inline_edits}, "
                  f"skills={','.join(tg.skills_loaded) or 'none'})")
            all_grades.append(tg)
        else:
            print(f"    Turn {i}: No grade data")

    return session_id, all_grades


def run_loop_interactive(case: dict, sandbox: Path) -> tuple[str | None, list[TurnGrade]]:
    """Run a 2-3 turn loop using copilot -i with piped input."""
    turns = case["turns"]
    first_prompt = turns[0]["prompt"]
    remaining = "\n".join(t["prompt"] for t in turns[1:])

    sessions_before = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()

    cmd = ["copilot", "--agent", "forge/Forge", "-i", first_prompt,
           "--allow-all-tools", "--max-autopilot-continues", "8",
           "--model", "claude-opus-4.6", "--no-color", "--autopilot"]

    try:
        r = subprocess.run(cmd, input=remaining + "\n", capture_output=True,
                           text=True, timeout=600, cwd=str(sandbox))
    except subprocess.TimeoutExpired:
        print(f"    Interactive: TIMEOUT")
        return None, []

    session_id = find_new_session(sessions_before)
    if not session_id:
        return None, []

    turn_grades = grade_session_per_turn(session_id, [t["prompt"] for t in turns])

    accumulated_skills = set()
    for i, tg in enumerate(turn_grades):
        if i < len(turns):
            passed = evaluate_turn(tg, turns[i], accumulated_skills)
            accumulated_skills.update(tg.skills_loaded)
            status = "✅" if passed else "❌"
            print(f"    Turn {i} [{turns[i].get('expect_phase', '?')}]: {status} "
                  f"(dispatch={tg.dispatches}, edit={tg.inline_edits}, "
                  f"skills={','.join(tg.skills_loaded) or 'none'})")

    return session_id, turn_grades


def run_loop(case: dict) -> dict:
    """Run a single loop eval case."""
    case_id = case["id"]
    mode = case.get("mode", "interactive")

    print(f"\n{'━'*65}")
    print(f"  🔄 {case['name']}")
    print(f"  Loop: {case['loop']} | Mode: {mode} | Turns: {len(case['turns'])}")
    print(f"{'━'*65}")

    sandbox = create_sandbox(f"{case_id}-{int(time.time())}")
    print(f"  Sandbox: {sandbox}")

    start = time.time()

    if mode == "resume":
        session_id, turn_grades = run_loop_resume(case, sandbox)
    else:
        session_id, turn_grades = run_loop_interactive(case, sandbox)

    elapsed = time.time() - start
    print(f"  Total: {elapsed:.0f}s | Session: {session_id or 'none'}")

    # Per-turn pass rate
    turns_passed = sum(1 for tg in turn_grades if tg.passed)
    total_turns = len(turn_grades)
    print(f"  Turns: {turns_passed}/{total_turns} passed")

    # Outcome grading
    outcome = None
    if case.get("outcome_check"):
        outcome = grade_outcome(sandbox, case["outcome_check"])
        oc = outcome["details"]
        if "tests_pass" in oc:
            print(f"  Outcome: tests {oc['tests_pass']}/{oc['tests_total']} pass "
                  f"{'✅' if outcome['passed'] else '❌'}")
        else:
            print(f"  Outcome: {'✅' if outcome['passed'] else '❌'} {oc}")

    cleanup_sandbox(sandbox)

    # Aggregate results
    all_dispatches = sum(tg.dispatches for tg in turn_grades)
    all_edits = sum(tg.inline_edits + tg.inline_creates for tg in turn_grades)
    all_bash = sum(tg.mutating_bashes for tg in turn_grades)
    all_skills = set()
    for tg in turn_grades:
        all_skills.update(tg.skills_loaded)

    overall_pass = turns_passed == total_turns and (not outcome or outcome["passed"])
    print(f"  Overall: {'✅ PASS' if overall_pass else '❌ FAIL'}")

    return {
        "case_id": case_id,
        "case_name": case["name"],
        "loop": case["loop"],
        "mode": mode,
        "session_id": session_id,
        "elapsed": round(elapsed, 1),
        "turns_total": total_turns,
        "turns_passed": turns_passed,
        "dispatches": all_dispatches,
        "inline_edits": all_edits,
        "mutating_bashes": all_bash,
        "skills_loaded": list(all_skills),
        "outcome": outcome,
        "overall_pass": overall_pass,
        "per_turn": [
            {
                "index": tg.turn_index,
                "passed": tg.passed,
                "dispatches": tg.dispatches,
                "inline_edits": tg.inline_edits + tg.inline_creates,
                "skills": tg.skills_loaded,
                "briefs_ok": tg.briefs_with_skill_line,
            }
            for tg in turn_grades
        ],
    }


def print_summary(results: list):
    print(f"\n{'='*70}")
    print(f"  FORGE LOOP EVAL SUITE — SUMMARY")
    print(f"{'='*70}")

    total = len(results)
    passed = sum(1 for r in results if r.get("overall_pass"))
    print(f"  Loops: {passed}/{total} passed")

    total_turns = sum(r["turns_total"] for r in results)
    turns_passed = sum(r["turns_passed"] for r in results)
    print(f"  Turns: {turns_passed}/{total_turns} passed ({turns_passed/total_turns*100:.0f}%)" if total_turns else "")

    total_dispatches = sum(r["dispatches"] for r in results)
    total_edits = sum(r["inline_edits"] for r in results)
    dispatch_pct = total_dispatches / (total_dispatches + total_edits) * 100 if (total_dispatches + total_edits) else 100
    print(f"  Dispatch discipline: {dispatch_pct:.0f}% ({total_dispatches} dispatch, {total_edits} inline)")

    print(f"\n  {'Loop':<45} {'Turns':>8} {'Dispatch':>10} {'Outcome':>9} {'Time':>6}")
    print(f"  {'─'*82}")
    for r in results:
        name = r["case_name"][:43]
        turns = f"{r['turns_passed']}/{r['turns_total']}"
        dispatch = f"{r['dispatches']}d/{r['inline_edits']}e"
        oc = "—"
        if r.get("outcome") and r["outcome"].get("details", {}).get("tests_pass") is not None:
            d = r["outcome"]["details"]
            oc = f"{d['tests_pass']}/{d['tests_total']}"
        elif r.get("outcome"):
            oc = "✅" if r["outcome"]["passed"] else "❌"
        overall = "✅" if r["overall_pass"] else "❌"
        elapsed = f"{r['elapsed']:.0f}s"
        print(f"  {overall} {name:<43} {turns:>8} {dispatch:>10} {oc:>9} {elapsed:>6}")

    print(f"\n{'='*70}\n")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Forge Loop Eval Suite")
    parser.add_argument("--loop", help="Run specific loop by id prefix")
    parser.add_argument("--skip-llm", action="store_true")
    parser.add_argument("--report", help="Report from past results")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(exist_ok=True)

    with open(LOOP_CASES_FILE) as f:
        cases = json.load(f)

    if args.report:
        results = []
        for fp in sorted(Path(args.report).glob("loop-*.json")):
            with open(fp) as fh:
                results.append(json.load(fh))
        print_summary(results)
        return

    if args.loop:
        cases = [c for c in cases if args.loop in c["id"] or args.loop in c["loop"]]

    if not cases:
        print("No loops matched"); sys.exit(1)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = RESULTS_DIR / f"loops_{ts}"
    run_dir.mkdir(parents=True, exist_ok=True)

    print(f"🔄 Forge Loop Eval Suite — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"   Loops: {len(cases)} | Results: {run_dir}")

    results = []
    for case in cases:
        result = run_loop(case)
        results.append(result)
        with open(run_dir / f"loop-{case['id']}.json", "w") as f:
            json.dump(result, f, indent=2)

    with open(run_dir / "summary.json", "w") as f:
        json.dump({"timestamp": ts, "results": results}, f, indent=2)

    print_summary(results)
    all_pass = all(r["overall_pass"] for r in results)
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
