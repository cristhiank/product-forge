import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, Outlet, useRoutes } from "react-router-dom";
import { queryClient } from "@/lib/query-client";
import { useSSE } from "@/hooks/use-sse";
import { routes } from "@/routes";

function AppRoutes() {
  return useRoutes(routes);
}

function Layout() {
  useSSE();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-lg tracking-tight">
          Forge Mission Control
        </span>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            Dashboard
          </Link>
          <Link
            to="/product"
            className="hover:text-foreground transition-colors"
          >
            Product
          </Link>
          <Link
            to="/backlog"
            className="hover:text-foreground transition-colors"
          >
            Backlog
          </Link>
          <Link
            to="/agents"
            className="hover:text-foreground transition-colors"
          >
            Agents
          </Link>
        </nav>
      </header>
      <main>
        <AppRoutes />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
