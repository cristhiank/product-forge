export function formatBacklogItemTemplate(opts: {
  id: string;
  kind: "task" | "epic";
  title: string;
  description?: string;
  acceptance_criteria?: string[];
  tags?: string[];
  priority?: "low" | "medium" | "high";
  parent?: string;
  depends_on?: string[];
  related?: string[];
}): string {
  const created = new Date().toISOString().slice(0, 10);
  const tags = opts.tags?.length ? `[${opts.tags.join(", ")}]` : "[]";
  const priority = opts.priority ? capitalize(opts.priority) : "Medium";
  const type = opts.kind === "epic" ? "Epic" : "Story";
  const parentLine = opts.parent ? `**Parent:** ${opts.parent}  ` : "**Parent:** N/A  ";
  const depsLine = opts.depends_on?.length
    ? `**Depends-On:** [${opts.depends_on.join(", ")}]  \n`
    : "";
  const relatedLine = opts.related?.length
    ? `**Related:** [${opts.related.join(", ")}]  \n`
    : "";

  const ac = opts.acceptance_criteria?.length
    ? opts.acceptance_criteria.map((x) => `- [ ] ${x}`).join("\n")
    : "- [ ]";

  return (
    `# ${opts.id}: ${opts.title}\n\n` +
    `**Created:** ${created}  \n` +
    `**Updated:** ${created}  \n` +
    `**Type:** ${type}  \n` +
    `**Priority:** ${priority}  \n` +
    `**Status:** Not Started  \n` +
    `**Estimate:** TBD  \n` +
    parentLine +
    `\n` +
    depsLine +
    relatedLine +
    `**Tags:** ${tags}  \n\n` +
    `---\n\n` +
    `## Goal\n\n` +
    `${opts.description?.trim() || "(describe the goal)"}\n\n` +
    `## Acceptance Criteria\n\n` +
    `${ac}\n\n`
  );
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}
