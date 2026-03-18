#!/usr/bin/env node
/**
 * Forge Playwright Skill CLI
 *
 * Dual-mode CLI:
 * 1. Command mode: project, profile, init-page, config operations
 * 2. Exec mode: JavaScript composition via sandbox
 *
 * Auto-discovers .playwright-mcp/ directories from current working directory.
 */

import { discoverProject } from "./discovery.js";
import {
  listProfiles,
  loadProfile,
  renderProfileToolCalls,
} from "./profiles.js";
import {
  recommendConfig,
  validateConfig,
  formatConfigJSON,
} from "./config.js";
import { scaffoldProject } from "./project-scaffold.js";
import {
  listInitPages,
  loadInitPage,
  generateInitPageFromProfile,
} from "./init-pages.js";
import { executeCode, type PlaywrightAPI } from "./sandbox.js";

interface CLIOptions {
  command: string;
  subcommand: string;
  args: Record<string, string | boolean | undefined>;
  positional: string[];
}

function parseArgs(argv: string[]): CLIOptions {
  const raw = argv.slice(2);

  // Handle exec mode
  if (raw[0] === "exec") {
    const codeIdx = raw.indexOf("--code");
    const code = codeIdx >= 0 ? raw.slice(codeIdx + 1).join(" ") : "";
    return { command: "exec", subcommand: "", args: { code }, positional: [] };
  }

  const command = raw[0] ?? "help";
  const subcommand = raw[1] ?? "";
  const positional = raw.slice(2).filter((a) => !a.startsWith("--"));

  // Parse flags
  const flagArgs: Record<string, string | boolean | undefined> = {};
  for (let i = 2; i < raw.length; i++) {
    if (raw[i].startsWith("--")) {
      const key = raw[i].replace(/^--/, "");
      const next = raw[i + 1];
      if (next && !next.startsWith("--")) {
        flagArgs[key] = next;
        i++;
      } else {
        flagArgs[key] = true;
      }
    }
  }

  return { command, subcommand, args: flagArgs, positional };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  switch (opts.command) {
    case "project":
      await handleProject(opts);
      break;
    case "profile":
      await handleProfile(opts);
      break;
    case "init-page":
      await handleInitPage(opts);
      break;
    case "config":
      await handleConfig(opts);
      break;
    case "exec":
      await handleExec(opts);
      break;
    default:
      printHelp();
  }
}

// ─── Project Commands ───

