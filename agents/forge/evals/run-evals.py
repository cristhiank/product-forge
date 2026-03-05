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
from parsing import _is_mutating_bash

SCRIPT_DIR = Path(__file__).parent
TEST_CASES_FILE = SCRIPT_DIR / "test-cases.json"
FIXTURE_DIR = SCRIPT_DIR / "fixtures" / "sample-api"
RESULTS_DIR = SCRIPT_DIR / "results"
SESSION_STATE = Path.home() / ".copilot" / "session-state"
REPO_ROOT = SCRIPT_DIR.parent.parent.parent  # agents/forge/evals -> mcp/

# On Windows, npm/npx are .cmd batch files and require shell=True for subprocess.
_SHELL = sys.platform == "win32"


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
    # Install deps if package.json exists
    if (worktree_dir / "package.json").exists():
        subprocess.run(["npm", "install", "--silent"], cwd=worktree_dir,
                       capture_output=True, timeout=60, shell=_SHELL)
    return worktree_dir


def create_repo_sandbox(eval_id: str) -> Path:
    """Create an isolated sandbox snapshot of the current repository."""
    sandbox_root = Path(tempfile.mkdtemp(prefix=f"forge-eval-{eval_id}-"))
    sandbox_dir = sandbox_root / "repo"

    ignore = shutil.ignore_patterns(
        ".git", "node_modules", "__pycache__", ".pytest_cache", ".DS_Store",
        "sandbox", "results", "dist"
    )
    shutil.copytree(REPO_ROOT, sandbox_dir, ignore=ignore)

    # Init as a fresh git repo so the agent has git context
    subprocess.run(["git", "init", "-q"], cwd=sandbox_dir, capture_output=True)
    subprocess.run(["git", "add", "."], cwd=sandbox_dir, capture_output=True)
    subprocess.run(
        ["git", "commit", "-q", "-m", "initial: repo sandbox snapshot"],
        cwd=sandbox_dir, capture_output=True,
        env={**os.environ, "GIT_AUTHOR_NAME": "eval", "GIT_AUTHOR_EMAIL": "eval@test",
             "GIT_COMMITTER_NAME": "eval", "GIT_COMMITTER_EMAIL": "eval@test"}
    )
    return sandbox_dir


def cleanup_worktree(worktree_dir: Path):
    """Remove worktree after eval."""
    if worktree_dir.exists():
        def _onerror(func, path, _exc_info):
            try:
                os.chmod(path, 0o700)
                func(path)
            except Exception:
                pass
        shutil.rmtree(worktree_dir, onerror=_onerror)


# ──────────────────────────────────────────────
# Mechanical Grading (from events.jsonl)
# ──────────────────────────────────────────────

BUILD_TEST_PATTERNS = [
    "npm run build", "npm test", "dotnet build", "dotnet test", "dotnet run",
    "pytest", "cargo build", "cargo test", "make", "go build", "go test",
    "npx tsc", "npx vitest", "node --test",
]
FILE_MUTATION_PATTERNS = [
    "sed -i", "awk -i", "perl -pi", "patch ",
    "echo >", "cat >", "tee ", ">>",
    "npm install", "pip install", "dotnet add",
]
SAFE_SEGMENT_PREFIXES = [
    "node ", "git ", "grep ", "jq ", "head ", "tail ",
    "ls ", "find ", "wc ", "sort ", "uniq ", "which ", "pwd",
]
PROMPT_SKILL_RE = re.compile(r"invoke the [`']([^`']+)[`'] skill", re.IGNORECASE)


def _is_coordinator_tool_call(event_data: dict) -> bool:
    """Coordinator actions have no parentToolCallId in session events."""
    return not bool(event_data.get("parentToolCallId"))


