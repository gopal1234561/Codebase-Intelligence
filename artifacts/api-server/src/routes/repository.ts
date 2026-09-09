import { Router, type IRouter } from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { scanCodebase, type ScanResult } from "../lib/codebase-scanner";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
let currentScan: ScanResult | null = null;
let currentRepoUrl = "";
let scannedAt = new Date(0);
let activity: Array<{ id: string; title: string; detail: string; timestamp: string; type: "scan" | "finding" | "dependency" | "system" }> = [];

function normalizeRepoUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Enter a public GitHub repository URL.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Enter a valid GitHub URL."); }
  if (url.protocol !== "https:" || url.hostname !== "github.com") throw new Error("Only public HTTPS GitHub repositories are supported.");
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error("URL must look like https://github.com/owner/repository");
  return `https://github.com/${match[1]}/${match[2]}`;
}

function healthScore(result: ScanResult): { score: number; label: string; highFindings: number; mediumFindings: number; lowFindings: number } {
  const highFindings = result.risks.filter((risk) => risk.severity === "high").length;
  const mediumFindings = result.risks.filter((risk) => risk.severity === "medium").length;
  const lowFindings = result.risks.filter((risk) => risk.severity === "low").length;
  const fileCount = Math.max(1, result.files.length);
  const densityPenalty = Math.min(35, (highFindings / fileCount) * 180 + (mediumFindings / fileCount) * 55 + (lowFindings / fileCount) * 15);
  const volumePenalty = Math.min(40, highFindings * 5 + mediumFindings * 1.5 + lowFindings * 0.5);
  const score = Math.round(Math.max(0, Math.min(100, 100 - Math.min(75, densityPenalty * 0.65 + volumePenalty * 0.35))));
  const label = score >= 85 ? "Excellent" : score >= 70 ? "Healthy" : score >= 50 ? "Needs attention" : "Critical";
  return { score, label, highFindings, mediumFindings, lowFindings };
}

async function cloneForFile(repoUrl: string) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "codebase-intelligence-file-"));
  const root = path.join(temp, "repo");
  try {
    await execFileAsync("git", ["clone", "--depth", "1", "--single-branch", repoUrl, root], { timeout: 120_000, maxBuffer: 1024 * 1024 });
    return { temp, root };
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true });
    throw new Error(`Unable to open repository file: ${error instanceof Error ? error.message : "git clone failed"}`);
  }
}

async function runRepositoryScan(repoUrl: string) {
  const result = await scanCodebase(repoUrl);
  currentScan = result;
  currentRepoUrl = repoUrl;
  scannedAt = new Date();
  activity = [
    { id: `scan-${Date.now()}`, title: "Repository scan completed", detail: `${result.files.length} files analyzed and ${result.graphEdges.length} internal dependencies mapped`, timestamp: scannedAt.toISOString(), type: "scan" },
    ...result.risks.slice(0, 4).map((risk) => ({ id: risk.id, title: risk.title, detail: risk.detail, timestamp: scannedAt.toISOString(), type: "finding" as const })),
  ].slice(0, 10);
  return result;
}

