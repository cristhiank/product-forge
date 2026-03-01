#!/usr/bin/env node

// CLI entry point for product-hub
// Provides both CLI commands and an `exec` mode for programmatic SDK usage.

import * as fs from "node:fs";
import * as nodePath from "node:path";
import { ProductRepository } from "./repository.js";
import {
  transitionFeature,
  linkEpic,
  getLifecycleOverview,
} from "./lifecycle.js";
import type { ProductMeta } from "./schema.js";

const args = process.argv.slice(2);
const command = args[0];

function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== "/") {
    if (
      fs.existsSync(nodePath.join(dir, ".product")) ||
      fs.existsSync(nodePath.join(dir, ".git"))
    ) {
      return dir;
    }
    dir = nodePath.dirname(dir);
  }
  return process.cwd();
}

function json(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function usage(): void {
  console.log(`product-hub — Product repository management

Commands:
  init <name> <stage> <description> <north_star>  Initialize .product/
  meta                                             Show product metadata
  read <path>                                      Read a document
  list [--type <type>]                             List documents
  search <query>                                   Search documents
  validate                                         Validate all documents
  health                                           Health report
  feature create <id> <title> [description]        Create feature
  feature list [--status <status>]                 List features
  feature transition <id> <status>                 Transition feature status
  feature link <id> <epic_id>                      Link feature to backlog epic
  feature bridge <id>                              Generate backlog epic template
  feature overview                                 Lifecycle overview
  experiment create <id> <hypothesis> [feature_id] Create experiment
  bump <path> <major|minor|patch>                  Version bump
  exec "<code>"                                    Execute JS with sdk object

Exec mode provides: sdk.repo, sdk.transition, sdk.linkEpic, sdk.overview
`);
}

async function main(): Promise<void> {
  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(0);
  }

  const projectRoot = findProjectRoot();
  const repo = new ProductRepository(projectRoot);

  switch (command) {
    case "init": {
      const [, name, stage, description, northStar] = args;
      if (!name || !stage || !description || !northStar) {
        console.error("Usage: init <name> <stage> <description> <north_star>");
        process.exit(1);
      }
      const meta: ProductMeta = {
        name,
        stage: stage as ProductMeta["stage"],
        version: "0.1.0",
        description,
        north_star: northStar,
        created: new Date().toISOString().split("T")[0],
      };
      repo.init(meta);
      json({ status: "initialized", root: repo.productDir, meta });
      break;
    }

    case "meta": {
      if (!repo.exists()) {
        json({ error: "No .product/ found. Run init first." });
        process.exit(1);
      }
      json(repo.readMeta());
      break;
    }

    case "read": {
      const docPath = args[1];
      if (!docPath) {
        console.error("Usage: read <path>");
        process.exit(1);
      }
      json(repo.read(docPath));
      break;
    }

    case "list": {
      const typeIdx = args.indexOf("--type");
      const type = typeIdx >= 0 ? args[typeIdx + 1] : undefined;
      json(repo.list(type as any));
      break;
    }

    case "search": {
      const query = args[1];
      if (!query) {
        console.error("Usage: search <query>");
        process.exit(1);
      }
      json(repo.search(query));
      break;
    }

    case "validate": {
      json(repo.validate());
      break;
    }

    case "health": {
      json(repo.health());
      break;
    }

    case "feature": {
      const subCmd = args[1];
      switch (subCmd) {
        case "create": {
          const [, , id, title, ...descParts] = args;
          const desc = descParts.join(" ") || "";
          if (!id || !title) {
            console.error("Usage: feature create <id> <title> [description]");
            process.exit(1);
          }
          json(repo.featureCreate(id, title, desc));
          break;
        }
        case "list": {
          const statusIdx = args.indexOf("--status");
          const status = statusIdx >= 0 ? args[statusIdx + 1] : undefined;
          json(repo.featureList(status));
          break;
        }
        case "transition": {
          const [, , id, status] = args;
          if (!id || !status) {
            console.error("Usage: feature transition <id> <status>");
            process.exit(1);
          }
          json(transitionFeature(repo, id, status as any));
          break;
        }
        case "link": {
          const [, , id, epicId] = args;
          if (!id || !epicId) {
            console.error("Usage: feature link <id> <epic_id>");
            process.exit(1);
          }
          linkEpic(repo, id, epicId);
          json({ status: "linked", feature: id, epic: epicId });
          break;
        }
        case "bridge": {
          const [, , id] = args;
          if (!id) {
            console.error("Usage: feature bridge <id>");
            process.exit(1);
          }
          console.log(repo.featureBridgeTemplate(id));
          break;
        }
        case "overview": {
          json(getLifecycleOverview(repo));
          break;
        }
        default:
          console.error(`Unknown feature subcommand: ${subCmd}`);
          process.exit(1);
      }
      break;
    }

    case "experiment": {
      const subCmd = args[1];
      if (subCmd === "create") {
        const [, , id, hypothesis, featureId] = args;
        if (!id || !hypothesis) {
          console.error(
            "Usage: experiment create <id> <hypothesis> [feature_id]"
          );
          process.exit(1);
        }
        json(repo.experimentCreate(id, hypothesis, featureId));
      } else {
        console.error(`Unknown experiment subcommand: ${subCmd}`);
        process.exit(1);
      }
      break;
    }

    case "bump": {
      const [, docPath, change] = args;
      if (!docPath || !change) {
        console.error("Usage: bump <path> <major|minor|patch>");
        process.exit(1);
      }
      json(repo.bump(docPath, change as "major" | "minor" | "patch"));
      break;
    }

    case "exec": {
      const code = args[1];
      if (!code) {
        console.error("Usage: exec '<code>'");
        process.exit(1);
      }
      // SDK object for exec mode
      const sdk = {
        repo,
        transition: (id: string, to: string) =>
          transitionFeature(repo, id, to as any),
        linkEpic: (featureId: string, epicId: string) =>
          linkEpic(repo, featureId, epicId),
        overview: () => getLifecycleOverview(repo),
      };
      const fn = new Function("sdk", "json", code);
      const result = fn(sdk, json);
      if (result instanceof Promise) await result;
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
