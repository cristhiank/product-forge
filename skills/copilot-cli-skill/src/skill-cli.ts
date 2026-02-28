#!/usr/bin/env node
/**
 * Entry point for the worker CLI skill
 * This is bundled by esbuild into scripts/worker.js
 */

import { runCli } from './cli.js';

runCli();
