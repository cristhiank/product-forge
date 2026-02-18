#!/usr/bin/env node
/**
 * Agent Collaboration Board - CLI Entry Point
 */

import { main } from "./skill-cli.js";

main().catch((err) => {
  console.error("Board CLI error:", err);
  process.exit(1);
});
