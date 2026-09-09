import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  Database,
  FileCode2,
  Files,
  GitBranch,
  Info,
  Layers3,
  Loader2,
  Menu,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Risk = "low" | "medium" | "high" | "critical";

type FileItem = {
  id: string;
  path: string;
  language: string;
  lines: number;
  imports: number;
  importedBy: number;
  risk: Risk;
  size?: number;
};

type Overview = {
  repository?: string;
  branch?: string;
  totalFiles?: number;
  totalLines?: number;
  languages?: Record<string, number>;
  risk?: Record<Risk, number>;
  dependencies?: number;
  modules?: number;
  lastScan?: string;
  score?: number;
};

type Detail = {
  path: string;
  language: string;
  lines: number;
  imports: number;
  importedBy: number;
  risk: Risk;
  source?: string;
  content?: string;
  dependencies?: string[];
  dependents?: string[];
};

type Graph = {
  nodes: Array<{
    id: string;
    label: string;
    path: string;
    directory: string;
    language: string;
    lines: number;
    imports: number;
    importedBy: number;
    risk: Risk;
  }>;
  edges: Array<{
    source: string;
    target: string;
    kind: string;
  }>;
};

type Finding = {
  id?: string;
  title?: string;
  description?: string;
  severity?: Risk;
  risk?: Risk;
  file?: string;
  path?: string;
  line?: number;
  status?: string;
  recommendation?: string;
};

type EventItem = {
  id?: string;
  type?: string;
  title?: string;
  description?: string;
  createdAt?: string;
  timestamp?: string;
  status?: string;
};

type Page = "overview" | "files" | "graph" | "risks" | "activity";

