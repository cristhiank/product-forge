import type { BacklogItem } from "../types.js";
import { parseQualifiedId, isValidLocalId } from "../id-utils.js";

export function validateBacklogItem(
  item: BacklogItem,
  allItems?: BacklogItem[]
): { ok: boolean; issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];

  const { localId } = parseQualifiedId(item.id);
  if (!isValidLocalId(localId)) {
    issues.push("id must match B-NNN(.N)* format (optionally prefixed with project/)");
  }

  if (!item.body.includes(`# ${localId}`) && !item.body.toLowerCase().includes(`# ${localId.toLowerCase()}`)) {
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

  // Check dependencies if allItems provided
  if (allItems && item.depends_on && item.depends_on.length > 0) {
    const allIds = new Set(allItems.map(i => i.id));
    const archivedIds = new Set(
      allItems.filter(i => i.folder === "archive").map(i => i.id)
    );
    
    for (const depId of item.depends_on) {
      if (!allIds.has(depId)) {
        warnings.push(`depends_on target not found: ${depId}`);
      } else if (archivedIds.has(depId)) {
        warnings.push(`depends_on target is archived: ${depId}`);
      }
    }
  }

  return { ok: issues.length === 0, issues, warnings };
}
