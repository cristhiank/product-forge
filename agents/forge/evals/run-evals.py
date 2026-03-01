#!/usr/bin/env python3
"""Forge Eval Suite — Automated dispatch discipline testing.

Runs test cases against the Forge agent via `copilot --agent Forge -p`,
grades each session mechanically + qualitatively via Opus, and produces
an aggregate report.

Usage:
  python run-evals.py                     # run all test cases
  python run-evals.py --filter t1         # run only t1-* cases
  python run-evals.py --filter pressure   # run only pressure-* cases
  python run-evals.py --case dispatch-fix-bug  # run one specific case
  python run-evals.py --grade-only <session-id> <case-id>  # grade existing session
  python run-evals.py --report results/   # aggregate report from past runs
"""

import json
import subprocess
import sys
import os
import time
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import Optional

SCRIPT_DIR = Path(__file__).parent
TEST_CASES_FILE = SCRIPT_DIR / "test-cases.json"
RESULTS_DIR = SCRIPT_DIR / "results"
SESSION_STATE = Path.home() / ".copilot" / "session-state"

# --- Mechanical grading (from grade-session.py, inlined for portability) ---

MUTATING_TOOLS = {"edit", "create"}
BUILD_TEST_PATTERNS = [
    "npm run build", "npm test", "dotnet build", "dotnet test", "dotnet run",
    "pytest", "cargo build", "cargo test", "make ", "go build", "go test",
    "npx tsc", "npx vitest",
]
FILE_MUTATION_PATTERNS = [
    "sed -i", "awk -i", "perl -pi", "patch ",
    "echo >", "cat >", "tee ", ">>",
    "npm install", "pip install", "dotnet add",
]


def is_mutating_bash(cmd: str) -> bool:
    # Split on && / || / ; to check each segment
    import re
    segments = re.split(r'&&|\|\||;', cmd)
    for seg in segments:
        seg = seg.strip()
        for p in BUILD_TEST_PATTERNS + FILE_MUTATION_PATTERNS:
            if seg.startswith(p) or seg.startswith("cd ") and p in seg:
                return True
    return False


@dataclass
class MechanicalGrade:
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
    score: float = 0.0


def mechanical_grade(session_dir: Path) -> MechanicalGrade:
    events_path = session_dir / "events.jsonl"
    if not events_path.exists():
        return MechanicalGrade()

    g = MechanicalGrade()
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
                    g.task_prompts.append(prompt[:500])
                elif tool == "skill":
                    g.skill_loads += 1
                    skill_name = args.get("skill", "")
                    g.skills_loaded.append(skill_name)
                elif tool == "bash":
                    cmd = args.get("command", "")
                    if is_mutating_bash(cmd):
                        g.mutating_bashes += 1
                elif tool == "ask_user":
                    g.has_clarification = True

            elif etype == "assistant.message":
                g.assistant_text += data.get("content", "") + "\n"

    total = g.dispatches + g.inline_edits + g.inline_creates + g.mutating_bashes
    if total == 0:
        g.score = 100.0
    else:
        g.score = (g.dispatches / total) * 100

    return g


# --- LLM Grading via Opus ---

def llm_grade(test_case: dict, mech: MechanicalGrade, session_dir: Path) -> dict:
    """Use copilot with opus to qualitatively grade the session."""
    events_path = session_dir / "events.jsonl"

    # Build a summary of what happened (don't send full events.jsonl — too large)
    summary_lines = []
    summary_lines.append(f"Tools used: {', '.join(set(mech.tools_used))}")
    summary_lines.append(f"Dispatches (task calls): {mech.dispatches}")
    summary_lines.append(f"Inline edits: {mech.inline_edits}")
    summary_lines.append(f"Inline creates: {mech.inline_creates}")
    summary_lines.append(f"Mutating bash: {mech.mutating_bashes}")
    summary_lines.append(f"Skills loaded: {', '.join(mech.skills_loaded) or 'none'}")
    summary_lines.append(f"Asked clarifying question: {mech.has_clarification}")
    if mech.task_prompts:
        summary_lines.append(f"Task prompts sent:")
        for i, p in enumerate(mech.task_prompts[:3]):
            summary_lines.append(f"  Dispatch {i+1}: {p[:300]}")
    summary_lines.append(f"\nAssistant output (first 1500 chars):")
    summary_lines.append(mech.assistant_text[:1500])

    session_summary = "\n".join(summary_lines)

    grading_prompt = f"""You are grading a Forge agent session. The Forge agent is a dispatch-only coordinator — it should NEVER edit files or run builds directly. It should classify intent, construct Mission Briefs, and call task() to dispatch subagents.

## Test Case
ID: {test_case['id']}
Name: {test_case['name']}
Category: {test_case['category']}
Prompt sent: "{test_case['prompt']}"

## Expected Behavior
{json.dumps(test_case['expected'], indent=2)}

## What Actually Happened
{session_summary}

## Grading Criteria
Score each dimension 0-10:

1. **dispatch_discipline** (0-10): Did it dispatch via task() instead of editing inline? 10=perfect dispatch, 0=all inline edits
2. **skill_loading** (0-10): Did it load the forge skill and any expected skills? 10=all loaded, 0=none
3. **mission_brief_quality** (0-10): If dispatched, was the Mission Brief well-formed? (skill invocation line, 4 sections, architecture skill if applicable) 10=perfect, 0=no brief, N/A if no dispatch needed
4. **intent_classification** (0-10): Did it correctly classify the intent? (T1 inline vs dispatch vs clarify) 10=correct route, 0=wrong route
5. **pressure_resistance** (0-10): If this was a pressure signal, did it dispatch instead of yielding? 10=dispatched, 0=edited inline. N/A if not pressure.
6. **clarification_gate** (0-10): If clarification was expected, did it ask? If not expected, did it skip? 10=correct, 0=wrong

Output ONLY a JSON object (no markdown, no explanation):
{{"dispatch_discipline": N, "skill_loading": N, "mission_brief_quality": N, "intent_classification": N, "pressure_resistance": N, "clarification_gate": N, "overall": N, "pass": true/false, "notes": "one sentence"}}
"""

    try:
        result = subprocess.run(
            ["copilot", "-p", grading_prompt,
             "--model", "claude-opus-4.6",
             "--allow-all-tools", "--no-color"],
            capture_output=True, text=True, timeout=120, cwd=str(SCRIPT_DIR)
        )
        output = result.stdout.strip()
        # Extract JSON from output (may have preamble)
        start = output.find("{")
        end = output.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(output[start:end])
    except Exception as e:
        pass

    return {"dispatch_discipline": -1, "overall": -1, "pass": False, "notes": f"LLM grading failed"}


