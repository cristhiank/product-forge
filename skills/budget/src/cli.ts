#!/usr/bin/env node
/**
 * Budget Engine - CLI Entry Point
 */

import { main } from "./skill-cli.js";

main().catch((err) => {
  console.error("Failed to start budget CLI:", err);
  process.exit(1);
});