const api = async <T,>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`/api${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body?.error || body?.message || `Request failed (${response.status})`,
    );
  }

  return body as T;
};

const riskStyles: Record<
  Risk,
  {
    badge: string;
    border: string;
    text: string;
    icon: typeof ShieldCheck;
  }
> = {
  low: {
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    border: "stroke-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: ShieldCheck,
  },
  medium: {
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    border: "stroke-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
  },
  high: {
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    border: "stroke-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    icon: CircleAlert,
  },
  critical: {
    badge: "bg-red-500/10 text-red-600 dark:text-red-400",
    border: "stroke-red-500",
    text: "text-red-600 dark:text-red-400",
    icon: ShieldAlert,
  },
};

function normalizeRisk(value?: string): Risk {
  const risk = String(value || "low").toLowerCase();

  if (risk === "critical") return "critical";
  if (risk === "high") return "high";
  if (risk === "medium" || risk === "moderate") return "medium";

  return "low";
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}

function getFileName(path: string) {
  return path.split("/").pop() || path;
}

function getDirectory(path: string) {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/") || "/";
}

function getLanguageIcon(language?: string) {
  const value = String(language || "").toLowerCase();

  if (
    value.includes("typescript") ||
    value.includes("javascript") ||
    value.includes("tsx") ||
    value.includes("jsx")
  ) {
    return Code2;
  }

  if (value.includes("python")) {
    return Database;
  }

  return FileCode2;
}

function RiskBadge({ risk }: { risk: Risk }) {
  const style = riskStyles[risk];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium capitalize",
        style.badge,
      )}
    >
      <Icon className="h-3 w-3" />
      {risk}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  icon: Icon = Files,
}: {
  title: string;
  description: string;
  icon?: typeof Files;
}) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mb-3 rounded-full bg-muted p-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export default function RepositoryDashboard() {
  const [page, setPage] = useState<Page>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);

  const [selectedFile, setSelectedFile] = useState<Detail | null>(null);

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  const [fileSearch, setFileSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | Risk>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [overviewResult, filesResult, graphResult, findingsResult, eventsResult] =
        await Promise.all([
          api<Overview>("/repository/overview"),
          api<{ files?: FileItem[] }>("/repository/files"),
          api<Graph>("/repository/graph"),
          api<{ findings?: Finding[] }>("/repository/findings"),
          api<{ events?: EventItem[] }>("/repository/events"),
        ]);

      setOverview(overviewResult);
      setFiles(filesResult?.files || []);
      setGraph(graphResult);
      setFindings(findingsResult?.findings || []);
      setEvents(eventsResult?.events || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load repository information.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const scan = useCallback(async () => {
    setScanning(true);
    setError("");

    try {
      await api("/repository/scan", {
        method: "POST",
        body: JSON.stringify({}),
      });

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Repository scan failed.",
      );
    } finally {
      setScanning(false);
    }
  }, [refresh]);

  const openFile = useCallback(async (path: string) => {
    try {
      const result = await api<Detail>(
        `/repository/file?path=${encodeURIComponent(path)}`,
      );

      setSelectedFile(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to open source file.",
      );
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredFiles = useMemo(() => {
    const search = fileSearch.trim().toLowerCase();

    return files.filter((file) => {
      const matchesSearch =
        !search ||
        file.path.toLowerCase().includes(search) ||
        file.language.toLowerCase().includes(search);

      const matchesRisk =
        riskFilter === "all" || normalizeRisk(file.risk) === riskFilter;

      return matchesSearch && matchesRisk;
    });
  }, [files, fileSearch, riskFilter]);

  const riskCounts = useMemo(() => {
    const counts: Record<Risk, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    for (const finding of findings) {
      const risk = normalizeRisk(finding.severity || finding.risk);
      counts[risk] += 1;
    }

    return counts;
  }, [findings]);

  const navItems: Array<{
    id: Page;
    label: string;
    icon: typeof Activity;
  }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "files", label: "Files", icon: Files },
    { id: "graph", label: "Dependency Graph", icon: Network },
    { id: "risks", label: "Risks", icon: ShieldAlert },
    { id: "activity", label: "Activity", icon: Activity },
  ];

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-5">
            <button
              type="button"
              onClick={() => navigate("overview")}
              className="flex min-w-0 items-center gap-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="h-5 w-5" />
              </div>

              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold">Codebase Intelligence</p>
                <p className="truncate text-xs text-sidebar-foreground/60">
                  Repository analyzer
                </p>
              </div>
            </button>

            <button
              type="button"
              className="rounded-md p-2 hover:bg-sidebar-accent lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            <p className="mb-2 px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Workspace
            </p>

            {navItems.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="rounded-lg bg-sidebar-accent/60 p-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                <span className="truncate text-xs font-medium">
                  {overview?.branch || "replit-agent"}
                </span>
              </div>

              <p className="mt-1 truncate text-[11px] text-sidebar-foreground/50">
                {overview?.repository || "Repository"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {mobileMenuOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <main className="min-w-0 lg:ml-[280px]">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-lg border border-border p-2 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold sm:text-lg">
                  {navItems.find((item) => item.id === page)?.label}
                </h1>

                <p className="hidden truncate text-xs text-muted-foreground sm:block">
                  {overview?.repository || "Repository analysis workspace"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={loading || scanning}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                type="button"
                onClick={scan}
                disabled={scanning}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {scanning ? "Scanning..." : "Analyze"}
                </span>
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {error ? (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div className="min-w-0">
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {error}
                </p>
              </div>
              <button
                type="button"
                className="ml-auto shrink-0 rounded-md p-1 hover:bg-muted"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {loading && !overview ? (
            <LoadingDashboard />
          ) : (
            <>
              {page === "overview" ? (
                <OverviewView
                  overview={overview}
                  files={files}
                  findings={findings}
                  riskCounts={riskCounts}
                  onNavigate={navigate}
                />
              ) : null}

              {page === "files" ? (
                <FilesView
                  files={filteredFiles}
                  search={fileSearch}
                  setSearch={setFileSearch}
                  riskFilter={riskFilter}
                  setRiskFilter={setRiskFilter}
                  onOpenFile={openFile}
                />
              ) : null}

              {page === "graph" ? (
                <GraphView
                  graph={graph}
                  onOpenFile={openFile}
                />
              ) : null}

              {page === "risks" ? (
                <RisksView
                  findings={findings}
                  riskCounts={riskCounts}
                  onOpenFile={openFile}
                />
              ) : null}

              {page === "activity" ? (
                <ActivityView events={events} />
              ) : null}
            </>
          )}
        </div>
      </main>

      {selectedFile ? (
        <SourceModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      ) : null}
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-muted" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-xl bg-muted"
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="h-80 animate-pulse rounded-xl bg-muted xl:col-span-2" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

function OverviewView({
  overview,
  files,
  findings,
  riskCounts,
  onNavigate,
}: {
  overview: Overview | null;
  files: FileItem[];
  findings: Finding[];
  riskCounts: Record<Risk, number>;
  onNavigate: (page: Page) => void;
}) {
  const totalRisk =
    riskCounts.low +
    riskCounts.medium +
    riskCounts.high +
    riskCounts.critical;

  const score = overview?.score ?? 0;

  const languages = Object.entries(overview?.languages || {}).sort(
    (a, b) => b[1] - a[1],
  );

  const topFiles = [...files]
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Repository health</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              {overview?.repository || "Codebase Overview"}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            Last scan: {overview?.lastScan || "Not available"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total files"
          value={formatNumber(overview?.totalFiles ?? files.length)}
          description="Source files analyzed"
          icon={Files}
        />

        <StatCard
          title="Lines of code"
          value={formatNumber(overview?.totalLines)}
          description="Across the repository"
          icon={Code2}
        />

        <StatCard
          title="Dependencies"
          value={formatNumber(overview?.dependencies)}
          description="Detected relationships"
          icon={Network}
        />

        <StatCard
          title="Health score"
          value={`${score}%`}
          description="Overall repository health"
          icon={ShieldCheck}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Repository summary</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                High-level structure and risk distribution.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate("graph")}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
            >
              View graph
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Risk distribution</span>
                <span className="text-xs text-muted-foreground">
                  {totalRisk} findings
                </span>
              </div>

              <div className="space-y-3">
                {(["critical", "high", "medium", "low"] as Risk[]).map(
                  (risk) => {
                    const count = riskCounts[risk];
                    const percentage =
                      totalRisk > 0 ? (count / totalRisk) * 100 : 0;

                    return (
                      <div key={risk}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <RiskBadge risk={risk} />
                          <span className="text-muted-foreground">
                            {count}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-current"
                            style={{
                              width: `${percentage}%`,
                              color:
                                risk === "critical"
                                  ? "rgb(239 68 68)"
                                  : risk === "high"
                                    ? "rgb(249 115 22)"
                                    : risk === "medium"
                                      ? "rgb(245 158 11)"
                                      : "rgb(16 185 129)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 text-sm font-medium">Languages</div>

              {languages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No language data available.
                </p>
              ) : (
                <div className="space-y-3">
                  {languages.slice(0, 6).map(([language, value]) => {
                    const total = languages.reduce(
                      (sum, [, amount]) => sum + amount,
                      0,
                    );

                    const percentage =
                      total > 0 ? (value / total) * 100 : 0;

                    return (
                      <div key={language}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span>{language}</span>
                          <span className="text-muted-foreground">
                            {Math.round(percentage)}%
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Recent findings</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Latest detected risks.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate("risks")}
              className="text-xs font-medium text-primary"
            >
              View all
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {findings.length === 0 ? (
              <EmptyState
                title="No findings"
                description="No security or code-quality findings were returned."
                icon={ShieldCheck}
              />
            ) : (
              findings.slice(0, 5).map((finding, index) => {
                const risk = normalizeRisk(
                  finding.severity || finding.risk,
                );

                return (
                  <div
                    key={finding.id || `${finding.title}-${index}`}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium">
                        {finding.title || "Untitled finding"}
                      </p>

                      <RiskBadge risk={risk} />
                    </div>

                    {finding.file || finding.path ? (
                      <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                        {finding.file || finding.path}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Largest modules</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Files with the highest line counts.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("files")}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary"
          >
            Browse files
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {topFiles.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No files"
              description="No repository files are available."
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {topFiles.map((file) => {
              const Icon = getLanguageIcon(file.language);

              return (
                <div
                  key={file.id || file.path}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {getFileName(file.path)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {file.path}
                    </p>
                  </div>

                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {formatNumber(file.lines)} lines
                  </span>

                  <RiskBadge risk={normalizeRisk(file.risk)} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function FilesView({
  files,
  search,
  setSearch,
  riskFilter,
  setRiskFilter,
  onOpenFile,
}: {
  files: FileItem[];
  search: string;
  setSearch: (value: string) => void;
  riskFilter: "all" | Risk;
  setRiskFilter: (value: "all" | Risk) => void;
  onOpenFile: (path: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Repository files</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore analyzed source files and their dependencies.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files..."
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none ring-primary/20 placeholder:text-muted-foreground focus:ring-2"
            />
          </div>

          <select
            value={riskFilter}
            onChange={(event) =>
              setRiskFilter(event.target.value as "all" | Risk)
            }
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none"
          >
            <option value="all">All risks</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {files.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No matching files"
              description="Try changing the search text or risk filter."
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium">File</th>
                    <th className="px-3 py-3 font-medium">Language</th>
                    <th className="px-3 py-3 font-medium">Lines</th>
                    <th className="px-3 py-3 font-medium">Imports</th>
                    <th className="px-3 py-3 font-medium">Used by</th>
                    <th className="px-5 py-3 font-medium">Risk</th>
                  </tr>
                </thead>

                <tbody>
                  {files.map((file) => {
                    const Icon = getLanguageIcon(file.language);

                    return (
                      <tr
                        key={file.id || file.path}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                        onClick={() => onOpenFile(file.path)}
                      >
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />

                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {getFileName(file.path)}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {getDirectory(file.path)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-muted-foreground">
                          {file.language}
                        </td>

                        <td className="px-3 py-3">
                          {formatNumber(file.lines)}
                        </td>

                        <td className="px-3 py-3">
                          {formatNumber(file.imports)}
                        </td>

                        <td className="px-3 py-3">
                          {formatNumber(file.importedBy)}
                        </td>

                        <td className="px-5 py-3">
                          <RiskBadge risk={normalizeRisk(file.risk)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {files.map((file) => {
                const Icon = getLanguageIcon(file.language);

                return (
                  <button
                    key={file.id || file.path}
                    type="button"
                    onClick={() => onOpenFile(file.path)}
                    className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/50"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {getFileName(file.path)}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                            {file.path}
                          </p>
                        </div>

                        <RiskBadge risk={normalizeRisk(file.risk)} />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-md bg-muted/50 p-2">
                          <p className="text-muted-foreground">Lines</p>
                          <p className="mt-1 font-medium">
                            {formatNumber(file.lines)}
                          </p>
                        </div>

                        <div className="rounded-md bg-muted/50 p-2">
                          <p className="text-muted-foreground">Imports</p>
                          <p className="mt-1 font-medium">
                            {formatNumber(file.imports)}
                          </p>
                        </div>

                        <div className="rounded-md bg-muted/50 p-2">
                          <p className="text-muted-foreground">Used by</p>
                          <p className="mt-1 font-medium">
                            {formatNumber(file.importedBy)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GraphView({
  graph,
  onOpenFile,
}: {
  graph: Graph | null;
  onOpenFile: (path: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const graphData = useMemo(() => {
    if (!graph) {
      return {
        nodes: [],
        edges: [],
      };
    }

    const degree = new Map<string, number>();

    for (const node of graph.nodes) {
      degree.set(
        node.id,
        (node.imports || 0) + (node.importedBy || 0),
      );
    }

    const nodes = [...graph.nodes]
      .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))
      .slice(0, 80);

    const nodeIds = new Set(nodes.map((node) => node.id));

    const edges = graph.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
    );

    return { nodes, edges };
  }, [graph]);

  const positions = useMemo(() => {
    const nodes = graphData.nodes;

    const width = 1200;
    const height = Math.max(650, Math.ceil(nodes.length / 5) * 125);

    const result = new Map<string, { x: number; y: number }>();

    nodes.forEach((node, index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);

      result.set(node.id, {
        x: 120 + column * 240,
        y: 70 + row * 125,
      });
    });

    return {
      positions: result,
      width,
      height,
    };
  }, [graphData.nodes]);

  if (!graph || graphData.nodes.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Dependency graph
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visualize relationships between repository modules.
          </p>
        </div>

        <EmptyState
          title="No dependency graph"
          description="Run an analysis to generate dependency relationships."
          icon={Network}
        />
      </div>
    );
  }

  const selected = graphData.nodes.find(
    (node) => node.id === selectedNode,
  );

  const selectedConnections = selected
    ? graphData.edges.filter(
        (edge) =>
          edge.source === selected.id || edge.target === selected.id,
      ).length
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Dependency graph
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing the most connected modules and directional dependencies.
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg border border-border bg-card p-1 sm:self-auto">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}
            className="rounded-md p-2 hover:bg-muted"
            aria-label="Zoom out"
          >
            <ArrowDown className="h-4 w-4" />
          </button>

          <span className="min-w-14 text-center text-xs font-medium">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(1.6, value + 0.1))}
            className="rounded-md p-2 hover:bg-muted"
            aria-label="Zoom in"
          >
            <ArrowUp className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-md px-2 py-2 text-xs hover:bg-muted"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="overflow-auto touch-pan-x touch-pan-y">
            <div
              className="min-h-[650px] min-w-[1000px] origin-top-left transition-transform"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                width: `${positions.width}px`,
                height: `${positions.height}px`,
              }}
            >
              <svg
                width={positions.width}
                height={positions.height}
                viewBox={`0 0 ${positions.width} ${positions.height}`}
                className="block"
              >
                <defs>
                  <marker
                    id="dependency-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <path
                      d="M0,0 L8,4 L0,8 Z"
                      fill="currentColor"
                    />
                  </marker>
                </defs>

                <g className="text-muted-foreground">
                  {graphData.edges.map((edge, index) => {
                    const source = positions.positions.get(edge.source);
                    const target = positions.positions.get(edge.target);

                    if (!source || !target) return null;

                    return (
                      <line
                        key={`${edge.source}-${edge.target}-${index}`}
                        x1={source.x + 85}
                        y1={source.y + 24}
                        x2={target.x + 85}
                        y2={target.y + 24}
                        stroke="currentColor"
                        strokeOpacity={0.35}
                        strokeWidth={1.5}
                        markerEnd="url(#dependency-arrow)"
                      />
                    );
                  })}
                </g>

                {graphData.nodes.map((node) => {
                  const position = positions.positions.get(node.id);

                  if (!position) return null;

                  const risk = normalizeRisk(node.risk);
                  const stroke = riskStyles[risk].border;

                  const isSelected = selectedNode === node.id;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${position.x}, ${position.y})`}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedNode(node.id);
                      }}
                      onDoubleClick={() => onOpenFile(node.path)}
                    >
                      <rect
                        x="0"
                        y="0"
                        width="170"
                        height="48"
                        rx="10"
                        fill="hsl(var(--card))"
                        strokeWidth={isSelected ? 3 : 2}
                        className={stroke}
                      />

                      <text
                        x="12"
                        y="20"
                        className="fill-foreground"
                        fontSize="11"
                        fontWeight="600"
                      >
                        {node.label.length > 22
                          ? `${node.label.slice(0, 21)}…`
                          : node.label}
                      </text>

                      <text
                        x="12"
                        y="36"
                        className="fill-muted-foreground"
                        fontSize="9"
                      >
                        {node.language} · {node.lines} lines
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-semibold">Selected module</h3>

          {selected ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="break-words font-mono text-sm font-medium">
                  {selected.path}
                </p>

                <div className="mt-2">
                  <RiskBadge risk={normalizeRisk(selected.risk)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Imports</p>
                  <p className="mt-1 text-lg font-semibold">
                    {selected.imports}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Used by</p>
                  <p className="mt-1 text-lg font-semibold">
                    {selected.importedBy}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Connections
                </p>
                <p className="mt-1 font-medium">
                  {selectedConnections} relationships
                </p>
              </div>

              <button
                type="button"
                onClick={() => onOpenFile(selected.path)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <FileCode2 className="h-4 w-4" />
                Inspect source
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Click a module in the graph to inspect its connections.
            </div>
          )}

          <div className="mt-6 border-t border-border pt-5">
            <p className="text-xs font-medium">Graph information</p>

            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between gap-3">
                <span>Modules</span>
                <span>{graphData.nodes.length}</span>
              </div>

              <div className="flex justify-between gap-3">
                <span>Relationships</span>
                <span>{graphData.edges.length}</span>
              </div>

              <div className="flex justify-between gap-3">
                <span>Displayed limit</span>
                <span>80 modules</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RisksView({
  findings,
  riskCounts,
  onOpenFile,
}: {
  findings: Finding[];
  riskCounts: Record<Risk, number>;
  onOpenFile: (path: string) => void;
}) {
  const sortedFindings = [...findings].sort((a, b) => {
    const priority: Record<Risk, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return (
      priority[normalizeRisk(b.severity || b.risk)] -
      priority[normalizeRisk(a.severity || a.risk)]
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Risks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Security, architecture, and code-quality findings.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["critical", "high", "medium", "low"] as Risk[]).map((risk) => (
          <div
            key={risk}
            className="rounded-xl border border-border bg-card p-4"
          >
            <RiskBadge risk={risk} />
            <p className="mt-3 text-2xl font-semibold">
              {riskCounts[risk]}
            </p>
            <p className="text-xs text-muted-foreground">
              {risk === "critical"
                ? "Critical issues"
                : risk === "high"
                  ? "High-risk issues"
                  : risk === "medium"
                    ? "Medium-risk issues"
                    : "Low-risk issues"}
            </p>
          </div>
        ))}
      </div>

      {sortedFindings.length === 0 ? (
        <EmptyState
          title="No risks detected"
          description="The analyzer did not return any findings."
          icon={ShieldCheck}
        />
      ) : (
        <div className="space-y-3">
          {sortedFindings.map((finding, index) => {
            const risk = normalizeRisk(
              finding.severity || finding.risk,
            );

            const path = finding.file || finding.path;

            return (
              <div
                key={finding.id || `${finding.title}-${index}`}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <RiskBadge risk={risk} />
                      <span className="text-xs text-muted-foreground">
                        {finding.status || "Open"}
                      </span>
                    </div>

                    <h3 className="mt-2 text-sm font-semibold">
                      {finding.title || "Untitled finding"}
                    </h3>

                    {finding.description ? (
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {finding.description}
                      </p>
                    ) : null}
                  </div>

                  {path ? (
                    <button
                      type="button"
                      onClick={() => onOpenFile(path)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                    >
                      Open file
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {path ? (
                  <div className="mt-4 rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate font-mono text-xs">
                        {path}
                      </span>

                      {finding.line ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          :{finding.line}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {finding.recommendation ? (
                  <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{finding.recommendation}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityView({ events }: { events: EventItem[] }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Activity</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent repository analysis events.
        </p>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No activity"
          description="Repository activity will appear here after scans and analysis."
          icon={Activity}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="divide-y divide-border">
            {events.map((event, index) => (
              <div
                key={event.id || `${event.title}-${index}`}
                className="flex gap-3 p-4 sm:p-5"
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {event.status === "failed" ? (
                    <XCircle className="h-4 w-4" />
                  ) : event.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Activity className="h-4 w-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium">
                      {event.title || event.type || "Repository event"}
                    </p>

                    <span className="shrink-0 text-xs text-muted-foreground">
                      {event.createdAt || event.timestamp || ""}
                    </span>
                  </div>

                  {event.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.description}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceModal({
  file,
  onClose,
}: {
  file: Detail;
  onClose: () => void;
}) {
  const source = file.source || file.content || "";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold sm:text-lg">
                {getFileName(file.path)}
              </h2>

              <RiskBadge risk={normalizeRisk(file.risk)} />
            </div>

            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
              {file.path}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 hover:bg-muted"
            aria-label="Close source viewer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1fr_280px]">
          <div className="min-h-0 overflow-auto bg-muted/20">
            {source ? (
              <pre className="min-w-max p-4 text-xs leading-5 sm:p-6 sm:text-sm">
                <code>{source}</code>
              </pre>
            ) : (
              <div className="flex min-h-[300px] items-center justify-center p-8 text-sm text-muted-foreground">
                Source content is not available.
              </div>
            )}
          </div>

          <div className="hidden overflow-auto border-l border-border bg-card lg:block">
            <div className="space-y-5 p-5">
              <div>
                <p className="text-xs text-muted-foreground">Language</p>
                <p className="mt-1 text-sm font-medium">{file.language}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Lines</p>
                <p className="mt-1 text-sm font-medium">
                  {formatNumber(file.lines)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Imports</p>
                <p className="mt-1 text-sm font-medium">
                  {formatNumber(file.imports)}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Imported by</p>
                <p className="mt-1 text-sm font-medium">
                  {formatNumber(file.importedBy)}
                </p>
              </div>

              {file.dependencies && file.dependencies.length > 0 ? (
                <div>
                  <p className="text-xs font-medium">Dependencies</p>

                  <div className="mt-2 space-y-1">
                    {file.dependencies.map((dependency) => (
                      <div
                        key={dependency}
                        className="truncate rounded-md bg-muted/50 px-2 py-1 font-mono text-[11px]"
                      >
                        {dependency}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {file.dependents && file.dependents.length > 0 ? (
                <div>
                  <p className="text-xs font-medium">Dependents</p>

                  <div className="mt-2 space-y-1">
                    {file.dependents.map((dependent) => (
                      <div
                        key={dependent}
                        className="truncate rounded-md bg-muted/50 px-2 py-1 font-mono text-[11px]"
                      >
                        {dependent}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileCode2 className="h-4 w-4" />
            <span className="hidden sm:inline">
              Source inspection
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
