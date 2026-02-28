# DevPartner v17 — Git Worktree Strategy

## Overview

v17 uses git worktrees to isolate parallel workers. Each worker gets its own working directory on a feature branch, sharing the same .git store.

## Why Worktrees?

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| **git worktree** | Lightweight, shared .git, instant create/delete, branches are real | Requires same machine, shared reflog | ✅ Chosen |
| **git clone** | Full isolation, works across machines | Heavy (full copy), separate .git, slow | ❌ Overkill |
| **git stash + branch** | Simple | No concurrent work, state management nightmare | ❌ Sequential |
| **Docker containers** | Full isolation including env | Heavy setup, complex networking | ❌ Over-engineered |

## Worktree Layout

```
project/                              ← Main working directory (main branch)
├── .devpartner/
│   └── hub.db                        ← Shared hub database
├── .git/                             ← Shared git store
├── src/
├── package.json
└── ...

../worktree-B042/                     ← Worker B-042 worktree
├── .devpartner/ → symlink            ← Symlink to main's .devpartner/
├── src/                              ← Independent working copy
├── package.json
└── ...

../worktree-B043/                     ← Worker B-043 worktree
├── .devpartner/ → symlink
├── src/
└── ...
```

### Key Points

1. **Hub database is shared** — All workers access the same `hub.db` in the main directory
2. **Working copies are independent** — Each worktree has its own file tree
3. **.git is shared** — All worktrees share the same git object store
4. **Branches are real** — `feature/B-042` is a real git branch visible to all

## Worktree Lifecycle

### Create

```bash
# From main directory
cd /path/to/project

# Create worktree + branch
git worktree add ../worktree-B042 -b feature/B-042

# Symlink .devpartner for hub access
ln -s /path/to/project/.devpartner ../worktree-B042/.devpartner

# Verify
git worktree list
# /path/to/project             abc1234 [main]
# /path/to/project/../worktree-B042  abc1234 [feature/B-042]
```

### Work (by Worker Orchestrator)

```bash
# Worker operates in its worktree
cd ../worktree-B042

# Normal git operations on its branch
git add src/auth/reset.ts
git commit -m "feat: implement password reset token generation"

# Worker can see main branch state
git log --oneline main..HEAD  # What worker has done
git log --oneline HEAD..main  # What changed in main since worker started
```

### Merge

```bash
# Super-Orchestrator merges from main directory
cd /path/to/project

# Merge completed worker's branch
git merge feature/B-042 --no-ff -m "merge: B-042 password reset implementation"
```

### Cleanup

```bash
# Remove worktree
git worktree remove ../worktree-B042

# Delete branch (already merged)
git branch -d feature/B-042

# Prune stale worktree references
git worktree prune
```

## Branch Naming Convention

```
feature/B-042          ← Standard backlog item
feature/B-042-retry-1  ← Retry after failure
hotfix/B-099           ← Urgent fix
```

## Merge Strategy

### Order

First worker to complete merges first to main. Subsequent workers merge on top.

```
Timeline:
  t=0:   main at commit A
         Worker B042 starts from A
         Worker B043 starts from A
  t=5:   Worker B043 completes → merge to main → main at commit B (A + B043)
  t=10:  Worker B042 completes → merge to main → main at commit C (B + B042)
```

### Conflict Classification

| Type | Example | Auto-resolve? |
|------|---------|:---:|
| **Clean** | Changes in different files | ✅ Always |
| **Trivial** | Import order, trailing whitespace, line endings | ✅ Auto |
| **Resolvable** | Same file, different sections (>10 lines apart) | ✅ Usually |
| **Complex** | Same function modified differently | ❌ Ask user |
| **Destructive** | One worker deleted a file another modified | ❌ Ask user |

### Conflict Resolution Flow

```
git merge feature/B-042
  ├── Exit 0 (clean) → done
  └── Exit 1 (conflicts)
      ├── git diff --name-only --diff-filter=U  → list conflicted files
      ├── For each file:
      │   ├── Count conflict markers
      │   ├── Analyze: are conflicts in different functions? → auto-resolve
      │   ├── Analyze: is it just formatting? → take ours
      │   └── Complex? → flag for user
      ├── If all auto-resolved:
      │   ├── git add .
      │   └── git commit -m "merge: B-042 (auto-resolved)"
      └── If any complex:
          ├── git merge --abort
          ├── Notify user via hub
          └── Wait for user resolution
```

## Rebase vs Merge

**Decision: Merge (not rebase)**

| Factor | Merge | Rebase |
|--------|-------|--------|
| History clarity | Merge commits show integration points | Linear but loses parallel history |
| Conflict handling | One-time at merge | May need to resolve at each commit |
| Safety | Non-destructive | Rewrites history (risky with parallel workers) |
| Automation ease | Simple | Complex (abort/continue cycles) |

We use `--no-ff` to always create a merge commit, making it clear where worker contributions were integrated.

## Edge Cases

### Worker Needs Updated Main

If Worker B-042 needs changes that were merged from Worker B-043:

```
Worker posts request:
  "Need latest changes from main (B-043's auth types)"

Super-Orchestrator resolves:
  Option A: Tell worker to `git merge main` into its branch
  Option B: Abort worker, re-spawn on updated main
  
  Prefer A for small updates, B for major conflicts.
```

### Worker Modifies Shared Config Files

Files like `package.json`, `tsconfig.json`, `.env.example` are high-conflict risk:

```
Strategy:
  1. Super-Orchestrator warns at spawn: "B-042 and B-043 both likely modify package.json"
  2. Workers are instructed: "Minimize changes to shared config files"
  3. On merge: these conflicts are usually auto-resolvable (add both dependencies)
```

### Worktree Cleanup After Crash

```bash
# List orphaned worktrees
git worktree list

# Remove stale worktrees
git worktree prune

# Force remove a locked worktree
git worktree remove --force ../worktree-B042
```

## Limitations

- **Same machine only**: Worktrees share a .git store, so all workers must be on the same filesystem
- **Branch contention**: If two workers need changes from main, the first-to-merge blocks the second briefly
- **No partial merges**: A worker's entire branch merges or doesn't. No cherry-picking individual commits (unless user intervenes)
- **Submodules**: Worktrees + submodules = complexity. Not supported in v17 initially.
