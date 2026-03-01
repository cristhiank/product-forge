import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, ChevronRight } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocData {
  doc: {
    path: string;
    title: string;
    content: string;
    frontmatter: Record<string, unknown>;
  };
}

export function DocPage() {
  const { "*": path } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["product", "doc", path],
    queryFn: () => api.get<DocData>(`/api/product/doc/${path}`),
    enabled: !!path,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (error || !data?.doc) {
    return (
      <div className="text-muted-foreground">
        {error ? String(error) : "Document not found."}
      </div>
    );
  }

  const { doc } = data;
  const fm = doc.frontmatter ?? {};
  const metaEntries = Object.entries(fm).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/product" className="hover:text-foreground">
          Product
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{doc.title || path}</span>
      </nav>

      {/* Frontmatter card */}
      {metaEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            {doc.title}
          </h2>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {metaEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2 text-sm">
                <span className="font-medium capitalize text-muted-foreground">
                  {key}:
                </span>
                <span className="text-foreground">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Markdown body */}
      <article className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-a:text-primary prose-strong:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:text-foreground prose-pre:bg-muted">
        <Markdown remarkPlugins={[remarkGfm]}>{doc.content}</Markdown>
      </article>
    </div>
  );
}
