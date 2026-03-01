import type { RouteObject } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProductPage } from "@/pages/ProductPage";
import { FeaturesPage } from "@/pages/FeaturesPage";
import { DocPage } from "@/pages/DocPage";
import { BacklogPage } from "@/pages/BacklogPage";
import { BacklogItemPage } from "@/pages/BacklogItemPage";
import { BacklogStatsPage } from "@/pages/BacklogStatsPage";
import { BacklogSearchPage } from "@/pages/BacklogSearchPage";
import { AgentsPage } from "@/pages/AgentsPage";
import { WorkerDetailPage } from "@/pages/WorkerDetailPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { CostsPage } from "@/pages/CostsPage";
import { IncidentsPage } from "@/pages/IncidentsPage";

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "product", element: <ProductPage /> },
      { path: "product/features", element: <FeaturesPage /> },
      { path: "product/doc/*", element: <DocPage /> },
      { path: "backlog", element: <BacklogPage /> },
      { path: "backlog/item/:id", element: <BacklogItemPage /> },
      { path: "backlog/stats", element: <BacklogStatsPage /> },
      { path: "backlog/search", element: <BacklogSearchPage /> },
      { path: "agents", element: <AgentsPage /> },
      { path: "agents/worker/:id", element: <WorkerDetailPage /> },
      { path: "agents/messages", element: <MessagesPage /> },
      { path: "agents/costs", element: <CostsPage /> },
      { path: "agents/incidents", element: <IncidentsPage /> },
    ],
  },
];
