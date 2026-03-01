function sanitizeHref(href: string): string {
  const trimmed = href.trim();
  const lowered = trimmed.toLowerCase();
  if (lowered.startsWith('javascript:') || lowered.startsWith('data:')) {
    return '#';
  }
  return trimmed;
}

function applyInlineMarkdown(content: string): string {
  let out = escapeHtml(content);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, href: string) => {
    const safeHref = escapeHtml(sanitizeHref(href));
    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  return out;
}

export function mdToHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const fences: string[] = [];

  const withoutFences = normalized.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
    const language = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    const html = `<pre><code${language}>${escapeHtml(code.trimEnd())}</code></pre>`;
    const token = `__FENCE_${fences.length}__`;
    fences.push(html);
    return token;
  });

  const lines = withoutFences.split('\n');
  const html: string[] = [];

  let inUl = false;
  let inOl = false;
  let inBlockquote = false;

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      html.push('</blockquote>');
      inBlockquote = false;
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      closeBlockquote();
      continue;
    }

    const tableHeaderMatch = /^\|(.+)\|$/.exec(trimmed);
    const tableDividerMatch = i + 1 < lines.length ? /^\|(\s*:?-{3,}:?\s*\|)+$/.exec(lines[i + 1].trim()) : null;
    if (tableHeaderMatch && tableDividerMatch) {
      closeLists();
      closeBlockquote();

      const parseCells = (row: string) => row
        .split('|')
        .slice(1, -1)
        .map((cell) => applyInlineMarkdown(cell.trim()));

      const headers = parseCells(trimmed);
      const bodyRows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\|(.+)\|$/.test(lines[i].trim())) {
        bodyRows.push(parseCells(lines[i].trim()));
        i += 1;
      }
      i -= 1;

      const headerHtml = headers.map((cell) => `<th>${cell}</th>`).join('');
      const rowsHtml = bodyRows
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
        .join('');

      html.push('<table>');
      html.push(`<thead><tr>${headerHtml}</tr></thead>`);
      html.push(`<tbody>${rowsHtml}</tbody>`);
      html.push('</table>');
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      closeLists();
      closeBlockquote();
      const level = heading[1].length;
      html.push(`<h${level}>${applyInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      closeLists();
      closeBlockquote();
      html.push('<hr>');
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      closeLists();
      if (!inBlockquote) {
        html.push('<blockquote>');
        inBlockquote = true;
      }
      html.push(`<p>${applyInlineMarkdown(quote[1])}</p>`);
      continue;
    }

    closeBlockquote();

    const unordered = /^-\s+(.+)$/.exec(trimmed);
    if (unordered) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${applyInlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
    if (ordered) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${applyInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    closeLists();
    html.push(`<p>${applyInlineMarkdown(trimmed)}</p>`);
  }

  closeLists();
  closeBlockquote();

  const output = html.join('\n');
  const withFences = output.replace(/__FENCE_(\d+)__/g, (_match, idx: string) => fences[Number(idx)] ?? '');
  return `<div class="markdown-body">${withFences}</div>`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
