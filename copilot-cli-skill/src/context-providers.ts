/**
 * Worker context provider system
 * Applies caller-supplied context (symlinks, env vars, files, prompt sections) to worker worktrees.
 * The caller is responsible for assembling providers — this module only applies them.
 */

import { existsSync, symlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import type { WorkerContextProvider, ContextProviderResult } from './types.js';

/**
 * Replace template variables in a string
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

/**
 * Apply context providers to a worker worktree.
 * Providers are passed by the caller — no auto-discovery.
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
        const target = join(worktreePath, symlink.target);
        
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
          
          symlinkSync(source, target);
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
        const filePath = join(worktreePath, relativePath);
        
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