async function handleProject(opts: CLIOptions): Promise<void> {
  switch (opts.subcommand) {
    case "init": {
      const targetDir = (opts.args["target"] as string) ?? process.cwd();
      const force = opts.args["force"] === true;
      const result = scaffoldProject(targetDir, { force });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case "show": {
      const explicitDir = opts.args["project-dir"] as string | undefined;
      const result = discoverProject(process.cwd(), explicitDir);
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    default:
      console.log("Usage: forge-playwright project <init|show>");
      console.log("  init [--target <dir>] [--force]  Scaffold .playwright-mcp/ directory");
      console.log("  show [--project-dir <dir>]       Show current project config");
  }
}

// ─── Profile Commands ───

async function handleProfile(opts: CLIOptions): Promise<void> {
  const discovery = discoverProject(
    process.cwd(),
    opts.args["project-dir"] as string | undefined,
  );

  if (!discovery.found || !discovery.projectDir) {
    console.error(
      "No .playwright-mcp/ directory found. Run: forge-playwright project init",
    );
    process.exitCode = 1;
    return;
  }

  switch (opts.subcommand) {
    case "list": {
      const profiles = listProfiles(discovery.projectDir);
      console.log(JSON.stringify({ profiles, projectDir: discovery.projectDir }));
      break;
    }
    case "show": {
      const name = opts.positional[0] ?? discovery.config?.defaultProfile ?? "admin";
      const result = loadProfile(discovery.projectDir, name);
      if (result.error) {
        console.error(result.error);
        process.exitCode = 1;
      } else {
        console.log(JSON.stringify(result.profile, null, 2));
      }
      break;
    }
    case "apply": {
      const name = opts.positional[0] ?? discovery.config?.defaultProfile ?? "admin";
      const result = loadProfile(discovery.projectDir, name);
      if (result.error || !result.profile) {
        console.error(result.error ?? `Profile "${name}" not found`);
        process.exitCode = 1;
        return;
      }
      const baseUrl = discovery.config?.baseUrl ??
        `http://localhost:${discovery.config?.ports.frontend ?? 3000}`;
      console.log(renderProfileToolCalls(result.profile, baseUrl));
      break;
    }
    default:
      console.log("Usage: forge-playwright profile <list|show|apply> [name]");
  }
}

// ─── Init-Page Commands ───

async function handleInitPage(opts: CLIOptions): Promise<void> {
  const discovery = discoverProject(
    process.cwd(),
    opts.args["project-dir"] as string | undefined,
  );

  if (!discovery.found || !discovery.projectDir) {
    console.error(
      "No .playwright-mcp/ directory found. Run: forge-playwright project init",
    );
    process.exitCode = 1;
    return;
  }

  switch (opts.subcommand) {
    case "list": {
      const pages = listInitPages(discovery.projectDir);
      console.log(JSON.stringify({ initPages: pages, projectDir: discovery.projectDir }));
      break;
    }
    case "show": {
      const name = opts.positional[0] ?? "mocked";
      const page = loadInitPage(discovery.projectDir, name);
      if (!page) {
        console.error(`Init-page "${name}" not found`);
        process.exitCode = 1;
      } else {
        console.log(page.content);
      }
      break;
    }
    case "generate": {
      const profileName = opts.positional[0] ?? discovery.config?.defaultProfile ?? "admin";
      const result = loadProfile(discovery.projectDir, profileName);
      if (result.error || !result.profile) {
        console.error(result.error ?? `Profile "${profileName}" not found`);
        process.exitCode = 1;
        return;
      }
      console.log(generateInitPageFromProfile(result.profile));
      break;
    }
    default:
      console.log("Usage: forge-playwright init-page <list|show|generate> [name]");
  }
}

// ─── Config Commands ───

async function handleConfig(opts: CLIOptions): Promise<void> {
  const discovery = discoverProject(process.cwd());

  switch (opts.subcommand) {
    case "recommend": {
      const rec = recommendConfig(discovery.config);
      console.log("# Recommended MCP config:\n");
      console.log(formatConfigJSON(rec));
      console.log("\n# Reasons:");
      for (const r of rec.reasons) console.log(`  ${r}`);
      if (rec.warnings.length > 0) {
        console.log("\n# Warnings:");
        for (const w of rec.warnings) console.log(`  ⚠️  ${w}`);
      }
      break;
    }
    case "validate": {
      const args = opts.positional.length > 0 ? opts.positional : [];
      const result = validateConfig(args);
      for (const item of [...result.ok, ...result.missing]) {
        console.log(item);
      }
      if (result.missing.length > 0) process.exitCode = 1;
      break;
    }
    default:
      console.log("Usage: forge-playwright config <recommend|validate> [args...]");
  }
}

// ─── Exec Command ───

async function handleExec(opts: CLIOptions): Promise<void> {
  const code = opts.args["code"] as string;
  if (!code) {
    console.error("Usage: forge-playwright exec --code 'return pw.profiles.list()'");
    process.exitCode = 1;
    return;
  }

  const discovery = discoverProject(process.cwd());

  const api: PlaywrightAPI = {
    profiles: {
      list: () =>
        discovery.projectDir ? listProfiles(discovery.projectDir) : [],
      load: (name: string) =>
        discovery.projectDir
          ? loadProfile(discovery.projectDir, name).profile
          : null,
      render: (name: string) => {
        if (!discovery.projectDir) return "No project directory found";
        const result = loadProfile(discovery.projectDir, name);
        if (!result.profile) return result.error ?? "Profile not found";
        return renderProfileToolCalls(result.profile);
      },
    },
    config: {
      recommend: () => recommendConfig(discovery.config),
      validate: (args: string[]) => validateConfig(args),
    },
    project: {
      show: () => discovery,
      init: (targetDir: string) => scaffoldProject(targetDir),
    },
    initPages: {
      list: () =>
        discovery.projectDir ? listInitPages(discovery.projectDir) : [],
      load: (name: string) =>
        discovery.projectDir
          ? loadInitPage(discovery.projectDir, name)
          : null,
    },
  };

  const result = await executeCode(api, { code });
  console.log(JSON.stringify(result, null, 2));
}

// ─── Help ───

function printHelp(): void {
  console.log(`forge-playwright — Playwright MCP skill CLI

Commands:
  project init [--target <dir>] [--force]   Scaffold .playwright-mcp/ directory
  project show [--project-dir <dir>]        Show discovered project config

  profile list                              List available mock profiles
  profile show [name]                       Show profile details
  profile apply [name]                      Output MCP tool calls for a profile

  init-page list                            List available init-page scripts
  init-page show [name]                     Show init-page content
  init-page generate [profile-name]         Generate init-page from a profile

  config recommend                          Show recommended MCP config
  config validate [args...]                 Validate MCP args against recommendations

  exec --code '<code>'                      Run code in sandboxed API (pw.* namespace)

Options:
  --project-dir <dir>   Explicit .playwright-mcp/ directory (overrides auto-discovery)
  --force               Overwrite existing files in project init
`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
