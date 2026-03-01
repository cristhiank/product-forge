import { NavLink, Outlet } from "react-router-dom";
import { useSSE } from "@/hooks/use-sse";
import {
  Flame,
  FileText,
  Kanban,
  Bot,
  BarChart3,
  MessageSquare,
  DollarSign,
  AlertTriangle,
  LayoutDashboard,
  Puzzle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<LucideProps>;
  end?: boolean;
}

interface NavSection {
  label: string;
  main: NavItem;
  sub: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "PRODUCT",
    main: { to: "/product", label: "Product", icon: FileText },
    sub: [
      { to: "/product", label: "Overview", icon: FileText, end: true },
      { to: "/product/features", label: "Features", icon: Puzzle },
    ],
  },
  {
    label: "BACKLOG",
    main: { to: "/backlog", label: "Backlog", icon: Kanban },
    sub: [
      { to: "/backlog", label: "Board", icon: Kanban, end: true },
      { to: "/backlog/stats", label: "Stats", icon: BarChart3 },
    ],
  },
  {
    label: "AGENTS",
    main: { to: "/agents", label: "Agents", icon: Bot },
    sub: [
      { to: "/agents", label: "Workers", icon: Bot, end: true },
      { to: "/agents/messages", label: "Messages", icon: MessageSquare },
      { to: "/agents/costs", label: "Costs", icon: DollarSign },
      { to: "/agents/incidents", label: "Incidents", icon: AlertTriangle },
    ],
  },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
  );

const subLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2 rounded-md py-1 pl-9 pr-3 text-[13px] transition-colors",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
  );

function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* Dashboard */}
        <NavLink to="/" end className={navLinkClass}>
          <Flame className="h-4 w-4" />
          Dashboard
        </NavLink>

        {sections.map((section) => (
          <div key={section.label}>
            <div className="my-3 border-t border-sidebar-border" />
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
            <NavLink to={section.main.to} className={navLinkClass}>
              <section.main.icon className="h-4 w-4" />
              {section.main.label}
            </NavLink>
            <div className="mt-0.5 space-y-0.5">
              {section.sub.map((item) => (
                <NavLink
                  key={item.to + item.label}
                  to={item.to}
                  end={item.end}
                  className={subLinkClass}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold tracking-tight">
          Forge Mission Control
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <LayoutDashboard className="h-3.5 w-3.5" />
        <span>forge-mission-control</span>
      </div>
    </header>
  );
}

function StatusBar() {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-card px-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        Active
      </span>
      <span>3 systems active</span>
      <span>Updated just now</span>
    </footer>
  );
}

export function AppShell() {
  useSSE();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
}
