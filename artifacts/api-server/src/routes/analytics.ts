import { Router, type IRouter } from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

function repoUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("No analyzed repository is available.");
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.hostname !== "github.com") throw new Error("Only public HTTPS GitHub repositories are supported.");
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error("Invalid GitHub repository URL.");
  return `https://github.com/${match[1]}/${match[2]}`;
}

async function clone(repo: string, depth: string): Promise<{ temp: string; root: string }> {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "codebase-intelligence-analytics-"));
  const root = path.join(temp, "repo");
  try {
    await execFileAsync("git", ["clone", "--depth", depth, "--single-branch", repo, root], { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
    return { temp, root };
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true });
    throw new Error(`Unable to inspect repository history: ${error instanceof Error ? error.message : "git clone failed"}`);
  }
}

async function git(root: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", root, ...args], { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
  return result.stdout.trim();
}

router.get("/repository/history", async (req, res): Promise<void> => {
  let cloned: { temp: string; root: string } | null = null;
  try {
    const repo = repoUrl(req.query.repoUrl);
    const depth = Math.min(50, Math.max(10, Number(req.query.limit) || 20));
    cloned = await clone(repo, String(depth));
    const log = await git(cloned.root, ["log", `-${depth}`, "--date=iso-strict", "--pretty=format:%H%x1f%an%x1f%ad%x1f%s"]);
    const commits = log ? log.split("\n").map((line) => {
      const [sha, author, date, subject] = line.split("\x1f");
      return { sha, shortSha: sha.slice(0, 7), author, date, subject };
    }) : [];
    const fileStats = await git(cloned.root, ["log", `-${depth}`, "--format=", "--name-only"]);
    const changedFiles = new Map<string, number>();
    for (const file of fileStats.split("\n").map((v) => v.trim()).filter(Boolean)) changedFiles.set(file, (changedFiles.get(file) ?? 0) + 1);
    res.json({ commits, totalCommits: commits.length, fileChurn: [...changedFiles.entries()].map(([file, changes]) => ({ file, changes })).sort((a, b) => b.changes - a.changes).slice(0, 30) });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "History analysis failed" }); }
  finally { if (cloned) await fs.rm(cloned.temp, { recursive: true, force: true }); }
});

router.get("/repository/hotspots", async (req, res): Promise<void> => {
  let cloned: { temp: string; root: string } | null = null;
  try {
    const repo = repoUrl(req.query.repoUrl);
    cloned = await clone(repo, "30");
    const log = await git(cloned.root, ["log", "-30", "--format=", "--name-only"]);
    const churn = new Map<string, number>();
    for (const file of log.split("\n").map((v) => v.trim()).filter(Boolean)) churn.set(file, (churn.get(file) ?? 0) + 1);
    const candidates = [...churn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 120);
    const hotspots = [];
    for (const [file, changes] of candidates) {
      try {
        const stat = await fs.stat(path.join(cloned.root, file));
        if (stat.size > 1024 * 1024) continue;
        const text = await fs.readFile(path.join(cloned.root, file), "utf8");
        const lines = text ? text.split(/\r?\n/).length : 0;
        const complexity = 1 + (text.match(/\b(if|else if|for|while|case|catch|switch)\b|&&|\|\||\?/g) ?? []).length;
        const score = Math.min(100, Math.round(changes * 5 + Math.min(35, lines / 25) + Math.min(30, complexity)));
        const risk = score >= 70 ? "high" : score >= 45 ? "medium" : "low";
        hotspots.push({ file, changes, lines, complexity, score, risk });
      } catch { /* deleted or unreadable files are skipped */ }
    }
    hotspots.sort((a, b) => b.score - a.score);
    res.json({ window: 30, hotspots: hotspots.slice(0, 30), high: hotspots.filter((h) => h.risk === "high").length, medium: hotspots.filter((h) => h.risk === "medium").length });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Hotspot analysis failed" }); }
  finally { if (cloned) await fs.rm(cloned.temp, { recursive: true, force: true }); }
});

router.get("/repository/drift", async (req, res): Promise<void> => {
  let cloned: { temp: string; root: string } | null = null;
  try {
    const repo = repoUrl(req.query.repoUrl);
    cloned = await clone(repo, "1");
    const files: string[] = [];
    async function walk(dir: string, prefix = "") {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if ([".git", "node_modules", "dist", "build", "coverage", ".next", "vendor", "target", "__pycache__"].includes(entry.name)) continue;
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), relative);
        else if (/\.(ts|tsx|js|jsx|mjs|cjs|py|java|go|rs|php|rb|swift|kt)$/.test(entry.name)) files.push(relative);
      }
    }
    await walk(cloned.root);
    const findings: Array<{ severity: "high" | "medium" | "low"; title: string; detail: string; files: string[] }> = [];
    const frontend = files.filter((f) => /^(src|app|pages|components|frontend)\//.test(f) && /\.(ts|tsx|js|jsx)$/.test(f));
    const backend = files.filter((f) => /^(server|api|backend|services)\//.test(f) && /\.(ts|tsx|js|jsx)$/.test(f));
    if (frontend.length && backend.length) {
      const violations: string[] = [];
      for (const file of frontend.slice(0, 500)) {
        try {
          const text = await fs.readFile(path.join(cloned.root, file), "utf8");
          if (/(?:from|import|require)\s*[('\"](?:\.\.\/)+(?:server|api|backend|services)\//.test(text)) violations.push(file);
        } catch { /* skip */ }
      }
      if (violations.length) findings.push({ severity: "high", title: "UI-to-server boundary drift", detail: "Frontend files directly reference server-side modules. This can couple deployment layers and expose implementation details.", files: violations.slice(0, 10) });
    }
    const rootSource = files.filter((f) => !f.includes("/") && /\.(ts|tsx|js|jsx|py|java|go|rs|php|rb|swift|kt)$/.test(f));
    if (files.length >= 20 && rootSource.length / files.length > 0.2) findings.push({ severity: "medium", title: "Source concentrated at repository root", detail: `${rootSource.length} of ${files.length} source files live at the root. Consider clearer module boundaries as the codebase grows.`, files: rootSource.slice(0, 10) });
    const topDirs = new Map<string, number>();
    for (const file of files) topDirs.set(file.split("/")[0], (topDirs.get(file.split("/")[0]) ?? 0) + 1);
    const dominant = [...topDirs.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominant && files.length >= 30 && dominant[1] / files.length > 0.75) findings.push({ severity: "low", title: "Dominant module boundary", detail: `${dominant[0]}/ contains ${dominant[1]} of ${files.length} source files. Verify that the module boundary still reflects the product architecture.`, files: files.filter((f) => f.startsWith(`${dominant[0]}/`)).slice(0, 10) });
    res.json({ status: findings.length ? "drift_detected" : "aligned", filesAnalyzed: files.length, findings });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Architecture drift analysis failed" }); }
  finally { if (cloned) await fs.rm(cloned.temp, { recursive: true, force: true }); }
});

export default router;
