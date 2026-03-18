export interface AcceptanceCriteriaInfo {
  /** Total checkbox count (both empty and with text) */
  total: number;
  /** Checkboxes that have actual text content */
  with_content: number;
  /** Checkboxes that are empty placeholders (just `- [ ]` or `- [x]`) */
  empty: number;
}

export interface ParsedBacklogMarkdown {
  title: string;
  metadata: Record<string, string>;
  tags: string[];
  depends_on: string[];
  related: string[];
  acceptance_criteria: AcceptanceCriteriaInfo;
  has_done_when: boolean;
  has_scope: boolean;
}

/**
 * Minimal parser for existing repo backlog markdown conventions.
 *
 * Assumptions (based on app/.backlog/*.md):
 * - First H1 line is title
 * - Metadata lines look like: **Key:** Value
 * - Tags are within metadata as: **Tags:** [a, b, c]
 */

/** Strip all parenthetical comments from a value string before splitting. */
function stripParentheticals(value: string): string {
  return value.replace(/\s*\([^)]*\)/g, "");
}

export function parseBacklogMarkdown(markdown: string): ParsedBacklogMarkdown {
  const lines = markdown.split(/\r?\n/);
  const titleLine = lines.find((l) => l.startsWith("# ")) || "# (untitled)";
  const title = titleLine.replace(/^#\s+/, "").trim();

  const metadata: Record<string, string> = {};
  const tags: string[] = [];
  const depends_on: string[] = [];
  const related: string[] = [];

  for (const line of lines) {
    const m = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim();
    metadata[key] = value;

    const isDepOrRelated =
      key.toLowerCase() === "depends-on" ||
      key.toLowerCase() === "depends on" ||
      key.toLowerCase() === "related";

    // Strip parenthetical comments before splitting for dep/related fields
    const cleanValue = isDepOrRelated ? stripParentheticals(value) : value;

    const parsedList = cleanValue
      .replace(/^\[/, "")
      .replace(/\]$/, "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (key.toLowerCase() === "tags") {
      tags.push(...parsedList);
    } else if (key.toLowerCase() === "depends-on" || key.toLowerCase() === "depends on") {
      depends_on.push(...parsedList);
    } else if (key.toLowerCase() === "related") {
      related.push(...parsedList);
    }
  }

  // Parse acceptance criteria checkboxes
  const acceptance_criteria = parseAcceptanceCriteria(markdown);

  // Detect ## Done When and ## Scope sections
  const has_done_when = /##\s+Done When/i.test(markdown);
  const has_scope = /##\s+Scope/i.test(markdown);

  return { title, metadata, tags, depends_on, related, acceptance_criteria, has_done_when, has_scope };
}

/** Extract acceptance criteria quality info from the markdown body. */
function parseAcceptanceCriteria(markdown: string): AcceptanceCriteriaInfo {
  // Find the AC or Done When section content
  const acMatch = markdown.match(/##\s+(?:Acceptance Criteria|Done When)\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i);
  if (!acMatch) return { total: 0, with_content: 0, empty: 0 };

  const section = acMatch[1];
  const checkboxes = section.match(/^-\s+\[[ x]\].*/gim) || [];
  let with_content = 0;
  let empty = 0;

  for (const line of checkboxes) {
    // Strip the checkbox prefix and check if there's actual text
    const text = line.replace(/^-\s+\[[ x]\]\s*/, "").trim();
    if (text.length > 0) {
      with_content++;
    } else {
      empty++;
    }
  }

  return { total: checkboxes.length, with_content, empty };
}
