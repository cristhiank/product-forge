#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillName = 'copilot-cli-skill';
const defaultTarget = join(homedir(), '.copilot', 'skills', skillName);
const target = resolveTarget(defaultTarget, process.argv.slice(2));

console.log(`📦 Publishing ${skillName} skill...`);
console.log(`   Source: ${scriptDir}`);
console.log(`   Target: ${target}`);

runBuild(scriptDir);

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

cpSync(join(scriptDir, 'SKILL.md'), join(target, 'SKILL.md'));
cpSync(join(scriptDir, 'references'), join(target, 'references'), { recursive: true });
cpSync(join(scriptDir, 'scripts'), join(target, 'scripts'), { recursive: true });

console.log(`✅ Published to ${target}`);

function runBuild(cwd) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', 'build', '--silent'], { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveTarget(fallback, args) {
  const targetFlag = args.indexOf('--target');
  if (targetFlag >= 0 && args[targetFlag + 1]) return args[targetFlag + 1];
  if (args[0] && !args[0].startsWith('--')) return args[0];
  return fallback;
}
