import type { RouteObject } from "react-router-dom";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProductPage } from "@/pages/ProductPage";
import { BacklogPage } from "@/pages/BacklogPage";
import { AgentsPage } from "@/pages/AgentsPage";

export const routes: RouteObject[] = [
  { index: true, element: <DashboardPage /> },
  { path: "product", element: <ProductPage /> },
  { path: "backlog", element: <BacklogPage /> },
  { path: "agents", element: <AgentsPage /> },
];
