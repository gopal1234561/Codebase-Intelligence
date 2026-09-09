import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router as WouterRouter, useLocation } from "wouter";
import RepositoryDashboard from "@/pages/repository-dashboard";
import IntelligenceCenter from "@/pages/intelligence-center";
import ArchitectureView from "@/pages/architecture-view";
import DependencyGraph from "@/pages/dependency-graph";

const queryClient = new QueryClient();

function AppBoundary({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function RoutedApp() {
  const [location] = useLocation();
  if (location === "/insights") return <IntelligenceCenter />;
  if (location === "/architecture") return <ArchitectureView />;
  if (location === "/graph") return <DependencyGraph />;
  if (location === "/dashboard") return <RepositoryDashboard />;
  return <ArchitectureView />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppBoundary>
            <RoutedApp />
          </AppBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