def _is_mutating_bash(cmd: str) -> bool:
    # Neutralize quoted strings so patterns inside args don't trigger matches
    stripped = re.sub(r'"[^"]*"|\'[^\']*\'', '""', cmd)
    segments = re.split(r'\s*(?:&&|\|\||[;|])\s*', stripped)
    for seg in segments:
        seg = seg.strip()
        if not seg:
            continue
        # Skip known-safe CLI tool invocations (backlog, hub, git, etc.)
        if any(seg.startswith(p) for p in SAFE_SEGMENT_PREFIXES):
            continue
        for p in FILE_MUTATION_PATTERNS:
            if p in seg:
                return True
        for p in BUILD_TEST_PATTERNS:
            if seg.startswith(p):
                rest = seg[len(p):]
                if not rest or rest[0].isspace():
                    return True
    return False

def _extract_prompt_skills(prompt: str) -> list[str]:
    return [s.strip().lower() for s in PROMPT_SKILL_RE.findall(prompt or "") if s.strip()]


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
    with open(events_path, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            event = json.loads(line)
            etype = event.get("type", "")
            data = event.get("data", {})

            if etype == "tool.execution_start":
                if not _is_coordinator_tool_call(data):
                    continue
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
                    for s in _extract_prompt_skills(prompt):
                        if s not in g.skills_loaded:
                            g.skills_loaded.append(s)
                elif tool == "skill":
                    g.skill_loads += 1
                    skill_name = (args.get("skill", "") or "").strip().lower()
                    if skill_name and skill_name not in g.skills_loaded:
                        g.skills_loaded.append(skill_name)
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
    try:
        result = subprocess.run(
            ["node", "--test", "tests/bookings.test.js"],
            cwd=worktree_dir, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=30
        )
        output = result.stdout + result.stderr

        # Match both TAP (# pass N) and spec reporter (ℹ pass N) formats
        pass_match = re.search(r"[#\u2139]\s*pass\s+(\d+)", output)
        fail_match = re.search(r"[#\u2139]\s*fail\s+(\d+)", output)
        total_match = re.search(r"[#\u2139]\s*tests\s+(\d+)", output)

        return {
            "tests_pass": int(pass_match.group(1)) if pass_match else 0,
            "tests_fail": int(fail_match.group(1)) if fail_match else -1,
            "tests_total": int(total_match.group(1)) if total_match else 0,
            "exit_code": result.returncode,
            "output_tail": output[-500:] if output else "",
        }
    except Exception as e:
        return {
            "tests_pass": 0,
            "tests_fail": -1,
            "tests_total": 0,
            "exit_code": -1,
            "output_tail": f"grade_outcome error: {e}",
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
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=120, cwd=str(SCRIPT_DIR)
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
    timeout = int(case.get("timeout", 300))

    try:
        result = subprocess.run(
            ["copilot", "--agent", "forge/Forge", "-p", case["prompt"],
             "--allow-all-tools", "--max-autopilot-continues", "8",
             "--model", "claude-opus-4.6", "--no-color", "--autopilot"],
            capture_output=True, text=True, timeout=timeout, cwd=str(worktree_dir)
        )
        output = (result.stdout or "") + (result.stderr or "")
    except subprocess.TimeoutExpired as e:
        output = f"[TIMEOUT after {timeout}s]\n{(e.stdout or '')}\n{(e.stderr or '')}"

    sessions_after = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()
    new = sessions_after - sessions_before
    session_id = list(new)[0] if new else None
    return session_id, output


def run_multi_turn(case: dict, worktree_dir: Path) -> tuple[str, str]:
    """Run a multi-turn eval via copilot -i with piped turns."""
    turns = case.get("turns", [case["prompt"]])
    input_text = "\n".join(turns) + "\n/exit\n"

    sessions_before = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()
    timeout = int(case.get("timeout", 600))

    try:
        result = subprocess.run(
            ["copilot", "--agent", "forge/Forge", "-i", turns[0],
             "--allow-all-tools", "--max-autopilot-continues", "8",
             "--model", "claude-opus-4.6", "--no-color", "--autopilot"],
            input="\n".join(turns[1:]) + "\n" if len(turns) > 1 else "",
            capture_output=True, text=True, timeout=timeout, cwd=str(worktree_dir)
        )
        output = (result.stdout or "") + (result.stderr or "")
    except subprocess.TimeoutExpired as e:
        output = f"[TIMEOUT after {timeout}s]\n{(e.stdout or '')}\n{(e.stderr or '')}"

    sessions_after = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()
    new = sessions_after - sessions_before
    session_id = list(new)[0] if new else None
    return session_id, output


# ──────────────────────────────────────────────
# Main Runner
# ──────────────────────────────────────────────

def run_test_case(case: dict, trial: int = 1, skip_llm: bool = False) -> dict:
    case_id = case["id"]
    needs_fixture = case.get("needs_fixture", False)
    is_multi_turn = "turns" in case
    workspace = case.get("workspace", "fixture")

    print(f"\n{'━'*60}")
    print(f"  📋 {case['name']} [{case['category']}] (trial {trial})")
    print(f"  Prompt: {case['prompt'][:80]}{'...' if len(case['prompt']) > 80 else ''}")
    if needs_fixture:
        print(f"  Fixture: sample-api (7 bugs, 10 tests)")
    print(f"{'━'*60}")

    # Setup
    worktree_dir = None
    eval_id = f"{case_id}-t{trial}-{int(time.time())}"

    if workspace == "repo":
        worktree_dir = create_repo_sandbox(eval_id)
    else:
        worktree_dir = create_worktree(eval_id)
    print(f"  Sandbox: {worktree_dir}")

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
        return {
            "case_id": case_id,
            "trial": trial,
            "error": "no session",
            "elapsed": round(elapsed, 1),
            "output_tail": output[-1500:] if output else "",
        }

    print(f"  Session: {session_id} ({elapsed:.0f}s)")

    # Mechanical grading
    mech = mechanical_grade(session_id)
    expected = case["expected"]
    expected_skills = expected.get("expected_skills", [])

    mech_pass = True
    if expected.get("should_dispatch") and mech.dispatches == 0:
        mech_pass = False
    if expected.get("should_dispatch") is False and mech.dispatches > 0:
        mech_pass = False
    if not expected.get("should_edit", True) and (mech.inline_edits > 0 or mech.inline_creates > 0):
        mech_pass = False
    if mech.mutating_bashes > 0 and not expected.get("should_edit", True):
        mech_pass = False
    if expected.get("should_clarify") and not mech.has_clarification:
        mech_pass = False
    if expected.get("should_load_skill") and mech.skill_loads == 0:
        mech_pass = False
    missing_skills = [s for s in expected_skills if s not in set(mech.skills_loaded)]
    if missing_skills:
        mech_pass = False

    print(f"  Mechanical: {'✅' if mech_pass else '❌'} "
          f"(dispatch={mech.dispatches}, edit={mech.inline_edits}, "
          f"create={mech.inline_creates}, bash!={mech.mutating_bashes}, "
          f"skills={','.join(mech.skills_loaded) or 'none'}, "
          f"briefs_ok={mech.briefs_with_skill_line}/{mech.dispatches}, "
          f"missing_skills={','.join(missing_skills) or 'none'})")

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
            "workspace": workspace,
            "dispatch_score": round(mech.dispatch_score, 1),
            "dispatches": mech.dispatches,
            "inline_edits": mech.inline_edits,
            "inline_creates": mech.inline_creates,
            "mutating_bashes": mech.mutating_bashes,
            "skills_loaded": mech.skills_loaded,
            "missing_skills": missing_skills,
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
    parser.add_argument("--cases", help="Path to test cases JSON (default: test-cases.json)")
    parser.add_argument("--trials", type=int, default=1, help="Trials per case (default 1)")
    parser.add_argument("--skip-llm", action="store_true", help="Mechanical grading only")
    parser.add_argument("--report", help="Aggregate from past results dir")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(exist_ok=True)

    cases_file = Path(args.cases) if args.cases else TEST_CASES_FILE
    if args.cases and not cases_file.is_absolute():
        script_relative = SCRIPT_DIR / args.cases
        if script_relative.exists():
            cases_file = script_relative

    with open(cases_file) as f:
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
