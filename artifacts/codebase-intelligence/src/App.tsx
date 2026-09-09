import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Router as WouterRouter, Link, useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import "./codebase-theme.css";
import LandingPage from "@/pages/landing-page";
import RepositoryDashboard from "@/pages/repository-dashboard";
import IntelligenceCenter from "@/pages/intelligence-center";
import ArchitectureView from "@/pages/architecture-view";
import DependencyGraph from "@/pages/dependency-graph";
import ImpactAnalysis from "@/pages/impact-analysis";
import CodeSearch from "@/pages/code-search";
import EngineeringInsights from "@/pages/engineering-insights";
import DocumentationGenerator from "@/pages/documentation-generator";

const queryClient = new QueryClient();
function AppBoundary({ children }: { children: ReactNode }) { return <ErrorBoundary>{children}</ErrorBoundary>; }

function RoutedApp() {
  const [location] = useLocation();
  if (location === "/") return <LandingPage />;
  if (location === "/insights") return <IntelligenceCenter />;
  if (location === "/engineering") return <EngineeringInsights />;
  if (location === "/architecture") return <ArchitectureView />;
  if (location === "/documentation") return <DocumentationGenerator />;
  if (location === "/search") return <><CodeSearch /><Link href="/insights" className="ci-ai-action fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-lg"><Sparkles size={15}/> AI Insights</Link></>;
  if (location === "/impact") return <ImpactAnalysis />;
  if (location === "/graph") return <DependencyGraph />;
  return <RepositoryDashboard />;
}

export default function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><AppBoundary><RoutedApp /></AppBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
