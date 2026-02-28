#!/usr/bin/env node
/**
 * Entry point for the hub CLI skill
 * This is bundled by esbuild into scripts/hub.js
 */

import { runCli } from './cli.js';

runCli();
