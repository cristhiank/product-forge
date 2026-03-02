import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface BacklogItem {
  id: string;
  title: string;
  kind?: string;
  priority?: string;
  folder?: string;
  tags?: string[];
  depends_on?: string[];
  related?: string[];
  body?: string;
  metadata?: Record<string, unknown>;
}

const KIND_BADGE: Record<string, string> = {
  epic: "bg-blue-500/15 text-blue-400",
  task: "bg-gray-500/15 text-gray-400",
  bug: "bg-red-500/15 text-red-400",
  feature: "bg-green-500/15 text-green-400",
  chore: "bg-yellow-500/15 text-yellow-400",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-500/15 text-red-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  low: "bg-green-500/15 text-green-400",
};

const FOLDER_BADGE: Record<string, string> = {
  next: "bg-blue-500/15 text-blue-400",
  working: "bg-yellow-500/15 text-yellow-400",
  done: "bg-green-500/15 text-green-400",
  archive: "bg-gray-500/15 text-gray-400",
};

function Badge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function BacklogItemPage() {
  const { id } = useParams<{ id: string }>();

  // Use the backlog selection persisted by BacklogPage/BacklogSearchPage
  const backlogParam = localStorage.getItem("selectedBacklog") ?? "";

  const { data: item, isLoading } = useQuery<BacklogItem>({
    queryKey: ["backlog", "item", backlogParam, id],
    queryFn: () => api.get<BacklogItem>(`/api/backlog/item/${id}?backlog=${encodeURIComponent(backlogParam)}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!item) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        Item not found
      </div>
    );
  }

  const meta = item.metadata as
    | { created_at?: string; updated_at?: string }
    | undefined;

  return (
    <div className="max-w-3xl">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-muted-foreground flex items-center gap-1.5">
        <Link to="/backlog" className="hover:text-foreground transition-colors">
          Backlog
        </Link>
        <span>›</span>
        <span className="font-mono text-foreground">{item.id}</span>
      </nav>

      {/* Header */}
      <h1 className="text-2xl font-bold mb-3">{item.title}</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {item.kind && (
          <Badge
            label={item.kind}
            className={KIND_BADGE[item.kind] ?? "bg-gray-500/15 text-gray-400"}
          />
        )}
        {item.priority && (
          <Badge
            label={item.priority}
            className={
              PRIORITY_BADGE[item.priority] ?? "bg-gray-500/15 text-gray-400"
            }
          />
        )}
        {item.folder && (
          <Badge
            label={item.folder}
            className={
              FOLDER_BADGE[item.folder] ?? "bg-gray-500/15 text-gray-400"
            }
          />
        )}
      </div>

      {/* Metadata */}
      {meta && (meta.created_at || meta.updated_at) && (
        <section className="rounded-lg border border-border bg-card p-4 mb-6">
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
            Metadata
          </h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {meta.created_at && (
              <>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{meta.created_at}</dd>
              </>
            )}
            {meta.updated_at && (
              <>
                <dt className="text-muted-foreground">Updated</dt>
                <dd>{meta.updated_at}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {/* Dependencies */}
      {item.depends_on && item.depends_on.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-4 mb-6">
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
            Dependencies
          </h2>
          <ul className="space-y-1">
            {item.depends_on.map((dep) => (
              <li key={dep}>
                <Link
                  to={`/backlog/item/${dep}`}
                  className="font-mono text-sm text-primary hover:underline"
                >
                  {dep}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tags */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Body / Description */}
      {item.body && (
        <section className="prose prose-invert prose-sm max-w-none">
          <Markdown>{item.body}</Markdown>
        </section>
      )}
    </div>
  );
}
