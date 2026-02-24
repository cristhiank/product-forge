#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultTarget = join(homedir(), '.copilot', 'skills', 'agents-hub');
const target = resolveTarget(defaultTarget, process.argv.slice(2));

console.log('📦 Publishing agents-hub skill...');
console.log(`   Source: ${scriptDir}`);
console.log(`   Target: ${target}`);

runBuild(scriptDir);

rmSync(target, { recursive: true, force: true });
mkdirSync(join(target, 'references'), { recursive: true });

cpSync(join(scriptDir, 'SKILL.md'), join(target, 'SKILL.md'));
cpSync(join(scriptDir, '.worker-context.json'), join(target, '.worker-context.json'));
cpSync(join(scriptDir, 'scripts'), join(target, 'scripts'), { recursive: true });
cpSync(join(scriptDir, 'references'), join(target, 'references'), { recursive: true });

console.log('✅ Published to ' + target);
console.log('');
console.log('Skill layout:');
for (const file of listFiles(target).slice(0, 20)) {
  console.log(`   ${file}`);
}

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

function listFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else files.push(relative(root, fullPath));
    }
  };
  if (existsSync(root)) walk(root);
  return files.sort();
}
