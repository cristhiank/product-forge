# Data, Persistence, and Schema Evolution

## Core Host Data Strategy

Start with the simplest viable data topology:
- One physical database
- One schema per module, one data-access context per module

Rules:
- No cross-schema joins in application code
- Each module only queries its own schema and uses its own data-access context

If a module needs data from another:
- Use a read service interface from the provider module's contracts
- Consume events and maintain a local read model
- Call an HTTP endpoint exposed by that module

## Embedded Database as Default Strategy

For platforms that do not yet need a client-server database, an embedded database (e.g., SQLite) is the preferred starting point:

- One database file per deployment, shared across modules (one schema namespace per module)
- WAL mode or equivalent for concurrent read-write access
- Connection-level configuration (journal mode, busy timeout, synchronous mode) applied on every connection open, not stored in migrations
- Queue tables inside the same database replace file-based job queues — indexed polling, atomic lease operations, row-level state tracking
- Full-text search indexes for content queries instead of in-memory substring scanning
- Binary data stored as BLOBs when small and few; external file storage with database references when volume grows

The embedded database must respect the same module ownership and isolation rules. Each module owns its tables and indexes. Cross-module access happens through contracts.

### When to Migrate to Client-Server Database

Migrate when hitting:
- Sustained write throughput beyond serialization ceiling
- Multi-node deployment requirements
- Dataset size beyond comfortable single-file range

The migration path is straightforward when schemas use standard SQL and parameterized queries with minimal dialect-specific features.

## Reads, Writes, and Performance

- **Read paths** — Project directly into DTOs or read models without hydrating full aggregates. Optimize for IO and memory with field selection and pagination. Free to bypass aggregates if no invariant enforcement needed.

- **Write paths with invariants** — Load exactly the data needed to validate and apply a change. Use aggregates only where a real business rule demands consistency.

Avoid loading large aggregates for operations that touch only a small part of the data.

## Schema Evolution Principles

1. **Migrations are the only way to change the schema.** No manual DDL, no ad-hoc ALTER TABLE, no schema changes in application code. Every change is a numbered migration file in version control.

2. **Migrations are forward-only.** Applied exactly once, in order, never modified after application to any environment. If wrong, write a new correcting migration.

3. **Each module owns its migrations.** Migration files live in the owning module's infrastructure folder. No module writes migrations for another's tables.

4. **Migrations are plain SQL.** Written in the database's native dialect, not ORM abstractions. Readable, portable, explicit.

5. **Separate schema from runtime configuration.** Pragmas, journal modes, cache sizes are runtime config applied on connection open. Not in migrations.

6. **Use a migration runner.** Provides ordered execution, applied-script tracking, checksum detection, transaction wrapping, failure reporting. Do not hand-roll version tracking.

7. **Migrations must be idempotent where possible.** Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.

8. **Keep migrations small and focused.** One logical change per file. Easier to review, debug, and limit blast radius.

9. **Test migrations against real databases.** Integration tests create a fresh database, run all migrations, exercise application code.

10. **Backwards-compatible within a release.** Safe sequence: (a) add new structure, (b) update code, (c) remove old structure in a later migration.

## Migration File Conventions

- Named with version prefix: `V001__Initial_schema.sql`, `V002__Add_user_preferences.sql`
- Version prefix is unique and monotonically increasing
- Embedded as resource or placed in a well-known directory
- Contains raw SQL, no framework-specific annotations

## What Belongs in a Migration

| Belongs | Does NOT Belong |
|---------|-----------------|
| CREATE TABLE | PRAGMA / SET statements (runtime config) |
| ALTER TABLE (add column, rename) | Connection pool settings |
| CREATE INDEX | Seed data that changes per environment |
| CREATE TRIGGER | Application logic or stored procedures with business rules |
| CREATE VIRTUAL TABLE (FTS, etc.) | Temporary tables for one-time data fixes |
| DROP TABLE / DROP INDEX (cleanup) | |
| Data backfill for structural changes | |

## Migration Runner Integration

Called once during startup, before serving requests:

1. Open database connection
2. Create tracking table if it does not exist
3. Discover all migration files from resources or configured directory
4. Compare against tracking table for pending migrations
5. Execute pending migrations in version order, within transactions
6. Record each successful migration
7. Fail fast if any migration fails — application does not start with partial schema
