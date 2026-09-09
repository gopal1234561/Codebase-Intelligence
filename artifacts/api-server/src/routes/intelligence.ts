import { Router, type IRouter } from "express";
import { GetCodebaseFileResponse, GetDependencyGraphQueryParams, GetDependencyGraphResponse, GetIntelligenceOverviewResponse, ListCodebaseFilesQueryParams, ListCodebaseFilesResponse, ListCodebaseRisksResponse, ListScanActivityResponse, StartCodebaseScanBody, StartCodebaseScanResponse } from "@workspace/api-zod";
import { scanCodebase, type ScanResult } from "../lib/codebase-scanner";

const router: IRouter = Router();
let currentScan: ScanResult | null = null;
let lastScanAt = new Date(0);
let activity: Array<{ id: string; title: string; detail: string; timestamp: Date; type: "scan" | "finding" | "dependency" | "system" }> = [];

async function ensureScan(): Promise<ScanResult> {
  if (!currentScan) {
    currentScan = await scanCodebase();
    lastScanAt = new Date();
    activity = [{ id: `activity-${Date.now()}`, title: "Repository scanned", detail: `${currentScan.files.length} files analyzed and dependencies mapped`, timestamp: lastScanAt, type: "scan" }];
  }
  return currentScan;
}

function healthScore(result: ScanResult): number {
  const high = result.risks.filter((r) => r.severity === "high").length;
  const medium = result.risks.filter((r) => r.severity === "medium").length;
  return Math.max(0, Math.min(100, 100 - high * 12 - medium * 4));
}

router.get("/intelligence/overview", async (_req, res): Promise<void> => {
  try {
    const result = await ensureScan();
    const modules = new Set(result.files.map((f) => f.directory));
    res.json(GetIntelligenceOverviewResponse.parse({ projectName: result.projectName, lastScanAt, totalFiles: result.files.length, totalModules: modules.size, totalDependencies: result.graphEdges.length, healthScore: healthScore(result), riskCount: result.risks.length, languageBreakdown: result.languageBreakdown }));
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Scan failed" }); }
});

router.get("/intelligence/graph", async (req, res): Promise<void> => {
  try {
    const parsed = GetDependencyGraphQueryParams.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const result = await ensureScan();
    const groups = parsed.data.groupBy === "layer" ? [...new Set(result.files.map((f) => f.language))] : [...new Set(result.files.map((f) => f.directory))];
    const nodes = result.files.map((f) => ({ id: f.path, label: f.name, path: f.path, directory: f.directory, language: f.language, lines: f.lines, imports: f.imports.length, importedBy: f.importedBy.length, risk: f.risk }));
    res.json(GetDependencyGraphResponse.parse({ nodes, edges: result.graphEdges, groups }));
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Graph scan failed" }); }
});

router.get("/intelligence/files", async (req, res): Promise<void> => {
  try {
    const parsed = ListCodebaseFilesQueryParams.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const result = await ensureScan();
    const search = parsed.data.search?.toLowerCase();
    const files = result.files.filter((f) => !search || `${f.path} ${f.summary}`.toLowerCase().includes(search)).filter((f) => !parsed.data.language || f.language.toLowerCase() === parsed.data.language.toLowerCase()).filter((f) => parsed.data.risk === "all" || f.risk === parsed.data.risk).slice(0, parsed.data.limit);
    res.json(ListCodebaseFilesResponse.parse(files.map(({ imports, importedBy, symbols, excerpt, ...f }) => f)));
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "File scan failed" }); }
});

router.get("/intelligence/files/*path", async (req, res): Promise<void> => {
  try {
    const result = await ensureScan();
    const rawPath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
    const file = result.files.find((f) => f.path === rawPath);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }
    res.json(GetCodebaseFileResponse.parse(file));
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "File lookup failed" }); }
});

router.get("/intelligence/risks", async (_req, res): Promise<void> => {
  try { res.json(ListCodebaseRisksResponse.parse((await ensureScan()).risks)); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Risk scan failed" }); }
});

router.get("/intelligence/activity", (_req, res): void => { res.json(ListScanActivityResponse.parse(activity)); });

router.post("/intelligence/scan", async (req, res): Promise<void> => {
  const parsed = StartCodebaseScanBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const repoUrl = typeof req.body?.repoUrl === "string" ? req.body.repoUrl.trim() : undefined;
  try {
    const result = await scanCodebase(repoUrl);
    currentScan = result;
    lastScanAt = new Date();
    const scanId = `scan-${lastScanAt.getTime()}`;
    activity = [{ id: `activity-${scanId}`, title: "Repository scan completed", detail: `${result.files.length} files analyzed, ${result.graphEdges.length} dependencies mapped`, timestamp: lastScanAt, type: "scan" }, ...result.risks.slice(0, 3).map((risk) => ({ id: `activity-${risk.id}`, title: risk.title, detail: risk.detail, timestamp: lastScanAt, type: "finding" as const }))].slice(0, 10);
    res.status(202).json(StartCodebaseScanResponse.parse({ scanId, acceptedAt: lastScanAt, scope: parsed.data.scope, status: "accepted" }));
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Repository scan failed" }); }
});

export default router;
