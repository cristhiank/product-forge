import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useRoutes } from "react-router-dom";
import { queryClient } from "@/lib/query-client";
import { routes } from "@/routes";

function AppRoutes() {
  return useRoutes(routes);
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
