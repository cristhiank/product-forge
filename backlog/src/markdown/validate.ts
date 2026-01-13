import type { BacklogItem } from "../types.js";

export function validateBacklogItem(item: BacklogItem): { ok: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!/^B-\d+(?:\.\d+)*$/i.test(item.id)) {
    issues.push("id must match B-NNN(.N)* format");
  }

  if (!item.body.includes(`# ${item.id}`) && !item.body.toLowerCase().includes(`# ${item.id.toLowerCase()}`)) {
    issues.push("body should start with an H1 containing the item id");
  }

  const required = ["Created", "Type", "Priority", "Status"];
  for (const k of required) {
    if (!item.metadata[k]) issues.push(`missing metadata field: ${k}`);
  }

  if (item.metadata.Type && !/(Epic|Story|Task)/i.test(item.metadata.Type)) {
    issues.push("Type should be Epic, Story, or Task");
  }

  if (!/##\s+Acceptance Criteria/i.test(item.body)) {
    issues.push("missing '## Acceptance Criteria' section");
  }

  return { ok: issues.length === 0, issues };
}
