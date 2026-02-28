/**
 * Agent Collaboration Board - BoardManager Tests
 *
 * Tests for multi-task management without global active task state.
 * All operations require explicit task_id.
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BoardManager } from "../src/manager/board-manager.js";
import type { TaskId } from "../src/types/core.js";

describe("BoardManager", () => {
  let tempDir: string;
  let manager: BoardManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "manager-test-"));
    manager = new BoardManager(tempDir);
  });

  afterEach(() => {
    manager.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Task Creation", () => {
    it("should create a new task", () => {
      const { task_id, summary } = manager.createTask({
        goal: "Implement feature X",
      });

      expect(task_id).toMatch(/^\d{8}-\d{6}-\d{3}$/);
      expect(summary.goal).toBe("Implement feature X");
      expect(summary.phase).toBe("setup");
    });

    it("should create multiple tasks with unique IDs", () => {
      const task1 = manager.createTask({ goal: "Task 1" });
      const task2 = manager.createTask({ goal: "Task 2" });

      expect(task1.task_id).not.toBe(task2.task_id);
    });

    it("should create task with constraints", () => {
      const { task_id } = manager.createTask({
        goal: "Task with constraints",
        constraints: ["No breaking changes", "Must be fast"],
      });

      const board = manager.getBoard(task_id);
      const mission = board.getMission();
      expect(mission.constraints).toHaveLength(2);
      expect(mission.constraints[0].description).toBe("No breaking changes");
    });

    it("should create task with context", () => {
      const { task_id } = manager.createTask({
        goal: "Task with context",
        context: "This is additional context for the task",
      });

      const board = manager.getBoard(task_id);
      const mission = board.getMission();
      expect(mission.context).toBe("This is additional context for the task");
    });
  });

  describe("Task Listing", () => {
    it("should list all tasks", () => {
      manager.createTask({ goal: "Task 1" });
      manager.createTask({ goal: "Task 2" });
      manager.createTask({ goal: "Task 3" });

      const tasks = manager.listTasks();
      expect(tasks).toHaveLength(3);
    });

    it("should return empty list when no tasks exist", () => {
      const tasks = manager.listTasks();
      expect(tasks).toHaveLength(0);
    });

    it("should sort tasks by created_at descending", () => {
      manager.createTask({ goal: "Task 1" });
      manager.createTask({ goal: "Task 2" });
      manager.createTask({ goal: "Task 3" });

      const tasks = manager.listTasks();
      // Most recent first
      expect(tasks[0].goal).toBe("Task 3");
      expect(tasks[2].goal).toBe("Task 1");
    });
  });

  describe("Board Access", () => {
    it("should get board for specific task", () => {
      const task1 = manager.createTask({ goal: "Task 1" });
      manager.createTask({ goal: "Task 2" });

      const board = manager.getBoard(task1.task_id);
      expect(board.getMission().goal).toBe("Task 1");
    });

    it("should throw when task_id is not provided", () => {
      expect(() => manager.getBoard(undefined as unknown as TaskId)).toThrow(
        "task_id is required. Use task_list to see available tasks."
      );
    });

    it("should throw when task_id is empty string", () => {
      expect(() => manager.getBoard("" as TaskId)).toThrow(
        "task_id is required. Use task_list to see available tasks."
      );
    });

    it("should throw when task does not exist", () => {
      expect(() => manager.getBoard("T-nonexistent" as TaskId)).toThrow(
        "Task T-nonexistent does not exist. Use task_list to see available tasks."
      );
    });

    it("should cache board instances", () => {
      const { task_id } = manager.createTask({ goal: "Test" });

      const board1 = manager.getBoard(task_id);
      const board2 = manager.getBoard(task_id);

      expect(board1).toBe(board2); // Same instance
    });
  });

  describe("Task Summary", () => {
    it("should get task summary with correct fields", () => {
      const { task_id } = manager.createTask({ goal: "Test goal" });

      const summary = manager.getTaskSummary(task_id);

      expect(summary.task_id).toBe(task_id);
      expect(summary.goal).toBe("Test goal");
      expect(summary.phase).toBe("setup");
      expect(summary.current_step).toBe(0);
      expect(summary.total_steps).toBe(0);
      expect(summary.created_at).toBeDefined();
      expect(summary.updated_at).toBeDefined();
    });

    it("should reflect phase changes in summary", () => {
      const { task_id } = manager.createTask({ goal: "Test" });
      const board = manager.getBoard(task_id);

      board.updateStatus("orchestrator", { phase: "exploration" });

      const summary = manager.getTaskSummary(task_id);
      expect(summary.phase).toBe("exploration");
    });
  });

  describe("Task Archival", () => {
    it("should archive completed task", () => {
      const { task_id } = manager.createTask({ goal: "Task to archive" });
      const board = manager.getBoard(task_id);

      // Complete the task via updateStatus
      board.updateStatus("orchestrator", { phase: "complete" });

      manager.archiveTask(task_id);

      // Task should be moved to archive
      const archivePath = join(tempDir, ".dev_partner", "archive", task_id);
      expect(existsSync(archivePath)).toBe(true);

      // Task should no longer be in tasks list
      const tasks = manager.listTasks();
      expect(tasks.find((t) => t.task_id === task_id)).toBeUndefined();
    });

    it("should archive cancelled task", () => {
      const { task_id } = manager.createTask({ goal: "Cancelled task" });
      const board = manager.getBoard(task_id);

      board.updateStatus("orchestrator", { phase: "cancelled" });
      manager.archiveTask(task_id);

      const archivePath = join(tempDir, ".dev_partner", "archive", task_id);
      expect(existsSync(archivePath)).toBe(true);
    });

    it("should not archive in-progress task", () => {
      const { task_id } = manager.createTask({ goal: "In-progress task" });
      const board = manager.getBoard(task_id);

      board.updateStatus("orchestrator", { phase: "execution" });

      expect(() => manager.archiveTask(task_id)).toThrow(
        'Cannot archive task in phase "execution"'
      );
    });

    it("should remove board from cache after archival", () => {
      const { task_id } = manager.createTask({ goal: "Task to archive" });
      const board = manager.getBoard(task_id);
      board.updateStatus("orchestrator", { phase: "complete" });

      manager.archiveTask(task_id);

      // Attempting to get the archived board should throw
      expect(() => manager.getBoard(task_id)).toThrow(
        `Task ${task_id} does not exist`
      );
    });
  });

  describe("Path Access", () => {
    it("should return base path", () => {
      const basePath = manager.getBasePath();
      expect(basePath).toBe(join(tempDir, ".dev_partner"));
    });

    it("should return tasks path", () => {
      const tasksPath = manager.getTasksPath();
      expect(tasksPath).toBe(join(tempDir, ".dev_partner", "tasks"));
    });
  });

  describe("Task Existence", () => {
    it("should check if task exists", () => {
      const { task_id } = manager.createTask({ goal: "Test" });

      expect(manager.taskExists(task_id)).toBe(true);
      expect(manager.taskExists("T-nonexistent" as TaskId)).toBe(false);
    });
  });

  describe("Concurrent Tasks", () => {
    it("should support multiple tasks simultaneously", () => {
      const task1 = manager.createTask({ goal: "Task 1" });
      const task2 = manager.createTask({ goal: "Task 2" });
      const task3 = manager.createTask({ goal: "Task 3" });

      // Access all boards independently
      const board1 = manager.getBoard(task1.task_id);
      const board2 = manager.getBoard(task2.task_id);
      const board3 = manager.getBoard(task3.task_id);

      // Modify each board
      board1.addFact("scout", {
        content: "Fact for task 1",
        confidence: "high",
        evidence: [{ type: "file", reference: "test.ts" }],
      });

      board2.addFact("scout", {
        content: "Fact for task 2",
        confidence: "medium",
        evidence: [{ type: "file", reference: "test2.ts" }],
      });

      board3.addFact("scout", {
        content: "Fact for task 3",
        confidence: "low",
        evidence: [{ type: "file", reference: "test3.ts" }],
      });

      // Verify isolation
      expect(board1.getFacts()[0].content).toBe("Fact for task 1");
      expect(board2.getFacts()[0].content).toBe("Fact for task 2");
      expect(board3.getFacts()[0].content).toBe("Fact for task 3");
    });

    it("should maintain task independence", () => {
      const task1 = manager.createTask({ goal: "Task A" });
      const task2 = manager.createTask({ goal: "Task B" });

      // Progress task1 to execution
      const board1 = manager.getBoard(task1.task_id);
      board1.updateStatus("orchestrator", { phase: "execution" });

      // Complete task2
      const board2 = manager.getBoard(task2.task_id);
      board2.updateStatus("orchestrator", { phase: "complete" });

      // Verify phases are independent
      expect(manager.getTaskSummary(task1.task_id).phase).toBe("execution");
      expect(manager.getTaskSummary(task2.task_id).phase).toBe("complete");

      // Archive task2 should not affect task1
      manager.archiveTask(task2.task_id);
      expect(manager.taskExists(task1.task_id)).toBe(true);
      expect(manager.taskExists(task2.task_id)).toBe(false);
    });
  });

  describe("Manager Cleanup", () => {
    it("should close all boards on manager close", () => {
      manager.createTask({ goal: "Task 1" });
      manager.createTask({ goal: "Task 2" });

      // Access boards to ensure they're cached
      manager.getBoard(manager.listTasks()[0].task_id);
      manager.getBoard(manager.listTasks()[1].task_id);

      // Close manager - should not throw
      expect(() => manager.close()).not.toThrow();
    });
  });
});
