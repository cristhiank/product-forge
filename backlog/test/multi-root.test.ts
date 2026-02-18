import { describe, expect, test } from "vitest";

import { createBacklogAPI } from "../src/backlog-api.js";
import { parseQualifiedId, toQualifiedId, isValidLocalId, isValidProjectName } from "../src/id-utils.js";
import { discoverProjects } from "../src/storage/project-discovery.js";
import { MultiRootBacklogStore } from "../src/storage/multi-root-store.js";
import { makeTempMultiProjectFixture } from "./test-helpers.js";

describe("id-utils", () => {
  test("parseQualifiedId with bare id", () => {
    const r = parseQualifiedId("B-001");
    expect(r).toEqual({ localId: "B-001" });
  });

  test("parseQualifiedId with project prefix", () => {
    const r = parseQualifiedId("frontend/B-001");
    expect(r).toEqual({ project: "frontend", localId: "B-001" });
  });

  test("toQualifiedId", () => {
    expect(toQualifiedId("api", "B-003")).toBe("api/B-003");
    expect(toQualifiedId(undefined, "B-003")).toBe("B-003");
  });

  test("isValidLocalId", () => {
    expect(isValidLocalId("B-001")).toBe(true);
    expect(isValidLocalId("B-001.1")).toBe(true);
    expect(isValidLocalId("bad")).toBe(false);
  });

  test("isValidProjectName", () => {
    expect(isValidProjectName("frontend")).toBe(true);
    expect(isValidProjectName("my-api")).toBe(true);
    expect(isValidProjectName("")).toBe(false);
    expect(isValidProjectName("-bad")).toBe(false);
  });
});

describe("project discovery", () => {
  test("discovers projects with .backlog directories", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      expect(projects.map((p) => p.name)).toEqual(["api", "frontend"]);
      expect(projects[0].root).toContain("api/.backlog");
      expect(projects[1].root).toContain("frontend/.backlog");
    } finally {
      await cleanup();
    }
  });
});

describe("multi-root backlog API", () => {
  test("list across all projects", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      const all = await backlog.list();
      expect(all.length).toBe(4);
      // Items should have project-qualified IDs
      const ids = all.map((i) => i.id);
      expect(ids).toContain("api/B-001");
      expect(ids).toContain("api/B-002");
      expect(ids).toContain("frontend/B-001");
      expect(ids).toContain("frontend/B-002");
    } finally {
      await cleanup();
    }
  });

  test("list scoped to a project", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      const apiItems = await backlog.list({ project: "api" });
      expect(apiItems.every((i) => i.project === "api")).toBe(true);
      expect(apiItems.length).toBe(2);
    } finally {
      await cleanup();
    }
  });

  test("list scoped to folder", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      const working = await backlog.list({ folder: "working" });
      expect(working.length).toBe(1);
      expect(working[0].id).toBe("frontend/B-002");
    } finally {
      await cleanup();
    }
  });

  test("get by qualified id", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      const item = await backlog.get({ id: "frontend/B-001" });
      expect(item.title).toContain("Homepage Layout");
      expect(item.project).toBe("frontend");
      expect(item.depends_on).toEqual(["api/B-001"]);
    } finally {
      await cleanup();
    }
  });

  test("get rejects bare id in multi-project mode", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      await expect(backlog.get({ id: "B-001" })).rejects.toThrow(/Ambiguous/);
    } finally {
      await cleanup();
    }
  });

  test("search across all projects", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      const results = await backlog.search({ text: "auth" });
      expect(results.length).toBe(2); // frontend/B-002 and api/B-002
      expect(results.map((r) => r.project).sort()).toEqual(["api", "frontend"]);
    } finally {
      await cleanup();
    }
  });

  test("globalStats returns all projects", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      const stats = await backlog.globalStats();
      expect(stats.api).toEqual({ next: 2, working: 0, done: 0, archive: 0 });
      expect(stats.frontend).toEqual({ next: 1, working: 1, done: 0, archive: 0 });
    } finally {
      await cleanup();
    }
  });

  test("create in specific project", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      const created = await backlog.create({
        kind: "task",
        title: "New API Task",
        project: "api",
        description: "A new task",
        depends_on: ["frontend/B-001"],
      });

      expect(created.id).toBe("api/B-003");
      expect(created.project).toBe("api");

      const item = await backlog.get({ id: "api/B-003" });
      expect(item.body).toContain("Depends-On");
      expect(item.depends_on).toContain("frontend/B-001");
    } finally {
      await cleanup();
    }
  });

  test("create requires project in multi-project mode", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      await expect(
        backlog.create({ kind: "task", title: "No project" })
      ).rejects.toThrow(/Project is required/);
    } finally {
      await cleanup();
    }
  });

  test("xref finds cross-project references", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      // frontend/B-001 depends on api/B-001, so searching for api/B-001 should find it
      const refs = await backlog.xref({ id: "api/B-001" });
      expect(refs.length).toBeGreaterThanOrEqual(1);
      const refIds = refs.map((r) => r.id);
      expect(refIds).toContain("frontend/B-001");
    } finally {
      await cleanup();
    }
  });

  test("projects() lists available projects", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      expect(backlog.projects()).toEqual(["api", "frontend"]);
    } finally {
      await cleanup();
    }
  });

  test("move with qualified id", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      const moved = await backlog.move({ id: "api/B-001", to: "working" });
      expect(moved.from).toBe("next");
      expect(moved.to).toBe("working");

      const item = await backlog.get({ id: "api/B-001" });
      expect(item.folder).toBe("working");
    } finally {
      await cleanup();
    }
  });

  test("cross-project refs parsed in metadata", async () => {
    const { scanDir, cleanup } = await makeTempMultiProjectFixture();
    try {
      const projects = await discoverProjects(scanDir);
      const store = new MultiRootBacklogStore(projects);
      const backlog = createBacklogAPI(store);

      const item = await backlog.get({ id: "api/B-002" });
      expect(item.depends_on).toEqual(["api/B-001"]);
      expect(item.related).toEqual(["frontend/B-002"]);
    } finally {
      await cleanup();
    }
  });
});
