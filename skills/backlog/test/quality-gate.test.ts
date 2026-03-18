import * as fs from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, test } from "vitest";

import { createBacklogAPI } from "../src/backlog-api.js";
import { parseBacklogMarkdown } from "../src/markdown/parser.js";
import { validateBacklogItem } from "../src/markdown/validate.js";
import { singleProjectStore } from "../src/storage/multi-root-store.js";
import { makeTempBacklogRootFromFixture } from "./test-helpers.js";

describe("parser — acceptance criteria extraction", () => {
  test("detects empty placeholder checkboxes", () => {
    const md = `# B-001: Test Item

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Some goal.

## Acceptance Criteria

- [ ]
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.acceptance_criteria.total).toBe(1);
    expect(parsed.acceptance_criteria.with_content).toBe(0);
    expect(parsed.acceptance_criteria.empty).toBe(1);
  });

  test("detects checkboxes with real content", () => {
    const md = `# B-001: Test Item

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Some goal.

## Acceptance Criteria

- [ ] User can log in with email
- [ ] JWT tokens are validated
- [x] Database schema exists
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.acceptance_criteria.total).toBe(3);
    expect(parsed.acceptance_criteria.with_content).toBe(3);
    expect(parsed.acceptance_criteria.empty).toBe(0);
  });

  test("detects mix of empty and real checkboxes", () => {
    const md = `# B-001: Test

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Test

## Acceptance Criteria

- [ ] Real criterion
- [ ]
- [ ] Another real one
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.acceptance_criteria.total).toBe(3);
    expect(parsed.acceptance_criteria.with_content).toBe(2);
    expect(parsed.acceptance_criteria.empty).toBe(1);
  });

  test("detects no checkboxes at all", () => {
    const md = `# B-001: Test

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Test

## Acceptance Criteria

Just some text without checkboxes.
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.acceptance_criteria.total).toBe(0);
    expect(parsed.acceptance_criteria.with_content).toBe(0);
    expect(parsed.acceptance_criteria.empty).toBe(0);
  });

  test("parses Done When section as acceptance criteria", () => {
    const md = `# B-001: Test

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Test

## Done When

- [ ] src/auth.ts implements JWT
- [ ] Tests pass
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.acceptance_criteria.total).toBe(2);
    expect(parsed.acceptance_criteria.with_content).toBe(2);
    expect(parsed.has_done_when).toBe(true);
  });

  test("detects Scope section", () => {
    const md = `# B-001: Test

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Test

## Scope

Only modify src/auth/.

## Acceptance Criteria

- [ ] Done
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.has_scope).toBe(true);
  });

  test("returns false for missing Done When and Scope", () => {
    const md = `# B-001: Test

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Test

## Acceptance Criteria

- [ ] AC 1
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.has_done_when).toBe(false);
    expect(parsed.has_scope).toBe(false);
  });
});

describe("validate — content quality warnings", () => {
  test("warns on empty placeholder acceptance criteria", () => {
    const item = {
      id: "B-001",
      title: "Test",
      folder: "next" as const,
      path: "next/B-001_test.md",
      body: `# B-001: Test

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Some real goal.

## Acceptance Criteria

- [ ]
`,
      metadata: { Created: "2026-01-15", Type: "Story", Priority: "High", Status: "Not Started" },
    };
    const result = validateBacklogItem(item);
    expect(result.ok).toBe(true); // Structural validation passes
    expect(result.warnings.some(w => w.includes("empty placeholder"))).toBe(true);
  });

  test("warns on placeholder goal text", () => {
    const item = {
      id: "B-001",
      title: "Test",
      folder: "next" as const,
      path: "next/B-001_test.md",
      body: `# B-001: Test

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

(describe the goal)

## Acceptance Criteria

- [ ] Real criterion
`,
      metadata: { Created: "2026-01-15", Type: "Story", Priority: "High", Status: "Not Started" },
    };
    const result = validateBacklogItem(item);
    expect(result.warnings.some(w => w.includes("goal section is empty or has placeholder"))).toBe(true);
  });

  test("warns story without Done When or Scope", () => {
    const item = {
      id: "B-001",
      title: "Test",
      folder: "next" as const,
      path: "next/B-001_test.md",
      body: `# B-001: Test

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Real goal here.

## Acceptance Criteria

- [ ] Something real
`,
      metadata: { Created: "2026-01-15", Type: "Story", Priority: "High", Status: "Not Started" },
    };
    const result = validateBacklogItem(item);
    expect(result.warnings.some(w => w.includes("Done When"))).toBe(true);
  });

  test("does not warn epic about missing Done When/Scope", () => {
    const item = {
      id: "B-001",
      title: "Test",
      folder: "next" as const,
      path: "next/B-001_test.md",
      body: `# B-001: Test

**Created:** 2026-01-15
**Type:** Epic
**Priority:** High
**Status:** Not Started

---

## Goal

Real epic goal.

## Acceptance Criteria

- [ ] Children complete
`,
      metadata: { Created: "2026-01-15", Type: "Epic", Priority: "High", Status: "Not Started" },
    };
    const result = validateBacklogItem(item);
    expect(result.warnings.every(w => !w.includes("Done When"))).toBe(true);
  });

  test("no warnings for well-formed item", () => {
    const item = {
      id: "B-001",
      title: "Test",
      folder: "next" as const,
      path: "next/B-001_test.md",
      body: `# B-001: Test

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Implement JWT-based auth.

## Scope

Only modify src/auth/.

## Done When

- [ ] src/auth/jwt.ts exports generateToken
- [ ] Tests pass

## Acceptance Criteria

- [ ] The story is complete when Done When conditions are met.
`,
      metadata: { Created: "2026-01-15", Type: "Story", Priority: "High", Status: "Not Started" },
    };
    const result = validateBacklogItem(item);
    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  test("accepts Done When as alternative to Acceptance Criteria header", () => {
    const item = {
      id: "B-001",
      title: "Test",
      folder: "next" as const,
      path: "next/B-001_test.md",
      body: `# B-001: Test

**Created:** 2026-01-15
**Type:** Story
**Priority:** High
**Status:** Not Started

---

## Goal

Real goal.

## Scope

src/auth/

## Done When

- [ ] Auth works
- [ ] Tests pass
`,
      metadata: { Created: "2026-01-15", Type: "Story", Priority: "High", Status: "Not Started" },
    };
    const result = validateBacklogItem(item);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });
});

describe("create — quality warnings in response", () => {
  test("returns warnings when no acceptance_criteria provided", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const created = await backlog.create({
        kind: "task",
        title: "Quick item",
        priority: "medium",
      });

      expect(created.warnings.length).toBeGreaterThan(0);
      expect(created.warnings.some(w => w.includes("QUALITY"))).toBe(true);
      expect(created.warnings.some(w => w.includes("Acceptance criteria"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test("returns warnings when no description provided", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const created = await backlog.create({
        kind: "task",
        title: "No description item",
        acceptance_criteria: ["Real criterion"],
        priority: "high",
      });

      expect(created.warnings.some(w => w.includes("Goal section"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test("returns no warnings when fully specified", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const created = await backlog.create({
        kind: "task",
        title: "Complete item",
        description: "This item has a real goal.",
        acceptance_criteria: ["API returns 200", "Tests pass"],
        priority: "high",
        tags: ["api"],
      });

      expect(created.warnings).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});

describe("hygiene — incomplete item detection", () => {
  test("detects items with empty placeholder acceptance criteria", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      // Create an item without acceptance criteria (produces empty placeholder)
      await backlog.create({
        kind: "task",
        title: "Placeholder item",
        priority: "medium",
      });

      const result = await backlog.hygiene();
      expect(result.incomplete_items.length).toBeGreaterThan(0);
      expect(result.incomplete_items.some(i => i.reason.includes("empty placeholders"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test("incomplete items degrade health score", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      // Create several items without AC to trigger unhealthy
      for (let i = 0; i < 5; i++) {
        await backlog.create({ kind: "task", title: `Incomplete ${i}`, priority: "low" });
      }

      const result = await backlog.hygiene();
      expect(result.incomplete_items.length).toBeGreaterThanOrEqual(5);
      expect(result.health_score).not.toBe("healthy");
    } finally {
      await cleanup();
    }
  });

  test("does not flag items with real acceptance criteria", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const created = await backlog.create({
        kind: "task",
        title: "Good item",
        description: "Real goal",
        acceptance_criteria: ["Tests pass", "No errors"],
        priority: "high",
      });

      const result = await backlog.hygiene();
      expect(result.incomplete_items.every(i => i.id !== created.id)).toBe(true);
    } finally {
      await cleanup();
    }
  });

  test("brief surfaces incomplete items", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      await backlog.create({ kind: "task", title: "Incomplete", priority: "low" });

      const brief = await backlog.brief();
      expect(brief.incomplete_items.length).toBeGreaterThan(0);
      expect(brief.issues).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });
});