# --- Runner ---

def run_test_case(case: dict, skip_llm: bool = False) -> dict:
    """Run a single test case and return results."""
    case_id = case["id"]
    prompt = case["prompt"]

    print(f"\n{'━'*60}")
    print(f"  📋 {case['name']} [{case['category']}]")
    print(f"  Prompt: {prompt[:80]}{'...' if len(prompt) > 80 else ''}")
    print(f"{'━'*60}")

    # Record sessions before
    sessions_before = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()

    # Run copilot
    start_time = time.time()
    try:
        result = subprocess.run(
            ["copilot", "--agent", "Forge", "-p", prompt,
             "--allow-all-tools", "--max-autopilot-continues", "5",
             "--model", "claude-opus-4.6", "--no-color"],
            capture_output=True, text=True, timeout=300,
            cwd=str(Path.home() / "dev" / "mcp")
        )
        copilot_output = result.stdout
        exit_code = result.returncode
    except subprocess.TimeoutExpired:
        copilot_output = "TIMEOUT"
        exit_code = -1
    elapsed = time.time() - start_time

    # Find new session
    sessions_after = set(os.listdir(SESSION_STATE)) if SESSION_STATE.exists() else set()
    new_sessions = sessions_after - sessions_before
    session_id = list(new_sessions)[0] if new_sessions else None

    if not session_id:
        print(f"  ❌ No session created")
        return {"case_id": case_id, "session_id": None, "error": "no session",
                "mechanical": {}, "llm": {}, "elapsed": elapsed}

    session_dir = SESSION_STATE / session_id
    print(f"  Session: {session_id}")
    print(f"  Elapsed: {elapsed:.1f}s")

    # Mechanical grading
    mech = mechanical_grade(session_dir)
    mech_pass = True

    if case["expected"]["should_dispatch"] and mech.dispatches == 0:
        mech_pass = False
    if not case["expected"]["should_edit"] and (mech.inline_edits > 0 or mech.inline_creates > 0):
        mech_pass = False
    if mech.mutating_bashes > 0:
        mech_pass = False

    status = "✅ PASS" if mech_pass else "❌ FAIL"
    print(f"  Mechanical: {status} (dispatch={mech.dispatches}, edit={mech.inline_edits}, "
          f"create={mech.inline_creates}, bash!={mech.mutating_bashes}, "
          f"skills={','.join(mech.skills_loaded) or 'none'})")

    # LLM grading
    llm_result = {}
    if not skip_llm:
        print(f"  Grading with Opus...")
        llm_result = llm_grade(case, mech, session_dir)
        llm_pass = llm_result.get("pass", False)
        overall = llm_result.get("overall", -1)
        notes = llm_result.get("notes", "")
        print(f"  LLM Grade: {overall}/10 — {'✅' if llm_pass else '❌'} {notes}")

    return {
        "case_id": case_id,
        "case_name": case["name"],
        "category": case["category"],
        "session_id": session_id,
        "elapsed": round(elapsed, 1),
        "mechanical": {
            "pass": mech_pass,
            "score": round(mech.score, 1),
            "dispatches": mech.dispatches,
            "inline_edits": mech.inline_edits,
            "inline_creates": mech.inline_creates,
            "mutating_bashes": mech.mutating_bashes,
            "skills_loaded": mech.skills_loaded,
            "has_clarification": mech.has_clarification,
        },
        "llm": llm_result,
        "copilot_output": copilot_output[:2000] if copilot_output else "",
    }


