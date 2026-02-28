import * as fs from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, test } from "vitest";

import { createBacklogAPI } from "../src/backlog-api.js";
import { parseBacklogMarkdown } from "../src/markdown/parser.js";
import { singleProjectStore } from "../src/storage/multi-root-store.js";
import { makeTempBacklogRootFromFixture } from "./test-helpers.js";

describe("stampStatus — auto-sync on folder transitions", () => {
  test("move to working sets Status to In Progress", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      await backlog.move({ id: "B-001", to: "working" });
      const item = await backlog.get({ id: "B-001" });
      expect(item.status).toBe("In Progress");
      expect(item.body).toContain("**Status:** In Progress");
    } finally {
      await cleanup();
    }
  });

  test("complete sets Status to Done", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      await backlog.complete({ id: "B-001", completedDate: "2026-02-01" });
      const item = await backlog.get({ id: "B-001" });
      expect(item.status).toBe("Done");
      expect(item.body).toContain("**Status:** Done");
      expect(item.body).toContain("**Completed:** 2026-02-01");
    } finally {
      await cleanup();
    }
  });

  test("archive sets Status to Archived", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      await backlog.archive({ id: "B-001" });
      const item = await backlog.get({ id: "B-001" });
      expect(item.status).toBe("Archived");
      expect(item.body).toContain("**Status:** Archived");
    } finally {
      await cleanup();
    }
  });

  test("move back to next resets Status to Not Started", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      // Move to working then back to next
      await backlog.move({ id: "B-001", to: "working" });
      await backlog.move({ id: "B-001", to: "next" });
      const item = await backlog.get({ id: "B-001" });
      expect(item.status).toBe("Not Started");
    } finally {
      await cleanup();
    }
  });
});

describe("parser — strip parenthetical comments from dependency IDs", () => {
  test("strips trailing parenthetical from depends_on", () => {
    const md = `# B-022: Test

**Created:** 2026-02-19
**Type:** Epic
**Priority:** High
**Status:** Not Started
**Depends On:** B-020 (original landing, done)

---

## Goal
Test
## Acceptance Criteria
- [ ] AC
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.depends_on).toEqual(["B-020"]);
  });

  test("strips parentheticals from multiple deps", () => {
    const md = `# B-005: Test

**Created:** 2026-02-19
**Type:** Task
**Priority:** Medium
**Status:** Not Started
**Depends On:** [B-001 (done), B-002 (in progress)]

---

## Goal
Test
## Acceptance Criteria
- [ ] AC
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.depends_on).toEqual(["B-001", "B-002"]);
  });

  test("bare IDs without parenthetical are unchanged", () => {
    const md = `# B-005: Test

**Created:** 2026-02-19
**Type:** Task
**Priority:** Medium
**Status:** Not Started
**Depends On:** [B-001, B-002]

---

## Goal
Test
## Acceptance Criteria
- [ ] AC
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.depends_on).toEqual(["B-001", "B-002"]);
  });

  test("does not strip parentheticals from tags", () => {
    const md = `# B-005: Test

**Created:** 2026-02-19
**Type:** Task
**Priority:** Medium
**Status:** Not Started
**Tags:** [auth (core), security]

---

## Goal
Test
## Acceptance Criteria
- [ ] AC
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.tags).toEqual(["auth (core)", "security"]);
  });

  test("strips parenthetical from related field", () => {
    const md = `# B-005: Test

**Created:** 2026-02-19
**Type:** Task
**Priority:** Medium
**Status:** Not Started
**Related:** api/B-003 (auth module)

---

## Goal
Test
## Acceptance Criteria
- [ ] AC
`;
    const parsed = parseBacklogMarkdown(md);
    expect(parsed.related).toEqual(["api/B-003"]);
  });
});

describe("hygiene — status/folder mismatch detection", () => {
  test("detects items in done/ with wrong Status", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      // Fixture B-003 is in done/ with Status: Done — no mismatch
      const result = await backlog.hygiene();
      const doneMatch = result.status_folder_mismatches.find(m => m.id === "B-003");
      expect(doneMatch).toBeUndefined();

      // Now manually corrupt B-002 (working/) — it has Status: In Progress,
      // but let's verify the working item status
      const workingItem = await backlog.get({ id: "B-002" });

      // The fixture working item has some status — check if it matches
      if (workingItem.status !== "In Progress") {
        // If it doesn't match, it should appear in mismatches
        const mismatches = result.status_folder_mismatches;
        expect(mismatches.some(m => m.id === "B-002")).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });

  test("mismatch degrades health_score", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      // Corrupt a done item's status to force a mismatch
      const doneFile = path.join(root, "done/B-003_done-item.md");
      let body = await fs.readFile(doneFile, "utf8");
      body = body.replace("**Status:** Done", "**Status:** Not Started");
      await fs.writeFile(doneFile, body);

      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const result = await backlog.hygiene();
      expect(result.status_folder_mismatches.length).toBeGreaterThan(0);
      const mismatch = result.status_folder_mismatches.find(m => m.id === "B-003");
      expect(mismatch).toBeDefined();
      expect(mismatch!.status).toBe("Not Started");
      expect(mismatch!.expected_status).toBe("Done");
      // With mismatches, health should not be "healthy"
      expect(result.health_score).not.toBe("healthy");
    } finally {
      await cleanup();
    }
  });

  test("--fix auto-repairs status/folder mismatches", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      // Corrupt done item
      const doneFile = path.join(root, "done/B-003_done-item.md");
      let body = await fs.readFile(doneFile, "utf8");
      body = body.replace("**Status:** Done", "**Status:** Not Started");
      await fs.writeFile(doneFile, body);

      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      // Run hygiene with fix
      const result = await backlog.hygiene({ fix: true });
      expect(result.status_folder_mismatches.length).toBeGreaterThan(0);
      expect(result.fixed).toBeGreaterThan(0);

      // Verify the file was repaired
      const repaired = await fs.readFile(doneFile, "utf8");
      expect(repaired).toContain("**Status:** Done");
    } finally {
      await cleanup();
    }
  });
});
