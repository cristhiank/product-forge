# Architecture Decision Frameworks

Use these when choosing between competing valid approaches. Each framework gives the "choose X when..." conditions — not a single right answer.

## Schema Migration vs Metadata/JSON Field

**Choose schema migration when:**
- Data has a fixed, well-understood structure
- You need to index, filter, or join on the data
- Multiple modules or consumers will query it
- The data is part of the module's core domain model

**Choose metadata/JSON field when:**
- Shape is still evolving or not yet stable
- Data is module-private (no cross-module queries)
- You want to avoid migration risk on an existing table
- The data is supplementary or derived (can be recomputed)

**Hybrid**: Store the canonical fields in schema columns, put the variable/evolving parts in a metadata JSON column. Promote fields to schema columns once they stabilize.

## New Module vs Extend Existing Module

**New module when:**
- Different business capability or domain language
- Different data ownership boundary (needs its own tables)
- Different team ownership or release cadence
- The new functionality has >3 unrelated features

**Extend existing module when:**
- Same bounded context and domain language
- Shared invariants or transactional consistency needs
- Small addition (<500 LOC, 1-2 features)
- Extracting would create circular dependencies between the two modules

**Warning sign**: If extending a module requires touching >5 existing files unrelated to your feature, it may belong in a new module.

## API Granularity: Fine-Grained vs Aggregate Endpoints

**Fine-grained (individual endpoints) when:**
- Different authorization requirements per operation
- Different caching strategies or TTLs
- Different consumers use different subsets
- Operations have different performance profiles (one is fast, another slow)

**Aggregate (combined endpoint) when:**
- Data is always consumed together by all callers
- Reducing round-trips matters (high-latency clients, mobile)
- Same authorization applies to the whole bundle
- The aggregate is a natural domain concept (e.g., "dashboard summary")

**Default**: Start fine-grained. Introduce aggregate endpoints as a performance optimization when round-trip cost is measured, not assumed.

## Write-Time vs Query-Time Aggregation

**Write-time (materialize on ingest) when:**
- Aggregation is expensive to compute
- Consumers need low-latency reads
- Source data is append-only or rarely changes
- Aggregation logic is stable and well-understood

**Query-time (compute on read) when:**
- Flexible reporting with varied dimensions or filters
- Source data changes frequently (aggregates would constantly invalidate)
- Storage is cheap and dataset fits in memory/cache
- Aggregation logic is still evolving

**Hybrid**: Write-time for hot-path dashboards, query-time for ad-hoc exploration.

## Where to Put Shared Logic

**Shared kernel when:**
- Logic is genuinely domain-neutral (IDs, timestamps, pagination, error types)
- Used by 3+ modules
- Has no domain-specific behavior or vocabulary
- Changes rarely

**Contract in the owning module when:**
- Logic belongs to a specific domain concept
- Only 1-2 other modules need it
- The owning module controls the evolution

**Duplicate (yes, copy) when:**
- Coupling cost exceeds duplication cost
- Each consumer might diverge in the future
- The logic is <20 lines and trivial

**Warning sign**: If shared code requires importing domain types from multiple modules, it is not truly shared — it is a missing bounded context.

## Modeling Style Selection

**Transaction-style handlers (default) when:**
- CRUD with light validation
- Orchestration across services (call A, then B, then C)
- Data enrichment or transformation pipelines
- No real business invariants beyond "field is required"

**Focused domain models when:**
- Real business rules that protect consistency ("balance cannot go negative")
- State transitions with guards ("order can only be cancelled if not shipped")
- Multiple operations must respect the same invariant

**Full DDD when:**
- Core domain complexity is the primary challenge
- Rich domain events drive downstream behavior
- Complex aggregate boundaries with cross-entity invariants
- The domain expert's language maps directly to code

**Escalation rule**: Start with transaction-style. Promote to focused domain model when you find yourself scattering the same validation across multiple handlers. Promote to full DDD only when focused models can't express the complexity.

## Sync vs Async Communication Between Modules

**Synchronous (direct call through contract interface) when:**
- Caller needs the result to proceed
- Operation is fast (<100ms typical)
- Strong consistency is required
- Failure should propagate to the caller

**Asynchronous (events/messages) when:**
- Caller doesn't need the result immediately
- Operations can be retried independently
- Eventual consistency is acceptable
- You want to decouple module lifecycles

**Default**: Start synchronous. Introduce async when you observe coupling pain (module A's deploy breaks module B) or performance bottlenecks from waiting.
