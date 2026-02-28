/**
 * Agent Collaboration Board - Board Manager
 *
 * Manages multiple concurrent task boards. No global "active" task -
 * each operation explicitly specifies its target task.
 */

import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Board } from "../board.js";
import type { TaskId, TaskPhase } from "../types/core.js";
import { generateTaskId } from "../types/core.js";

// ============================================================
// TYPES
// ============================================================

export interface TaskSummary {
  task_id: TaskId;
  goal: string;
  phase: TaskPhase;
  created_at: string;
  updated_at: string;
  current_step: number;
  total_steps: number;
}

export interface TaskCreateOptions {
  goal: string;
  context?: string;
  constraints?: string[];
}

// ============================================================
// BOARD MANAGER
// ============================================================

const DEFAULT_BASE_PATH = ".dev_partner";

export class BoardManager {
  private basePath: string;
  private tasksPath: string;
  private boards: Map<TaskId, Board> = new Map();

  constructor(projectPath: string = process.cwd()) {
    this.basePath = join(projectPath, DEFAULT_BASE_PATH);
    this.tasksPath = join(this.basePath, "tasks");

    // Ensure directories exist
    mkdirSync(this.tasksPath, { recursive: true });
  }

  // ============================================================
  // TASK LIFECYCLE
  // ============================================================

  /**
   * Create a new task
   */
  createTask(options: TaskCreateOptions): { task_id: TaskId; summary: TaskSummary } {
    const taskId = generateTaskId();
    const taskPath = join(this.tasksPath, taskId);

    // Create a new board for this task
    const board = new Board(taskPath);
    board.create({ ...options, taskId });

    // Cache the board
    this.boards.set(taskId, board);

    return {
      task_id: taskId,
      summary: this.getTaskSummary(taskId),
    };
  }

  /**
   * List all tasks
   */
  listTasks(): TaskSummary[] {
    if (!existsSync(this.tasksPath)) {
      return [];
    }

    const taskDirs = readdirSync(this.tasksPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const summaries: TaskSummary[] = [];
    for (const taskId of taskDirs) {
      try {
        summaries.push(this.getTaskSummary(taskId as TaskId));
      } catch {
        // Skip invalid task directories
      }
    }

    // Sort by created_at descending (newest first)
    summaries.sort((a, b) => b.created_at.localeCompare(a.created_at));

    return summaries;
  }

  /**
   * Get summary for a specific task
   */
  getTaskSummary(taskId: TaskId): TaskSummary {
    const board = this.getBoard(taskId);
    const boardState = board.getBoard();
    const meta = boardState.meta;
    const mission = boardState.mission;
    const status = boardState.status;

    return {
      task_id: taskId,
      goal: mission.goal,
      phase: meta.phase,
      created_at: meta.created_at,
      updated_at: meta.updated_at,
      current_step: status.current_step,
      total_steps: status.total_steps,
    };
  }

  /**
   * Archive a completed task
   */
  archiveTask(taskId: TaskId): void {
    const board = this.getBoard(taskId);
    const status = board.getStatus();

    if (status.phase !== "complete" && status.phase !== "cancelled") {
      throw new Error(`Cannot archive task in phase "${status.phase}". Must be complete or cancelled.`);
    }

    // Move task to archive directory
    const archivePath = join(this.basePath, "archive");
    mkdirSync(archivePath, { recursive: true });

    const oldPath = join(this.tasksPath, taskId);
    const newPath = join(archivePath, taskId);

    // Use rename for atomic move (same filesystem)
    renameSync(oldPath, newPath);

    // Remove from cache
    this.boards.delete(taskId);
  }

  // ============================================================
  // BOARD ACCESS
  // ============================================================

  /**
   * Get board for a specific task
   */
  getBoard(taskId: TaskId): Board {
    if (!taskId) {
      throw new Error("task_id is required. Use task_list to see available tasks.");
    }

    // Check cache first
    if (this.boards.has(taskId)) {
      return this.boards.get(taskId)!;
    }

    // Load board from disk
    const taskPath = join(this.tasksPath, taskId);
    if (!existsSync(taskPath)) {
      throw new Error(`Task ${taskId} does not exist. Use task_list to see available tasks.`);
    }

    const board = new Board(taskPath);
    this.boards.set(taskId, board);

    return board;
  }

  /**
   * Check if a specific task exists
   */
  taskExists(taskId: TaskId): boolean {
    const taskPath = join(this.tasksPath, taskId);
    return existsSync(join(taskPath, "meta.json"));
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  /**
   * Close all board connections
   */
  close(): void {
    for (const board of this.boards.values()) {
      board.close();
    }
    this.boards.clear();
  }

  /**
   * Get base paths for external use
   */
  getBasePath(): string {
    return this.basePath;
  }

  getTasksPath(): string {
    return this.tasksPath;
  }
}

// ============================================================
// SINGLETON
// ============================================================

let _manager: BoardManager | null = null;

export function getBoardManager(projectPath?: string): BoardManager {
  if (!_manager || projectPath) {
    if (_manager) {
      _manager.close();
    }
    _manager = new BoardManager(projectPath);
  }
  return _manager;
}

export function resetBoardManager(): void {
  if (_manager) {
    _manager.close();
    _manager = null;
  }
}