router.post("/repository/scan", async (req, res): Promise<void> => {
  try {
    const repoUrl = normalizeRepoUrl(req.body?.repoUrl);
    const result = await runRepositoryScan(repoUrl);
    res.status(200).json({ status: "completed", projectName: result.projectName, repoUrl, scannedAt });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Repository scan failed" }); }
});

router.get("/repository/overview", (_req, res): void => {
  if (!currentScan) { res.status(404).json({ error: "No repository scanned yet" }); return; }
  const modules = new Set(currentScan.files.map((file) => file.directory));
  const health = healthScore(currentScan);
  const externalDependencies = currentScan.externalDependencies?.length ?? 0;
  res.json({ projectName: currentScan.projectName, repoUrl: currentRepoUrl, scannedAt, totalFiles: currentScan.files.length, totalModules: modules.size, totalDependencies: currentScan.graphEdges.length, internalDependencies: currentScan.graphEdges.length, externalDependencies, healthScore: health.score, healthLabel: health.label, healthBreakdown: { highFindings: health.highFindings, mediumFindings: health.mediumFindings, lowFindings: health.lowFindings }, riskCount: currentScan.risks.length, languageBreakdown: currentScan.languageBreakdown });
});

router.get("/repository/files", (req, res): void => {
  if (!currentScan) { res.status(404).json({ error: "No repository scanned yet" }); return; }
  const search = typeof req.query.search === "string" ? req.query.search.toLowerCase() : "";
  const language = typeof req.query.language === "string" ? req.query.language.toLowerCase() : "";
  const risk = typeof req.query.risk === "string" ? req.query.risk.toLowerCase() : "all";
  const limit = Math.min(5000, Math.max(1, Number(req.query.limit) || 5000));
  const files = currentScan.files.filter((file) => !search || `${file.path} ${file.summary} ${file.symbols.join(" ")}`.toLowerCase().includes(search)).filter((file) => !language || file.language.toLowerCase() === language).filter((file) => risk === "all" || file.risk === risk).slice(0, limit);
  res.json(files.map(({ imports, importedBy, symbols, ...file }) => ({ ...file, importsCount: imports.length, importedByCount: importedBy.length })));
});

router.get("/repository/file/*path", async (req, res): Promise<void> => {
  if (!currentScan || !currentRepoUrl) { res.status(404).json({ error: "No repository scanned yet" }); return; }
  const rawPath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path;
  const filePath = rawPath.split("/").filter(Boolean).join("/");
  const known = currentScan.files.find((file) => file.path === filePath);
  if (!known) { res.status(404).json({ error: "File not found in the scanned repository" }); return; }
  if (filePath.includes("..")) { res.status(400).json({ error: "Invalid file path" }); return; }
  let cloned: { temp: string; root: string } | null = null;
  try {
    cloned = await cloneForFile(currentRepoUrl);
    const absolute = path.resolve(cloned.root, filePath);
    if (!absolute.startsWith(path.resolve(cloned.root) + path.sep)) { res.status(400).json({ error: "Invalid file path" }); return; }
    const stat = await fs.stat(absolute);
    if (stat.size > 1024 * 1024) { res.status(413).json({ error: "File is larger than the 1 MB display limit" }); return; }
    const content = await fs.readFile(absolute, "utf8");
    res.json({ ...known, content });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Could not open file" }); }
  finally { if (cloned) await fs.rm(cloned.temp, { recursive: true, force: true }); }
});

router.get("/repository/graph", (_req, res): void => {
  if (!currentScan) { res.status(404).json({ error: "No repository scanned yet" }); return; }
  res.json({ nodes: currentScan.files.map((file) => ({ id: file.path, label: file.name, path: file.path, directory: file.directory, language: file.language, lines: file.lines, imports: file.imports.length, importedBy: file.importedBy.length, risk: file.risk })), edges: currentScan.graphEdges, groups: [...new Set(currentScan.files.map((file) => file.directory))] });
});

router.get("/repository/risks", (_req, res): void => {
  if (!currentScan) { res.status(404).json({ error: "No repository scanned yet" }); return; }
  res.json(currentScan.risks);
});

router.get("/repository/security", async (_req, res): Promise<void> => {
  if (!currentScan || !currentRepoUrl) { res.status(404).json({ error: "No repository scanned yet" }); return; }
  let cloned: { temp: string; root: string } | null = null;
  const rules = [
    { id: "hardcoded-credential", title: "Hardcoded credential", severity: "high" as const, pattern: /\b(?:api[_-]?key|secret|password|passwd|token|access[_-]?token|private[_-]?key)\s*[:=]\s*["'`][^"'`\n]{4,}["'`]/i },
    { id: "aws-access-key", title: "AWS access key pattern", severity: "high" as const, pattern: /\bAKIA[0-9A-Z]{16}\b/ },
    { id: "jwt-token", title: "JWT-like token", severity: "high" as const, pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
    { id: "credential-url", title: "Credential embedded in URL", severity: "high" as const, pattern: /\b(?:https?|postgres(?:ql)?|mysql):\/\/[^\s/@]+:[^\s/@]+@/i },
    { id: "dangerous-eval", title: "Dynamic code execution", severity: "medium" as const, pattern: /\beval\s*\(/i },
    { id: "shell-execution", title: "Shell/command execution", severity: "medium" as const, pattern: /\b(?:child_process\.(?:exec|execFile|spawn)|os\.system|subprocess\.(?:run|Popen|call)|shell\s*=\s*True)\b/i },
    { id: "insecure-http", title: "Insecure HTTP endpoint", severity: "low" as const, pattern: /\bhttp:\/\/(?!localhost\b|127\.0\.0\.1\b|example\.com\b)/i },
  ];
  const findings: Array<{ id: string; severity: "high" | "medium" | "low"; title: string; rule: string; file: string; line: number; detail: string }> = [];
  let filesScanned = 0;
  try {
    cloned = await cloneForFile(currentRepoUrl);
    for (const file of currentScan.files) {
      const absolute = path.resolve(cloned.root, file.path);
      if (!absolute.startsWith(path.resolve(cloned.root) + path.sep)) continue;
      try {
        const stat = await fs.stat(absolute);
        if (stat.size > 1024 * 1024) continue;
        const content = await fs.readFile(absolute, "utf8");
        filesScanned += 1;
        const lines = content.split(/\r?\n/);
        for (const rule of rules) {
          const matchIndex = lines.findIndex((line) => rule.pattern.test(line));
          rule.pattern.lastIndex = 0;
          if (matchIndex >= 0) findings.push({ id: `${rule.id}-${file.path}`, severity: rule.severity, title: rule.title, rule: rule.id, file: file.path, line: matchIndex + 1, detail: `${rule.title} matched by the current static rule set.` });
        }
      } catch { /* unreadable files are skipped */ }
    }
    const high = findings.filter((f) => f.severity === "high").length;
    const medium = findings.filter((f) => f.severity === "medium").length;
    const low = findings.filter((f) => f.severity === "low").length;
    const score = findings.length ? Math.max(0, 100 - high * 20 - medium * 8 - low * 3) : null;
    res.json({ score, status: findings.length ? "findings" : "no_findings", filesScanned, rulesScanned: rules.length, findings, counts: { high, medium, low, total: findings.length }, scannedAt: scannedAt.toISOString() });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Security scan failed" }); }
  finally { if (cloned) await fs.rm(cloned.temp, { recursive: true, force: true }); }
});

router.get("/repository/activity", (_req, res): void => { res.json(activity); });
export default router;
