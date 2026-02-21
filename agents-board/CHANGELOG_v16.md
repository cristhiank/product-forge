# v16 Changes - Agent Board MCP Server

## Changes Applied

### 1. ✅ Added "planner" to AgentRole (src/types/core.ts)
- Added JSDoc comment listing all 6 valid roles including "planner"
- Location: Line 33-37
- Valid roles: "orchestrator", "scout", "creative", "planner", "verifier", "executor"

### 2. ✅ Added git_hash to Snippet interface (src/types/core.ts)
- Added optional `git_hash?: string` field to track Git commit hash
- Purpose: Detect staleness when file's current hash differs from cached hash
- Location: After `verified_at` field (line 329-330)

### 3. ✅ Added backlog_ref to Mission interface (src/types/core.ts)
- Added optional `backlog_ref?: string` field
- Purpose: Link tasks to backlog item IDs
- Location: End of Mission interface (line 107-108)

### 4. ✅ Updated MCP server enum (dist/mcp/server.js)
- Added "planner" to the agent enum in board tool schema
- Location: Line 87
- **NOTE**: Source file `src/mcp/server.ts` does not exist - updated dist file directly
- **TODO**: When source is restored, rebuild from source

### 5. ✅ Added checkpoint command (src/skill-cli.ts)
- New command: `checkpoint`
- Parameters:
  - `--task-id` (required): Task ID
  - `--agent` (required): Agent role
  - `--message` (required): Checkpoint message
  - `--path` (optional): Project path (default: cwd)
- Functionality:
  - Records current board state summary (phase, steps, facts count, etc.)
  - Creates an info alert with "checkpoint" tag
  - Returns checkpoint data as JSON with state snapshot
- Implementation:
  - Handler function: `handleCheckpoint()` (lines 629-667)
  - Switch case added (line 891-893)
  - Help text updated (lines 224-228)

## Permissions

### Planner Permissions (via canPerform function)
The permission system is **agent-agnostic** (operations.ts line 58-62). The `canPerform()` function returns `true` for all agents and all operations. This means the "planner" role automatically has:

- ✅ setPlan: YES (set_plan operation)
- ✅ addFact: YES (add_fact operation)
- ✅ addSnippet: YES (add_snippet operation)
- ✅ view/search: YES (read operations)
- ✅ raiseAlert: YES (raise_alert operation)
- ✅ appendTrail: YES (append_trail operation)
- ⚠️ proposeDecision: YES (propose_decision operation) - accessible but not recommended
- ⚠️ approveDecision: YES (approve_decision operation) - accessible but not recommended
- ⚠️ advanceStep: YES (advance_step operation) - accessible but not recommended
- ⚠️ completeStep: YES (complete_step operation) - accessible but not recommended

**Note**: The current permission system doesn't enforce role-based restrictions. Consumers can layer additional permission logic if needed.

## Build Status
✅ TypeScript compilation successful
✅ All type definitions exported correctly
✅ CLI help shows checkpoint command
✅ Distribution files updated

## Testing Recommendations
1. Test checkpoint command: `node dist/skill-cli.js checkpoint --task-id <id> --agent planner --message "Test checkpoint"`
2. Verify MCP server accepts "planner" role in board tool
3. Test git_hash field in snippet creation/retrieval
4. Test backlog_ref field in mission operations
5. Verify planner can execute permitted operations via MCP

## Files Modified
- `src/types/core.ts` - Added AgentRole comment, git_hash, backlog_ref
- `src/skill-cli.ts` - Added checkpoint command
- `dist/mcp/server.js` - Added "planner" to enum (manual edit)
- All dist files rebuilt via `npm run build`
