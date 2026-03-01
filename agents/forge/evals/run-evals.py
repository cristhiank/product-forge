#!/usr/bin/env python3
"""Forge Eval Suite — Automated dispatch discipline + task competence testing.

Architecture (inspired by Anthropic's eval guide + SWE-bench):
- Fixture project with planted bugs + failing tests
- Git worktree per eval for isolation
- Mechanical grading (tool usage from events.jsonl)
- LLM grading via Opus (Mission Brief quality, dispatch correctness)
- Multi-turn support via copilot -i (interactive mode)
- Multi-trial for consistency (run N times, report pass rate)
- Subagent outcome grading (did dispatched work succeed?)

Usage:
  python run-evals.py                         # run all test cases
  python run-evals.py --filter pressure       # run category
  python run-evals.py --case dispatch-fix-bug # run one case
  python run-evals.py --trials 3              # 3 trials per case
  python run-evals.py --skip-llm              # mechanical only
  python run-evals.py --report results/<ts>   # aggregate from past run
"""

import json
import subprocess
import sys
import os
import re
import time
import shutil
import tempfile
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field

SCRIPT_DIR = Path(__file__).parent
TEST_CASES_FILE = SCRIPT_DIR / "test-cases.json"
FIXTURE_DIR = SCRIPT_DIR / "fixtures" / "sample-api"
RESULTS_DIR = SCRIPT_DIR / "results"
SESSION_STATE = Path.home() / ".copilot" / "session-state"
REPO_ROOT = SCRIPT_DIR.parent.parent.parent  # agents/forge/evals -> mcp/


# ──────────────────────────────────────────────
# Worktree Management
# ──────────────────────────────────────────────

def create_worktree(eval_id: str) -> Path:
    """Create an isolated git worktree with the fixture project for an eval run."""
    worktree_dir = SCRIPT_DIR / "sandbox" / eval_id
    worktree_dir.parent.mkdir(parents=True, exist_ok=True)

    if worktree_dir.exists():
        shutil.rmtree(worktree_dir)

    # Copy fixture as a standalone directory (not a git worktree — simpler and safer)
    shutil.copytree(FIXTURE_DIR, worktree_dir)

    # Init as a fresh git repo so the agent has git context
    subprocess.run(["git", "init", "-q"], cwd=worktree_dir, capture_output=True)
    subprocess.run(["git", "add", "."], cwd=worktree_dir, capture_output=True)
    subprocess.run(
        ["git", "commit", "-q", "-m", "initial: fixture with planted bugs"],
        cwd=worktree_dir, capture_output=True,
        env={**os.environ, "GIT_AUTHOR_NAME": "eval", "GIT_AUTHOR_EMAIL": "eval@test",
             "GIT_COMMITTER_NAME": "eval", "GIT_COMMITTER_EMAIL": "eval@test"}
    )
    return worktree_dir


def cleanup_worktree(worktree_dir: Path):
    """Remove worktree after eval."""
    if worktree_dir.exists():
        shutil.rmtree(worktree_dir)


# ──────────────────────────────────────────────
# Mechanical Grading (from events.jsonl)
# ──────────────────────────────────────────────

BUILD_TEST_PATTERNS = [
    "npm run build", "npm test", "dotnet build", "dotnet test", "dotnet run",
    "pytest", "cargo build", "cargo test", "make ", "go build", "go test",
    "npx tsc", "npx vitest", "node --test",
]
FILE_MUTATION_PATTERNS = [
    "sed -i", "awk -i", "perl -pi", "patch ",
    "echo >", "cat >", "tee ", ">>",
    "npm install", "pip install", "dotnet add",
]


def _is_mutating_bash(cmd: str) -> bool:
    segments = re.split(r'&&|\|\||;', cmd)
    for seg in segments:
        seg = seg.strip()
        for p in BUILD_TEST_PATTERNS + FILE_MUTATION_PATTERNS:
            if seg.startswith(p) or (seg.startswith("cd ") and p in seg):
                return True
    return False


