#!/usr/bin/env node
/**
 * Agent Collaboration Board - CLI Entry Point
 */

import { main } from "./mcp/server.js";

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
