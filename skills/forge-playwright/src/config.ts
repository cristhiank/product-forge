/**
 * Config — MCP config recommendation and validation.
 */

import type { ProjectConfig, MCPConfigRecommendation } from "./types.js";

const RECOMMENDED_CAPS = ["network", "storage"];

const RECOMMENDED_FLAGS: Record<string, { flag: string; reason: string }> = {
  "block-service-workers": {
    flag: "--block-service-workers",
    reason: "Prevents service workers from interfering with route mocking",
  },
  "ignore-https-errors": {
    flag: "--ignore-https-errors",
    reason: "Allows dev tunnels and self-signed certs without TLS errors",
  },
  "viewport-size": {
    flag: "--viewport-size=1280x720",
    reason: "Consistent viewport for reproducible screenshots",
  },
  "console-level": {
    flag: "--console-level=info",
    reason: "Capture console messages for debugging (use 'error' for less noise)",
  },
};

/**
 * Generate recommended MCP config based on project settings.
 */
export function recommendConfig(
  config?: ProjectConfig | null,
): MCPConfigRecommendation {
  const args: string[] = ["@playwright/mcp@latest"];
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Always recommend network + storage caps
  args.push(`--caps=${RECOMMENDED_CAPS.join(",")}`);
  reasons.push(
    "--caps=network: Enables browser_route for API mocking (no more browser_run_code hacks)",
  );
  reasons.push(
    "--caps=storage: Enables browser_cookie_set/browser_localstorage_set for direct auth injection",
  );

  // Standard flags
  for (const [, { flag, reason }] of Object.entries(RECOMMENDED_FLAGS)) {
    args.push(flag);
    reasons.push(`${flag}: ${reason}`);
  }

  // Project-specific recommendations
  if (config) {
    if (config.authPattern === "oidc") {
      warnings.push(
        "OIDC auth: Consider --cdp-endpoint or --extension mode to reuse an authenticated browser session",
      );
    }

    if (config.baseUrl) {
      reasons.push(`Base URL from project config: ${config.baseUrl}`);
    }
  }

  return { args, reasons, warnings };
}

/**
 * Validate current MCP args against recommendations.
 * Returns list of missing capabilities and flags.
 */
export function validateConfig(
  currentArgs: string[],
): { missing: string[]; ok: string[] } {
  const missing: string[] = [];
  const ok: string[] = [];
  const joined = currentArgs.join(" ");

  // Check caps
  for (const cap of RECOMMENDED_CAPS) {
    if (joined.includes(cap)) {
      ok.push(`✅ --caps includes "${cap}"`);
    } else {
      missing.push(
        `❌ Missing --caps=${cap} — add it to enable ${cap === "network" ? "browser_route" : "browser_cookie_set/browser_localstorage_set"}`,
      );
    }
  }

  // Check flags
  for (const [key, { flag }] of Object.entries(RECOMMENDED_FLAGS)) {
    const flagName = key;
    if (joined.includes(flagName)) {
      ok.push(`✅ ${flag}`);
    } else {
      missing.push(`⚠️  Missing ${flag} (recommended)`);
    }
  }

  return { missing, ok };
}

/**
 * Format the recommended config as a JSON snippet for mcp-config.json.
 */
export function formatConfigJSON(recommendation: MCPConfigRecommendation): string {
  return JSON.stringify(
    {
      mcpServers: {
        playwright: {
          command: "npx",
          args: recommendation.args,
        },
      },
    },
    null,
    2,
  );
}
