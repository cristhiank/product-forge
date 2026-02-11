#!/usr/bin/env node
/**
 * Budget MCP Server - CLI Entry Point
 */

import { main } from "./mcp/server.js";

main().catch((err) => {
  console.error("Failed to start budget MCP server:", err);
  process.exit(1);
});