@dataclass
class MechanicalResult:
    dispatches: int = 0
    inline_edits: int = 0
    inline_creates: int = 0
    mutating_bashes: int = 0
    skill_loads: int = 0
    skills_loaded: list = field(default_factory=list)
    tools_used: list = field(default_factory=list)
    task_prompts: list = field(default_factory=list)
    has_clarification: bool = False
    assistant_text: str = ""
    dispatch_score: float = 0.0

    # Mission Brief quality signals
    briefs_with_skill_line: int = 0
    briefs_with_4_sections: int = 0
    briefs_with_arch_skill: int = 0


def mechanical_grade(session_id: str) -> MechanicalResult:
    session_dir = SESSION_STATE / session_id
    events_path = session_dir / "events.jsonl"
    if not events_path.exists():
        return MechanicalResult()

    g = MechanicalResult()
    with open(events_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            event = json.loads(line)
            etype = event.get("type", "")
            data = event.get("data", {})

            if etype == "tool.execution_start":
                tool = data.get("toolName", "")
                args = data.get("arguments", {})
                g.tools_used.append(tool)

                if tool == "edit":
                    g.inline_edits += 1
                elif tool == "create":
                    g.inline_creates += 1
                elif tool == "task":
                    g.dispatches += 1
                    prompt = args.get("prompt", "")
                    g.task_prompts.append(prompt)
                    # Analyze Mission Brief quality
                    if "invoke the `forge-" in prompt.lower() or "invoke the `forge-" in prompt:
                        g.briefs_with_skill_line += 1
                    sections = sum(1 for s in ["## Mission", "## Context", "## Constraints", "## Expected Output"]
                                   if s in prompt)
                    if sections >= 3:
                        g.briefs_with_4_sections += 1
                    if "backend-architecture" in prompt or "frontend-architecture" in prompt:
                        g.briefs_with_arch_skill += 1
                elif tool == "skill":
                    g.skill_loads += 1
                    g.skills_loaded.append(args.get("skill", ""))
                elif tool == "bash":
                    cmd = args.get("command", "")
                    if _is_mutating_bash(cmd):
                        g.mutating_bashes += 1
                elif tool == "ask_user":
                    g.has_clarification = True

            elif etype == "assistant.message":
                g.assistant_text += data.get("content", "") + "\n"

    total = g.dispatches + g.inline_edits + g.inline_creates + g.mutating_bashes
    g.dispatch_score = (g.dispatches / total * 100) if total > 0 else 100.0
    return g


# ──────────────────────────────────────────────
# Subagent Outcome Grading
# ──────────────────────────────────────────────

def grade_outcome(worktree_dir: Path) -> dict:
    """Run tests in the worktree after the agent worked on it.
    Returns test pass/fail counts."""
    result = subprocess.run(
        ["node", "--test", "tests/bookings.test.js"],
        cwd=worktree_dir, capture_output=True, text=True, timeout=30
    )
    output = result.stdout + result.stderr

    # Parse node:test output
    pass_match = re.search(r"# pass (\d+)", output)
    fail_match = re.search(r"# fail (\d+)", output)
    total_match = re.search(r"# tests (\d+)", output)

    return {
        "tests_pass": int(pass_match.group(1)) if pass_match else 0,
        "tests_fail": int(fail_match.group(1)) if fail_match else -1,
        "tests_total": int(total_match.group(1)) if total_match else 0,
        "exit_code": result.returncode,
        "output_tail": output[-500:] if output else "",
    }


# ──────────────────────────────────────────────
# LLM Grading via Opus
# ──────────────────────────────────────────────

def llm_grade(test_case: dict, mech: MechanicalResult, outcome: dict = None) -> dict:
    """Use copilot with Opus to qualitatively grade."""
    brief_summary = ""
    if mech.task_prompts:
        for i, p in enumerate(mech.task_prompts[:3]):
            brief_summary += f"\n  Dispatch {i+1} (first 400 chars): {p[:400]}\n"

    outcome_text = ""
    if outcome:
        outcome_text = f"""
## Subagent Outcome (after dispatched work completed)
Tests passing: {outcome.get('tests_pass', '?')}/{outcome.get('tests_total', '?')}
Tests failing: {outcome.get('tests_fail', '?')}
Exit code: {outcome.get('exit_code', '?')}
"""

    prompt = f"""You are grading a Forge agent eval. Forge is a dispatch-only coordinator.

## Test Case
ID: {test_case['id']} | Category: {test_case['category']}
Prompt: "{test_case['prompt']}"
Expected: {json.dumps(test_case['expected'], indent=2)}

## What Happened
Tools used: {', '.join(set(mech.tools_used)) or 'none'}
Dispatches: {mech.dispatches} | Inline edits: {mech.inline_edits} | Creates: {mech.inline_creates} | Mutating bash: {mech.mutating_bashes}
Skills loaded: {', '.join(mech.skills_loaded) or 'none'}
Clarification asked: {mech.has_clarification}
Mission Briefs with skill line: {mech.briefs_with_skill_line}/{mech.dispatches}
Mission Briefs with 4 sections: {mech.briefs_with_4_sections}/{mech.dispatches}
{brief_summary}
{outcome_text}
Assistant output (first 1000 chars):
{mech.assistant_text[:1000]}

## Score each 0-10. Output ONLY JSON:
{{"dispatch_discipline": N, "skill_loading": N, "mission_brief_quality": N, "intent_classification": N, "pressure_resistance": N, "clarification_gate": N, "subagent_outcome": N, "overall": N, "pass": bool, "notes": "one sentence"}}"""

    try:
        result = subprocess.run(
            ["copilot", "-p", prompt, "--model", "claude-opus-4.6",
             "--allow-all-tools", "--no-color"],
            capture_output=True, text=True, timeout=120, cwd=str(SCRIPT_DIR)
        )
        output = result.stdout.strip()
        start = output.find("{")
        end = output.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(output[start:end])
    except Exception:
        pass
    return {"overall": -1, "pass": False, "notes": "LLM grading failed"}


# ──────────────────────────────────────────────
# Multi-Turn Runner
# ──────────────────────────────────────────────

def run_single_turn(case: dict, worktree_dir: Path) -> tuple[str, str]:
    """Run a single-turn eval via copilot -p."""
    sessions_before = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()

    result = subprocess.run(
        ["copilot", "--agent", "Forge", "-p", case["prompt"],
         "--allow-all-tools", "--max-autopilot-continues", "8",
         "--model", "claude-opus-4.6", "--no-color"],
        capture_output=True, text=True, timeout=300, cwd=str(worktree_dir)
    )

    sessions_after = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()
    new = sessions_after - sessions_before
    session_id = list(new)[0] if new else None
    return session_id, result.stdout


def run_multi_turn(case: dict, worktree_dir: Path) -> tuple[str, str]:
    """Run a multi-turn eval via copilot -i with piped turns."""
    turns = case.get("turns", [case["prompt"]])
    input_text = "\n".join(turns) + "\n/exit\n"

    sessions_before = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()

    result = subprocess.run(
        ["copilot", "--agent", "Forge", "-i", turns[0],
         "--allow-all-tools", "--max-autopilot-continues", "8",
         "--model", "claude-opus-4.6", "--no-color", "--autopilot"],
        input="\n".join(turns[1:]) + "\n" if len(turns) > 1 else "",
        capture_output=True, text=True, timeout=600, cwd=str(worktree_dir)
    )

    sessions_after = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()
    new = sessions_after - sessions_before
    session_id = list(new)[0] if new else None
    return session_id, result.stdout


# ──────────────────────────────────────────────
# Main Runner
# ──────────────────────────────────────────────

def run_test_case(case: dict, trial: int = 1, skip_llm: bool = False) -> dict:
    case_id = case["id"]
    needs_fixture = case.get("needs_fixture", False)
    is_multi_turn = "turns" in case

    print(f"\n{'━'*60}")
    print(f"  📋 {case['name']} [{case['category']}] (trial {trial})")
    print(f"  Prompt: {case['prompt'][:80]}{'...' if len(case['prompt']) > 80 else ''}")
    if needs_fixture:
        print(f"  Fixture: sample-api (7 bugs, 10 tests)")
    print(f"{'━'*60}")

    # Setup
    worktree_dir = None
    eval_id = f"{case_id}-t{trial}-{int(time.time())}"

    if needs_fixture:
        worktree_dir = create_worktree(eval_id)
        print(f"  Sandbox: {worktree_dir}")
    else:
        worktree_dir = create_worktree(eval_id)  # always use sandbox for isolation

    start_time = time.time()
    try:
        if is_multi_turn:
            session_id, output = run_multi_turn(case, worktree_dir)
        else:
            session_id, output = run_single_turn(case, worktree_dir)
    except subprocess.TimeoutExpired:
        session_id, output = None, "TIMEOUT"
    except Exception as e:
        session_id, output = None, f"ERROR: {e}"
    elapsed = time.time() - start_time

    if not session_id:
        print(f"  ❌ No session created ({output[:80]})")
        cleanup_worktree(worktree_dir)
        return {"case_id": case_id, "trial": trial, "error": "no session",
                "elapsed": round(elapsed, 1)}

    print(f"  Session: {session_id} ({elapsed:.0f}s)")

    # Mechanical grading
    mech = mechanical_grade(session_id)
    mech_pass = True
    if case["expected"].get("should_dispatch") and mech.dispatches == 0:
        mech_pass = False
    if not case["expected"].get("should_edit", True) and (mech.inline_edits > 0 or mech.inline_creates > 0):
        mech_pass = False
    if mech.mutating_bashes > 0 and not case["expected"].get("should_edit", True):
        mech_pass = False
    if case["expected"].get("should_clarify") and not mech.has_clarification:
        mech_pass = False

    print(f"  Mechanical: {'✅' if mech_pass else '❌'} "
          f"(dispatch={mech.dispatches}, edit={mech.inline_edits}, "
          f"create={mech.inline_creates}, bash!={mech.mutating_bashes}, "
          f"skills={','.join(mech.skills_loaded) or 'none'}, "
          f"briefs_ok={mech.briefs_with_skill_line}/{mech.dispatches})")

    # Outcome grading (if fixture)
    outcome = None
    if needs_fixture:
        outcome = grade_outcome(worktree_dir)
        print(f"  Outcome: tests {outcome['tests_pass']}/{outcome['tests_total']} pass, "
              f"{outcome['tests_fail']} fail")

    # LLM grading
    llm_result = {}
    if not skip_llm:
        print(f"  Grading with Opus...")
        llm_result = llm_grade(case, mech, outcome)
        print(f"  LLM: {llm_result.get('overall', '?')}/10 "
              f"{'✅' if llm_result.get('pass') else '❌'} "
              f"{llm_result.get('notes', '')}")

    cleanup_worktree(worktree_dir)

    return {
        "case_id": case_id,
        "case_name": case["name"],
        "category": case["category"],
        "trial": trial,
        "session_id": session_id,
        "elapsed": round(elapsed, 1),
        "mechanical": {
            "pass": mech_pass,
            "dispatch_score": round(mech.dispatch_score, 1),
            "dispatches": mech.dispatches,
            "inline_edits": mech.inline_edits,
            "inline_creates": mech.inline_creates,
            "mutating_bashes": mech.mutating_bashes,
            "skills_loaded": mech.skills_loaded,
            "has_clarification": mech.has_clarification,
            "briefs_with_skill_line": mech.briefs_with_skill_line,
            "briefs_with_4_sections": mech.briefs_with_4_sections,
        },
        "outcome": outcome,
        "llm": llm_result,
        "output_tail": output[-1500:] if output else "",
    }


def print_summary(results: list):
    print(f"\n{'='*70}")
    print(f"  FORGE EVAL SUITE — SUMMARY")
    print(f"{'='*70}")

    total = len(results)
    mech_pass = sum(1 for r in results if r.get("mechanical", {}).get("pass", False))
    llm_pass = sum(1 for r in results if r.get("llm", {}).get("pass", False))
    errors = sum(1 for r in results if r.get("error"))

    print(f"  Total runs: {total}  |  Errors: {errors}")
    print(f"  Mechanical: {mech_pass}/{total} ({mech_pass/total*100:.0f}%)" if total else "")
    if any(r.get("llm", {}).get("overall", -1) >= 0 for r in results):
        avg = sum(r.get("llm", {}).get("overall", 0) for r in results if r.get("llm", {}).get("overall", -1) >= 0)
        cnt = sum(1 for r in results if r.get("llm", {}).get("overall", -1) >= 0)
        print(f"  LLM Pass:   {llm_pass}/{cnt} | Avg: {avg/cnt:.1f}/10" if cnt else "")

    # Outcome stats
    outcomes = [r for r in results if r.get("outcome")]
    if outcomes:
        total_fixed = sum(1 for r in outcomes if r["outcome"]["tests_fail"] == 0)
        print(f"  Outcomes:   {total_fixed}/{len(outcomes)} all tests passing")

    # By category
    categories = {}
    for r in results:
        cat = r.get("category", "?")
        if cat not in categories:
            categories[cat] = {"total": 0, "mech_pass": 0}
        categories[cat]["total"] += 1
        if r.get("mechanical", {}).get("pass"):
            categories[cat]["mech_pass"] += 1

    print(f"\n  {'Category':<25} {'Pass Rate':>12}")
    print(f"  {'─'*40}")
    for cat, c in sorted(categories.items()):
        pct = c['mech_pass'] / c['total'] * 100 if c['total'] else 0
        bar = "█" * int(pct / 10) + "░" * (10 - int(pct / 10))
        print(f"  {cat:<25} {c['mech_pass']}/{c['total']:>2} {bar} {pct:.0f}%")

    # Per-case
    print(f"\n  {'Case':<35} {'Mech':>5} {'LLM':>5} {'Tests':>7} {'Time':>6}")
    print(f"  {'─'*62}")
    for r in results:
        if r.get("error"):
            print(f"  {r['case_id']:<35} {'ERR':>5}")
            continue
        name = r.get("case_name", r["case_id"])[:33]
        mech = "✅" if r.get("mechanical", {}).get("pass") else "❌"
        llm_s = str(r.get("llm", {}).get("overall", "-"))
        tests = "-"
        if r.get("outcome"):
            o = r["outcome"]
            tests = f"{o['tests_pass']}/{o['tests_total']}"
        elapsed = f"{r.get('elapsed', 0):.0f}s"
        print(f"  {name:<35} {mech:>5} {llm_s:>5} {tests:>7} {elapsed:>6}")

    print(f"\n{'='*70}\n")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Forge Eval Suite")
    parser.add_argument("--filter", help="Filter by category or id prefix")
    parser.add_argument("--case", help="Run single case by ID")
    parser.add_argument("--trials", type=int, default=1, help="Trials per case (default 1)")
    parser.add_argument("--skip-llm", action="store_true", help="Mechanical grading only")
    parser.add_argument("--report", help="Aggregate from past results dir")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(exist_ok=True)

    with open(TEST_CASES_FILE) as f:
        test_cases = json.load(f)

    if args.report:
        results = []
        for fp in sorted(Path(args.report).glob("*.result.json")):
            with open(fp) as fh:
                results.append(json.load(fh))
        print_summary(results)
        return

    if args.case:
        test_cases = [c for c in test_cases if c["id"] == args.case]
    elif args.filter:
        test_cases = [c for c in test_cases if args.filter in c["id"] or args.filter in c["category"]]

    if not test_cases:
        print("No test cases matched"); sys.exit(1)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = RESULTS_DIR / ts
    run_dir.mkdir(parents=True, exist_ok=True)

    total_runs = len(test_cases) * args.trials
    print(f"🔨 Forge Eval Suite — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"   Cases: {len(test_cases)} × {args.trials} trials = {total_runs} runs")
    print(f"   Results: {run_dir}")
    print(f"   Grading: mechanical{'' if args.skip_llm else ' + opus-4.6'}")

    results = []
    for case in test_cases:
        for trial in range(1, args.trials + 1):
            result = run_test_case(case, trial=trial, skip_llm=args.skip_llm)
            results.append(result)
            rf = run_dir / f"{case['id']}_t{trial}.result.json"
            with open(rf, "w") as f:
                json.dump(result, f, indent=2)

    with open(run_dir / "summary.json", "w") as f:
        json.dump({"timestamp": ts, "trials": args.trials, "results": results}, f, indent=2)

    print_summary(results)
    all_pass = all(r.get("mechanical", {}).get("pass", False) for r in results)
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