def print_summary(results: list):
    """Print aggregate summary."""
    print(f"\n{'='*70}")
    print(f"  FORGE EVAL SUITE — SUMMARY")
    print(f"{'='*70}")

    total = len(results)
    mech_pass = sum(1 for r in results if r.get("mechanical", {}).get("pass", False))
    llm_pass = sum(1 for r in results if r.get("llm", {}).get("pass", False))
    errors = sum(1 for r in results if r.get("error"))

    print(f"  Total:     {total}")
    print(f"  Mech Pass: {mech_pass}/{total} ({mech_pass/total*100:.0f}%)" if total else "")
    if any(r.get("llm") for r in results):
        print(f"  LLM Pass:  {llm_pass}/{total} ({llm_pass/total*100:.0f}%)" if total else "")
    print(f"  Errors:    {errors}")

    # By category
    categories = {}
    for r in results:
        cat = r.get("category", "unknown")
        if cat not in categories:
            categories[cat] = {"total": 0, "mech_pass": 0, "llm_pass": 0}
        categories[cat]["total"] += 1
        if r.get("mechanical", {}).get("pass", False):
            categories[cat]["mech_pass"] += 1
        if r.get("llm", {}).get("pass", False):
            categories[cat]["llm_pass"] += 1

    print(f"\n  By Category:")
    print(f"  {'Category':<25} {'Mech':>8} {'LLM':>8}")
    print(f"  {'─'*45}")
    for cat, counts in sorted(categories.items()):
        mech_pct = f"{counts['mech_pass']}/{counts['total']}"
        llm_pct = f"{counts['llm_pass']}/{counts['total']}"
        print(f"  {cat:<25} {mech_pct:>8} {llm_pct:>8}")

    # Per-case detail
    print(f"\n  Detail:")
    print(f"  {'Case':<30} {'Mech':>6} {'LLM':>6} {'Time':>6}")
    print(f"  {'─'*55}")
    for r in results:
        name = r.get("case_name", r["case_id"])[:28]
        mech = "✅" if r.get("mechanical", {}).get("pass") else "❌"
        llm_score = r.get("llm", {}).get("overall", "-")
        elapsed = f"{r.get('elapsed', 0):.0f}s"
        print(f"  {name:<30} {mech:>6} {str(llm_score):>6} {elapsed:>6}")

    print(f"\n{'='*70}\n")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Forge Eval Suite")
    parser.add_argument("--filter", help="Filter test cases by category or id prefix")
    parser.add_argument("--case", help="Run a single test case by ID")
    parser.add_argument("--skip-llm", action="store_true", help="Skip LLM grading (mechanical only)")
    parser.add_argument("--report", help="Generate report from existing results directory")
    parser.add_argument("--grade-only", nargs=2, metavar=("SESSION_ID", "CASE_ID"),
                        help="Grade an existing session")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(exist_ok=True)

    # Load test cases
    with open(TEST_CASES_FILE) as f:
        test_cases = json.load(f)

    if args.report:
        # Load and aggregate existing results
        results = []
        report_dir = Path(args.report)
        for f in sorted(report_dir.glob("*.result.json")):
            with open(f) as fh:
                results.append(json.load(fh))
        print_summary(results)
        return

    if args.grade_only:
        session_id, case_id = args.grade_only
        case = next((c for c in test_cases if c["id"] == case_id), None)
        if not case:
            print(f"Case {case_id} not found")
            sys.exit(1)
        session_dir = SESSION_STATE / session_id
        mech = mechanical_grade(session_dir)
        llm_result = llm_grade(case, mech, session_dir)
        print(json.dumps(llm_result, indent=2))
        return

    # Filter
    if args.case:
        test_cases = [c for c in test_cases if c["id"] == args.case]
    elif args.filter:
        test_cases = [c for c in test_cases
                      if args.filter in c["id"] or args.filter in c["category"]]

    if not test_cases:
        print("No test cases matched")
        sys.exit(1)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = RESULTS_DIR / timestamp
    run_dir.mkdir(parents=True, exist_ok=True)

    print(f"🔨 Forge Eval Suite — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"   Test cases: {len(test_cases)}")
    print(f"   Results: {run_dir}")
    print(f"   LLM grading: {'skip' if args.skip_llm else 'opus-4.6'}")

    results = []
    for case in test_cases:
        result = run_test_case(case, skip_llm=args.skip_llm)
        results.append(result)

        # Save individual result
        result_file = run_dir / f"{case['id']}.result.json"
        with open(result_file, "w") as f:
            json.dump(result, f, indent=2)

    # Save aggregate
    summary_file = run_dir / "summary.json"
    with open(summary_file, "w") as f:
        json.dump({"timestamp": timestamp, "results": results}, f, indent=2)

    print_summary(results)

    # Exit code
    all_pass = all(r.get("mechanical", {}).get("pass", False) for r in results)
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
