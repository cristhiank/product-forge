#!/usr/bin/env node
/**
 * Backlog MCP Server - CLI Entry Point
 */

import { main } from "./mcp/server.js";

main().catch((err) => {
  console.error("Failed to start backlog MCP server:", err);
  process.exit(1);
});
