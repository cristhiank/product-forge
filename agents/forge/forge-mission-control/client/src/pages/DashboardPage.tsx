import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Link } from "react-router-dom";
import {
  FileText,
  Kanban,
  Bot,
  BarChart3,
  Puzzle,
  Loader2,
} from "lucide-react";

interface DiscoveryData {
  repoRoot: string;
  systems: string[];
  hasProduct: boolean;
  hasBacklog: boolean;
  hasAgents: boolean;
  hasWorkers: boolean;
}

const systemCards = [
  { key: "hasProduct", label: "Product", emoji: "📋", to: "/product" },
  { key: "hasBacklog", label: "Backlog", emoji: "📦", to: "/backlog" },
  { key: "hasAgents", label: "Agents", emoji: "🤖", to: "/agents" },
] as const;

const quickLinks = [
  { to: "/product", label: "Product Overview", icon: FileText },
  { to: "/product/features", label: "Features", icon: Puzzle },
  { to: "/backlog", label: "Backlog Board", icon: Kanban },
  { to: "/backlog/stats", label: "Backlog Stats", icon: BarChart3 },
  { to: "/agents", label: "Agents", icon: Bot },
];

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["discovery"],
    queryFn: () => api.get<DiscoveryData>("/api/discovery"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  const projectName = data?.repoRoot?.split("/").pop() ?? "Unknown";
  const systemCount = data?.systems?.length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{projectName}</h1>
        <p className="text-sm text-muted-foreground">
          {systemCount} system{systemCount !== 1 ? "s" : ""} discovered
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {systemCards.map((card) => {
          const active = data?.[card.key] ?? false;
          return (
            <Link
              key={card.key}
              to={card.to}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{card.emoji}</span>
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {card.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {active ? "Active" : "Not detected"}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Quick Links
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <link.icon className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {link.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
