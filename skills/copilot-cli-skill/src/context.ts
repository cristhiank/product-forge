/**
 * Worker context provider system (hardened copy of context-providers.ts).
 * Applies caller-supplied context (symlinks, env vars, files, prompt sections) to worker worktrees.
 * Adds path-escape validation to block `../` traversal attacks.
 *
 * The caller is responsible for assembling providers — this module only applies them.
 * workers.ts still imports context-providers.ts; this module is the migration target.
 */

import { existsSync, symlinkSync, writeFileSync, mkdirSync, statSync, cpSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import type { WorkerContextProvider, ContextProviderResult } from './types.js';

// ─── Path Safety ─────────────────────────────────────────────────────────────

/**
 * Returns true if `target` resolves to a path inside `worktreePath`.
 * Blocks any `../` traversal that would escape the worktree boundary.
 *
 * @param worktreePath - Absolute path to the worktree root
 * @param target - Path to validate (may be relative or absolute)
 */
function isPathSafe(worktreePath: string, target: string): boolean {
  const resolved = resolve(worktreePath, target);
  return resolved.startsWith(worktreePath + sep) || resolved === worktreePath;
}

// ─── Template expansion ───────────────────────────────────────────────────────

/**
 * Replace template variables in a string.
 */
export function replaceTemplateVars(
  str: string,
  vars: { repoRoot: string; worktreePath: string; workerId: string }
): string {
  return str
    .replace(/\{\{repoRoot\}\}/g, vars.repoRoot)
    .replace(/\{\{worktreePath\}\}/g, vars.worktreePath)
    .replace(/\{\{workerId\}\}/g, vars.workerId);
}

// ─── applyContext ─────────────────────────────────────────────────────────────

/**
 * Apply context providers to a worker worktree.
 * Providers are passed by the caller — no auto-discovery.
 * Symlink targets and file paths are validated against the worktree boundary.
 */
export function applyContext(
  providers: WorkerContextProvider[],
  repoRoot: string,
  worktreePath: string,
  workerId: string,
  prompt: string
): { env: Record<string, string>; prompt: string; result: ContextProviderResult } {
  const vars = { repoRoot, worktreePath, workerId };

  const result: ContextProviderResult = {
    providers: [],
    symlinksCreated: 0,
    envVarsAdded: 0,
    filesWritten: 0,
    promptSectionsInjected: 0,
    warnings: [],
  };

  const env: Record<string, string> = {};
  let augmentedPrompt = prompt;

  for (const provider of providers) {
    result.providers.push(provider.provider);

    // Apply symlinks
    if (provider.context.symlinks) {
      for (const symlink of provider.context.symlinks) {
        const source = resolve(replaceTemplateVars(symlink.source, vars));
        const rawTarget = replaceTemplateVars(symlink.target, vars);

        // Block path traversal
        if (!isPathSafe(worktreePath, rawTarget)) {
          result.warnings.push(`Symlink target escapes worktree boundary, skipping: ${rawTarget}`);
          continue;
        }

        const target = join(worktreePath, rawTarget);

        if (!existsSync(source)) {
          result.warnings.push(`Symlink source does not exist: ${source}`);
          continue;
        }

        try {
          const targetDir = dirname(target);
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }

          if (existsSync(target)) {
            result.warnings.push(`Symlink target already exists: ${target}`);
            continue;
          }

          if (process.platform === 'win32') {
            // On Windows, junction points work for directories without elevated privileges.
            // For files, fall back to copying since file symlinks require Developer Mode.
            let isDir = false;
            try { isDir = statSync(source).isDirectory(); } catch { /* ignore */ }
            if (isDir) {
              symlinkSync(source, target, 'junction');
            } else {
              cpSync(source, target);
            }
          } else {
            symlinkSync(source, target);
          }
          result.symlinksCreated++;
        } catch (err) {
          result.warnings.push(`Failed to create symlink ${target}: ${err}`);
        }
      }
    }

    // Apply environment variables
    if (provider.context.env) {
      for (const [key, value] of Object.entries(provider.context.env)) {
        env[key] = replaceTemplateVars(value, vars);
        result.envVarsAdded++;
      }
    }

    // Apply files
    if (provider.context.files) {
      for (const [relativePath, content] of Object.entries(provider.context.files)) {
        const rawPath = replaceTemplateVars(relativePath, vars);

        // Block path traversal
        if (!isPathSafe(worktreePath, rawPath)) {
          result.warnings.push(`File path escapes worktree boundary, skipping: ${rawPath}`);
          continue;
        }

        const filePath = join(worktreePath, rawPath);

        try {
          const fileDir = dirname(filePath);
          if (!existsSync(fileDir)) {
            mkdirSync(fileDir, { recursive: true });
          }

          writeFileSync(filePath, replaceTemplateVars(content, vars), 'utf-8');
          result.filesWritten++;
        } catch (err) {
          result.warnings.push(`Failed to write file ${filePath}: ${err}`);
        }
      }
    }

    // Apply prompt sections
    if (provider.context.prompt_sections) {
      for (const section of Object.values(provider.context.prompt_sections)) {
        const sectionText = replaceTemplateVars(section, vars);
        augmentedPrompt += `\n\n${sectionText}`;
        result.promptSectionsInjected++;
      }
    }
  }

  return { env, prompt: augmentedPrompt, result };
}
