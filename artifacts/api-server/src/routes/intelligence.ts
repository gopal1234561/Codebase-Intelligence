import { Router, type IRouter } from "express";
import {
  GetCodebaseFileParams,
  GetCodebaseFileResponse,
  GetDependencyGraphQueryParams,
  GetDependencyGraphResponse,
  GetIntelligenceOverviewResponse,
  ListCodebaseFilesQueryParams,
  ListCodebaseFilesResponse,
  ListCodebaseRisksResponse,
  ListScanActivityResponse,
  StartCodebaseScanBody,
  StartCodebaseScanResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

type Risk = "high" | "medium" | "low";

const files = [
  {
    path: "artifacts/api-server/src/app.ts",
    name: "app.ts",
    directory: "artifacts/api-server/src",
    language: "TypeScript",
    lines: 34,
    complexity: 4,
    risk: "medium" as Risk,
    riskLabel: "Shared entrypoint",
    summary: "Express application wiring, middleware, and API routing boundary.",
    imports: ["express", "cors", "pino-http", "./routes"],
    importedBy: ["artifacts/api-server/src/index.ts"],
    symbols: ["app"],
    excerpt: 'app.use("/api", router);',
  },
  {
    path: "artifacts/api-server/src/routes/intelligence.ts",
    name: "intelligence.ts",
    directory: "artifacts/api-server/src/routes",
    language: "TypeScript",
    lines: 382,
    complexity: 24,
    risk: "high" as Risk,
    riskLabel: "High fan-out",
    summary: "Codebase intelligence API with overview, graph, file, risk, and activity reads.",
    imports: ["express", "@workspace/api-zod"],
    importedBy: ["artifacts/api-server/src/routes/index.ts"],
    symbols: ["router", "files", "risks", "activity"],
    excerpt: 'router.get("/intelligence/graph", ...)',
  },
  {
    path: "artifacts/api-server/src/routes/index.ts",
    name: "index.ts",
    directory: "artifacts/api-server/src/routes",
    language: "TypeScript",
    lines: 10,
    complexity: 2,
    risk: "low" as Risk,
    riskLabel: "Stable",
    summary: "Composes the API server's domain routers.",
    imports: ["express", "./health", "./intelligence"],
    importedBy: ["artifacts/api-server/src/app.ts"],
    symbols: ["router"],
    excerpt: "router.use(intelligenceRouter);",
  },
  {
    path: "lib/api-spec/openapi.yaml",
    name: "openapi.yaml",
    directory: "lib/api-spec",
    language: "OpenAPI",
    lines: 318,
    complexity: 18,
    risk: "high" as Risk,
    riskLabel: "Contract source",
    summary: "Single source of truth for generated API hooks and validation schemas.",
    imports: [],
    importedBy: ["lib/api-client-react/src/generated/api.ts", "lib/api-zod/src/generated/api.ts"],
    symbols: ["IntelligenceOverview", "DependencyGraph", "CodebaseFile"],
    excerpt: "servers:\\n  - url: /api",
  },
  {
    path: "lib/api-client-react/src/generated/api.ts",
    name: "api.ts",
    directory: "lib/api-client-react/src/generated",
    language: "TypeScript",
    lines: 812,
    complexity: 31,
    risk: "medium" as Risk,
    riskLabel: "Generated",
    summary: "Generated React Query client for the OpenAPI contract.",
    imports: ["@tanstack/react-query", "./api.schemas"],
    importedBy: ["artifacts/codebase-intelligence/src/pages/overview.tsx"],
    symbols: ["useGetIntelligenceOverview", "useGetDependencyGraph", "useStartCodebaseScan"],
    excerpt: "export function useGetIntelligenceOverview(...)",
  },
  {
    path: "artifacts/codebase-intelligence/src/App.tsx",
    name: "App.tsx",
    directory: "artifacts/codebase-intelligence/src",
    language: "TypeScript",
    lines: 64,
    complexity: 8,
    risk: "medium" as Risk,
    riskLabel: "App shell",
    summary: "Routes the intelligence workspace and owns the shared query client.",
    imports: ["react", "@tanstack/react-query", "wouter", "./pages"],
    importedBy: ["artifacts/codebase-intelligence/src/main.tsx"],
    symbols: ["App", "Router", "RoutedErrorBoundary"],
    excerpt: "<QueryClientProvider client={queryClient}>",
  },
  {
    path: "artifacts/codebase-intelligence/src/pages/graph.tsx",
    name: "graph.tsx",
    directory: "artifacts/codebase-intelligence/src/pages",
    language: "TypeScript",
    lines: 246,
    complexity: 20,
    risk: "high" as Risk,
    riskLabel: "Interaction hotspot",
    summary: "Interactive dependency map with grouping, selection, and file detail.",
    imports: ["react", "lucide-react", "@workspace/api-client-react"],
    importedBy: ["artifacts/codebase-intelligence/src/App.tsx"],
    symbols: ["GraphPage", "GraphCanvas", "NodeDetail"],
    excerpt: "const { data: graph } = useGetDependencyGraph(...);",
  },
  {
    path: "lib/db/src/schema/index.ts",
    name: "index.ts",
    directory: "lib/db/src/schema",
    language: "TypeScript",
    lines: 20,
    complexity: 1,
    risk: "low" as Risk,
    riskLabel: "Empty surface",
    summary: "Schema barrel awaiting application-specific persistence models.",
    imports: [],
    importedBy: ["lib/db/src/index.ts"],
    symbols: [],
    excerpt: "export {};",
  },
  {
    path: "artifacts/codebase-intelligence/src/index.css",
    name: "index.css",
    directory: "artifacts/codebase-intelligence/src",
    language: "CSS",
    lines: 433,
    complexity: 12,
    risk: "medium" as Risk,
    riskLabel: "Theme surface",
    summary: "Workspace theme tokens, Tailwind layers, and interaction utilities.",
    imports: ["tailwindcss", "tw-animate-css"],
    importedBy: ["artifacts/codebase-intelligence/src/main.tsx"],
    symbols: [":root", ".dark", "@layer utilities"],
    excerpt: "--primary: hsl(188 86% 42%);",
  },
  {
    path: "replit.md",
    name: "replit.md",
    directory: ".",
    language: "Markdown",
    lines: 45,
    complexity: 2,
    risk: "low" as Risk,
    riskLabel: "Documentation",
    summary: "Project operating notes, architecture conventions, and product pointers.",
    imports: [],
    importedBy: [],
    symbols: [],
    excerpt: "# Codebase Intelligence",
  },
] as const;

const graphNodes = files.map(({ imports, importedBy, symbols, excerpt, summary, riskLabel, ...node }) => node);

const graphEdges = [
  { source: "artifacts/api-server/src/app.ts", target: "artifacts/api-server/src/routes/index.ts", kind: "import" as const },
  { source: "artifacts/api-server/src/routes/index.ts", target: "artifacts/api-server/src/routes/intelligence.ts", kind: "import" as const },
  { source: "artifacts/api-server/src/routes/intelligence.ts", target: "lib/api-zod/src/generated/api.ts", kind: "reference" as const },
  { source: "lib/api-spec/openapi.yaml", target: "lib/api-client-react/src/generated/api.ts", kind: "generated" as const },
  { source: "lib/api-spec/openapi.yaml", target: "lib/api-zod/src/generated/api.ts", kind: "generated" as const },
  { source: "artifacts/codebase-intelligence/src/App.tsx", target: "lib/api-client-react/src/generated/api.ts", kind: "import" as const },
  { source: "artifacts/codebase-intelligence/src/pages/graph.tsx", target: "lib/api-client-react/src/generated/api.ts", kind: "import" as const },
  { source: "artifacts/codebase-intelligence/src/App.tsx", target: "artifacts/codebase-intelligence/src/index.css", kind: "import" as const },
  { source: "artifacts/api-server/src/app.ts", target: "artifacts/api-server/src/index.ts", kind: "reference" as const },
];

const risks = [
  {
    id: "risk-generated-contract",
    severity: "high" as const,
    title: "Generated client depends on an untracked contract change",
    detail: "The OpenAPI file feeds both client and server validation. A stale generated output can make a passing UI call the wrong response shape.",
    file: "lib/api-spec/openapi.yaml",
    impact: "Client/server drift",
    relatedFiles: ["lib/api-client-react/src/generated/api.ts", "lib/api-zod/src/generated/api.ts"],
  },
  {
    id: "risk-graph-hotspot",
    severity: "high" as const,
    title: "Dependency graph page is a high-complexity hotspot",
    detail: "The graph view combines layout, selection state, and file detail. Changes here are likely to affect both navigation and analysis trust signals.",
    file: "artifacts/codebase-intelligence/src/pages/graph.tsx",
    impact: "Interaction regressions",
    relatedFiles: ["artifacts/codebase-intelligence/src/App.tsx", "lib/api-client-react/src/generated/api.ts"],
  },
  {
    id: "risk-static-snapshot",
    severity: "medium" as const,
    title: "The first scan is snapshot-backed",
    detail: "The intelligence endpoints currently serve a curated workspace snapshot while the scanner engine is being staged.",
    file: "artifacts/api-server/src/routes/intelligence.ts",
    impact: "Freshness",
    relatedFiles: ["artifacts/api-server/src/routes/intelligence.ts"],
  },
  {
    id: "risk-schema-surface",
    severity: "medium" as const,
    title: "Persistence layer has no domain tables yet",
    detail: "The database schema barrel is empty, so scan history and user annotations are not persisted between server restarts.",
    file: "lib/db/src/schema/index.ts",
    impact: "Durability",
    relatedFiles: ["lib/db/src/index.ts"],
  },
  {
    id: "risk-theme-tokens",
    severity: "low" as const,
    title: "Theme tokens are shared across the full workspace",
    detail: "The CSS token layer is a broad dependency. Token changes can subtly alter every page and state at once.",
    file: "artifacts/codebase-intelligence/src/index.css",
    impact: "Visual regressions",
    relatedFiles: ["artifacts/codebase-intelligence/src/main.tsx"],
  },
];

let lastScanAt = new Date("2026-09-09T08:18:00.000Z");
let activity = [
  {
    id: "activity-scan",
    title: "Full repository scan completed",
    detail: "10 files mapped across 4 workspace layers",
    timestamp: lastScanAt,
    type: "scan" as const,
  },
  {
    id: "activity-risk",
    title: "Risk cluster identified",
    detail: "Generated contract and graph surface need coordinated changes",
    timestamp: new Date("2026-09-09T07:56:00.000Z"),
    type: "finding" as const,
  },
  {
    id: "activity-dependency",
    title: "Dependency edge added",
    detail: "OpenAPI contract now feeds client and validation output",
    timestamp: new Date("2026-09-09T07:42:00.000Z"),
    type: "dependency" as const,
  },
  {
    id: "activity-system",
    title: "Workspace connected",
    detail: "API server and frontend artifact are responding",
    timestamp: new Date("2026-09-09T07:30:00.000Z"),
    type: "system" as const,
  },
];

router.get("/intelligence/overview", (_req, res): void => {
  const result = GetIntelligenceOverviewResponse.parse({
    projectName: "Codebase Intelligence",
    lastScanAt,
    totalFiles: files.length,
    totalModules: 6,
    totalDependencies: graphEdges.length,
    healthScore: 82,
    riskCount: risks.length,
    languageBreakdown: [
      { language: "TypeScript", files: 7, percentage: 70 },
      { language: "OpenAPI", files: 1, percentage: 10 },
      { language: "CSS", files: 1, percentage: 10 },
      { language: "Markdown", files: 1, percentage: 10 },
    ],
  });
  res.json(result);
});

router.get("/intelligence/graph", (req, res): void => {
  const parsed = GetDependencyGraphQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const groups = parsed.data.groupBy === "layer"
    ? ["Frontend", "API", "Contracts", "Libraries", "Documentation"]
    : ["artifacts/api-server", "artifacts/codebase-intelligence", "lib/api-spec", "lib/api-client-react", "lib/db", "."];

  const result = GetDependencyGraphResponse.parse({
    nodes: graphNodes,
    edges: graphEdges,
    groups,
  });
  res.json(result);
});

router.get("/intelligence/files", (req, res): void => {
  const parsed = ListCodebaseFilesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const search = parsed.data.search?.toLowerCase();
  const filtered = files
    .filter((file) => !search || `${file.path} ${file.summary}`.toLowerCase().includes(search))
    .filter((file) => !parsed.data.language || file.language.toLowerCase() === parsed.data.language.toLowerCase())
    .filter((file) => parsed.data.risk === "all" || file.risk === parsed.data.risk)
    .slice(0, parsed.data.limit)
    .map(({ imports, importedBy, symbols, excerpt, ...file }) => file);

  res.json(ListCodebaseFilesResponse.parse(filtered));
});

router.get("/intelligence/files/*path", (req, res): void => {
  const rawPath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
  const file = files.find((item) => item.path === rawPath);
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const result = GetCodebaseFileResponse.parse(file);
  res.json(result);
});

router.get("/intelligence/risks", (_req, res): void => {
  res.json(ListCodebaseRisksResponse.parse(risks));
});

router.get("/intelligence/activity", (_req, res): void => {
  res.json(ListScanActivityResponse.parse(activity));
});

router.post("/intelligence/scan", (req, res): void => {
  const parsed = StartCodebaseScanBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  lastScanAt = new Date();
  const scanId = `scan-${lastScanAt.getTime()}`;
  activity = [
    {
      id: `activity-${scanId}`,
      title: `${parsed.data.scope[0].toUpperCase()}${parsed.data.scope.slice(1)} scan accepted`,
      detail: "Workspace analysis refresh queued for the connected repository",
      timestamp: lastScanAt,
      type: "scan" as const,
    },
    ...activity,
  ].slice(0, 8);

  const result = StartCodebaseScanResponse.parse({
    scanId,
    acceptedAt: lastScanAt,
    scope: parsed.data.scope,
    status: "accepted",
  });
  res.status(202).json(result);
});

export default router;