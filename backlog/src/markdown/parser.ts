export interface ParsedBacklogMarkdown {
  title: string;
  metadata: Record<string, string>;
  tags: string[];
}

/**
 * Minimal parser for existing repo backlog markdown conventions.
 *
 * Assumptions (based on app/.backlog/*.md):
 * - First H1 line is title
 * - Metadata lines look like: **Key:** Value
 * - Tags are within metadata as: **Tags:** [a, b, c]
 */
export function parseBacklogMarkdown(markdown: string): ParsedBacklogMarkdown {
  const lines = markdown.split(/\r?\n/);
  const titleLine = lines.find((l) => l.startsWith("# ")) || "# (untitled)";
  const title = titleLine.replace(/^#\s+/, "").trim();

  const metadata: Record<string, string> = {};
  const tags: string[] = [];

  for (const line of lines) {
    const m = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const value = m[2].trim();
    metadata[key] = value;
    if (key.toLowerCase() === "tags") {
      const list = value
        .replace(/^\[/, "")
        .replace(/\]$/, "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      tags.push(...list);
    }
  }

  return { title, metadata, tags };
}
