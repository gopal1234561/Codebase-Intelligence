import { type ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router as WouterRouter, Link, useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import "./codebase-theme.css";
import RepositoryDashboard from "@/pages/repository-dashboard";
import IntelligenceCenter from "@/pages/intelligence-center";
import ArchitectureView from "@/pages/architecture-view";
import DependencyGraph from "@/pages/dependency-graph";
import ImpactAnalysis from "@/pages/impact-analysis";
import CodeSearch from "@/pages/code-search";

const queryClient = new QueryClient();
function AppBoundary({ children }: { children: ReactNode }) { return <ErrorBoundary>{children}</ErrorBoundary>; }
function AIInsightsButton() { return <Link href="/insights" className="ci-ai-action fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-lg"><Sparkles size={15}/> AI Insights</Link>; }

function RoutedApp() {
  const [location] = useLocation();
  const workspaceRoutes = ["/", "/dashboard", "/files", "/graph", "/risks", "/activity", "/impact"];
  const isWorkspaceRoute = workspaceRoutes.includes(location);
  useEffect(() => { if (["/dashboard", "/files", "/graph", "/risks", "/activity", "/impact"].includes(location)) sessionStorage.setItem("codebase-workspace-active", "true"); }, [location]);
  if (location === "/insights") return <IntelligenceCenter />;
  if (location === "/architecture") return <ArchitectureView />;
  if (location === "/search") return <><CodeSearch /><AIInsightsButton /></>;
  if (location === "/impact") return <><ImpactAnalysis/><AIInsightsButton/></>;
  if (location === "/graph") return <><DependencyGraph /><AIInsightsButton /></>;
  if (isWorkspaceRoute) {
    const hasActiveWorkspace = typeof window !== "undefined" && sessionStorage.getItem("codebase-workspace-active") === "true";
    if (location === "/" && !hasActiveWorkspace) return <ArchitectureView />;
    return <><RepositoryDashboard /><AIInsightsButton /></>;
  }
  return <ArchitectureView />;
}

export default function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><AppBoundary><RoutedApp /></AppBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
