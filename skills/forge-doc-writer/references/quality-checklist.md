# Documentation Quality Checklist

Verification protocols for ensuring documentation accuracy and freshness.

---

## Code-to-Doc Verification Checklist

Use this checklist when writing or updating any platform/module reference doc. Every item must be verified against actual source code — not from memory, not from old docs.

### Interfaces & Contracts

- [ ] **All public interfaces listed** — grep for `public interface I*` in the module's Contracts project
- [ ] **Method signatures match** — parameter names, types, return types, async markers
- [ ] **No missing methods** — compare doc interface listing against code file
- [ ] **No removed methods still documented** — check for methods that were deleted or renamed
- [ ] **Inheritance noted** — if interface extends another, document it

### DTOs & Records

- [ ] **All public DTOs/records listed** — grep for `public record`, `public class *Dto`, `public enum`
- [ ] **All fields present** — check every property in the source
- [ ] **Types are correct** — `string` vs `string?`, `int` vs `long`, etc.
- [ ] **Default values are correct** — check property initializers
- [ ] **Enums fully listed** — all enum members with values if non-sequential

### DI Registration

- [ ] **AddX() method documented** — the extension method that registers the module
- [ ] **All services registered** — grep for `services.Add*` in the registration method
- [ ] **Lifetimes correct** — Scoped, Singleton, Transient match the code
- [ ] **Conditional registrations noted** — any `if (options.X)` guards documented

### Configuration

- [ ] **Options class properties match** — all properties, types, defaults
- [ ] **Config section name correct** — the string used in `configuration.GetSection("X")`
- [ ] **Environment variable overrides noted** — if any exist
- [ ] **Validation rules documented** — any `[Range]`, `[Required]`, custom validators

### Database Schema

- [ ] **Tables match migrations** — table names, column names, types
- [ ] **Indexes listed** — all non-default indexes
- [ ] **Foreign keys noted** — relationships between tables
- [ ] **Recent migrations reflected** — check the latest migration file matches the doc

### Events & Integration

- [ ] **Event types listed** — all domain events published by this module
- [ ] **Payload types documented** — the event data class/record
- [ ] **Publishers identified** — which service raises each event
- [ ] **Consumers identified** — which services/handlers listen
- [ ] **Event flow described** — the sequence from trigger to handler

### Usage Examples

- [ ] **Examples compile** — code uses current method names and signatures
- [ ] **Imports are correct** — using statements/namespaces match current code
- [ ] **Examples are minimal** — show one concept per example, not kitchen-sink demos
- [ ] **Expected output noted** — what the example produces when run

---

## Freshness Verification Protocol

Use when auditing an existing doc for staleness.

### Quick Freshness Check (5 minutes)

1. **Check the last commit** that touched the doc: `git log -1 --format="%H %ai" -- path/to/doc.md`
2. **Check the last commit** that touched the source: `git log -1 --format="%H %ai" -- path/to/source/`
3. **Compare dates** — if source is newer than doc, the doc is potentially stale
4. **Spot-check 3 items:**
   - Pick a random interface → verify method count matches code
   - Pick a random DTO → verify field count matches code
   - Pick a config property → verify default matches code

### Deep Freshness Audit (30 minutes per module)

1. Run the full Code-to-Doc Verification Checklist above
2. For each failing item, note the discrepancy
3. Categorize: **Wrong** (incorrect info) vs **Missing** (new stuff not documented) vs **Removed** (doc describes deleted code)
4. Prioritize: Wrong > Missing > Removed (wrong docs are worse than incomplete docs)

---

## Parallel Worker Documentation Protocol

For large doc refreshes involving 3+ modules, use the parallel worker pattern.

### Orchestrator Responsibilities

1. **Inventory** — List all docs that need refresh and their corresponding source directories
2. **Partition into tracks** — Group docs so NO two workers touch the same file
3. **Create worker prompts** — Each worker gets a self-contained prompt with:
   - Which docs to read (existing structure/style to follow)
   - Which source directories to compare against
   - The full verification checklist (copy it into the prompt)
   - Numbered "What To Do" steps
4. **Launch workers** — All workers run in parallel
5. **Run index worker last** — After all module workers complete, a final worker regenerates the README/index

### Worker Prompt Template

```
You are Worker [ID], operating in parallel mode.

## Your Task
Regenerate documentation for the [Module] module.

## What To Do
1. Read the EXISTING doc at [path] — it defines the structure and style to follow.
2. Read the CURRENT source code at [source path].
3. Regenerate the doc keeping the SAME structure:
   - [List all required sections]
4. Verify every item against the Code-to-Doc Checklist.

## Verification Checklist
[Paste the full checklist here]

## Output Rules
- Keep the same Markdown heading structure as the existing doc
- Update ALL content to match current source
- Add new sections only if there are new public contracts not in the old doc
- Remove sections for deleted code
```

### Track Partitioning Rules

- **No file overlap** between workers — zero merge conflicts
- **Group by module boundary** — one worker per module or small group
- **Index worker is always last** — it reads summaries from other workers' output
- **Each worker is stateless** — full context in the prompt, no dependencies on other workers

---

## Documentation Health Metrics

When reporting on documentation health:

| Metric | How to Measure | Good | Warning | Bad |
|--------|----------------|------|---------|-----|
| **Freshness** | Days since doc update vs source update | <7 days | 7-30 days | >30 days |
| **Coverage** | Public interfaces documented / total public interfaces | >90% | 70-90% | <70% |
| **Example health** | Examples that compile / total examples | 100% | >80% | <80% |
| **Quadrant balance** | Tutorials + How-Tos present per module | Both exist | One exists | Neither |
| **Sprawl** | Locations documenting the same topic | 1 | 2 | 3+ |
