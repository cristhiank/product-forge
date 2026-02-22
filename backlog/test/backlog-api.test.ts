import * as fs from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, test } from "vitest";

import { createBacklogAPI } from "../src/backlog-api.js";
// import { executeCode } from "../src/sandbox/index.js"; // Sandbox not needed for CLI version
import { singleProjectStore } from "../src/storage/multi-root-store.js";
import { makeTempBacklogRootFromFixture } from "./test-helpers.js";

describe("backlog API", () => {
  test("list/get/search/stats", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const stats = await backlog.stats();
      expect(stats.default.next).toBe(2);
      expect(stats.default.working).toBe(1);
      expect(stats.default.done).toBe(1);
      expect(stats.default.archive).toBe(1);

      const next = await backlog.list({ folder: "next" });
      expect(next.map((x) => x.id)).toContain("B-001");

      const item = await backlog.get({ id: "B-001" });
      expect(item.title).toMatch(/First Item/);
      expect(item.folder).toBe("next");

      const search = await backlog.search({ text: "fixture", folder: "next" });
      expect(search.length).toBe(1);
      expect(search[0]?.id).toBe("B-001");
    } finally {
      await cleanup();
    }
  });

  test("create allocates next id and writes to next/", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const created = await backlog.create({
        kind: "task",
        title: "New thing",
        description: "Do the thing",
        acceptance_criteria: ["It works"],
        tags: ["new"],
        priority: "high",
      });

      expect(created.id).toBe("B-011"); // fixture contains B-010 invalid
      expect(created.path).toMatch(/^next\//);

      const abs = path.resolve(root, created.path);
      const body = await fs.readFile(abs, "utf8");
      expect(body).toContain(`# ${created.id}:`);
    } finally {
      await cleanup();
    }
  });

  test("move/complete/archive", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const moved = await backlog.move({ id: "B-001", to: "working" });
      expect(moved.from).toBe("next");
      expect(moved.to).toBe("working");

      const completed = await backlog.complete({ id: "B-001", completedDate: "2026-02-01" });
      expect(completed.path).toMatch(/^done\//);

      const doneItem = await backlog.get({ id: "B-001" });
      expect(doneItem.folder).toBe("done");
      expect(doneItem.body).toContain("**Completed:** 2026-02-01");

      const archived = await backlog.archive({ id: "B-001" });
      expect(archived.path).toMatch(/^archive\//);
      const archivedItem = await backlog.get({ id: "B-001" });
      expect(archivedItem.folder).toBe("archive");
    } finally {
      await cleanup();
    }
  });

  test("validate reports issues", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const ok = await backlog.validate({ id: "B-001" });
      expect(ok.ok).toBe(true);

      const bad = await backlog.validate({ id: "B-010" });
      expect(bad.ok).toBe(false);
      expect(bad.issues.length).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });

  test("updateBody creates history snapshots and increments version", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const first = await backlog.updateBody({
        id: "B-001",
        body: "# B-001: First Item\n\n(updated)\n",
        message: "first edit",
      });
      expect(first.version).toBe(1);

      const history1 = await backlog.getHistory({ id: "B-001" });
      expect(history1.length).toBe(1);
      expect(history1[0]?.message).toBe("first edit");
      expect(history1[0]?.path).toContain(".history/B-001/");

      const second = await backlog.updateBody({
        id: "B-001",
        body: "# B-001: First Item\n\n(updated again)\n",
        message: "second edit",
      });
      expect(second.version).toBe(2);

      const history2 = await backlog.getHistory({ id: "B-001" });
      expect(history2.length).toBe(2);
      expect(history2[0]?.version).toBe(2);
    } finally {
      await cleanup();
    }
  });

  // Sandbox test commented out - not needed for CLI version
  // test("sandbox executes code against injected backlog API", async () => {
  //   const { root, cleanup } = await makeTempBacklogRootFromFixture();
  //   try {
  //     const store = singleProjectStore(root);
  //     const backlog = createBacklogAPI(store);
  //
  //     const resp = await executeCode(backlog, {
  //       code: "const s = await backlog.stats(); return s;",
  //       timeout: 5000,
  //     });
  //
  //     expect(resp.success).toBe(true);
  //     expect((resp.result as any).default.next).toBe(2);
  //   } finally {
  //     await cleanup();
  //   }
  // });

  test("brief returns composite briefing", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const brief = await backlog.brief();
      expect(brief.health).toBeDefined();
      expect(typeof brief.issues).toBe("number");
      expect(Array.isArray(brief.wip)).toBe(true);
      expect(Array.isArray(brief.next_unblocked)).toBe(true);
      expect(Array.isArray(brief.next_blocked)).toBe(true);
      // Fixture has 1 working item
      expect(brief.wip.length).toBe(1);
      // Fixture has items in next
      expect(brief.next_unblocked.length + brief.next_blocked.length).toBeGreaterThan(0);
    } finally {
      await cleanup();
    }
  });

  test("pick moves to working and returns full item", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      const item = await backlog.pick({ id: "B-001" });
      expect(item.folder).toBe("working");
      expect(item.title).toMatch(/First Item/);
      expect(item.body).toContain("**Status:** In Progress");
    } finally {
      await cleanup();
    }
  });

  test("list --unblocked filters by resolved dependencies", async () => {
    const { root, cleanup } = await makeTempBacklogRootFromFixture();
    try {
      const store = singleProjectStore(root);
      const backlog = createBacklogAPI(store);

      // Create items with dependencies
      await backlog.create({ kind: "task", title: "Base task", priority: "high" });  // B-011
      await backlog.create({
        kind: "task", title: "Dependent task", priority: "medium",
        depends_on: ["B-011"]
      });  // B-012

      // B-012 depends on B-011 which is in next — should be blocked
      const unblocked = await backlog.list({ folder: "next", unblocked: true });
      const ids = unblocked.map(i => i.id);
      expect(ids).not.toContain("B-012");
      expect(ids).toContain("B-011");

      // Complete B-011, now B-012 should be unblocked
      await backlog.complete({ id: "B-011" });
      const unblocked2 = await backlog.list({ folder: "next", unblocked: true });
      expect(unblocked2.map(i => i.id)).toContain("B-012");
    } finally {
      await cleanup();
    }
  });
});
