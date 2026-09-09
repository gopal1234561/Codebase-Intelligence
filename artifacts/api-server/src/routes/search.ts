import { Router, type IRouter } from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_RESULTS = 100;

function normalizeRepoUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("No repository is currently analyzed.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Invalid repository URL."); }
  if (url.protocol !== "https:" || url.hostname !== "github.com") throw new Error("Only public HTTPS GitHub repositories are supported.");
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error("Invalid GitHub repository URL.");
  return `https://github.com/${match[1]}/${match[2]}`;
}

async function cloneRepository(repoUrl: string) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "codebase-intelligence-search-"));
  const root = path.join(temp, "repo");
  try {
    await execFileAsync("git", ["clone", "--depth", "1", "--single-branch", repoUrl, root], { timeout: 120_000, maxBuffer: 1024 * 1024 });
    return { temp, root };
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true });
    throw new Error(`Unable to open repository for search: ${error instanceof Error ? error.message : "git clone failed"}`);
  }
}

const IGNORED = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".nuxt", ".cache", ".turbo", "vendor", "target", "__pycache__"]);
const TEXT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java", ".c", ".h", ".cpp", ".cc", ".go", ".rs", ".php", ".rb", ".swift", ".kt", ".css", ".scss", ".html", ".vue", ".svelte", ".sql", ".yaml", ".yml", ".json", ".md", ".txt"]);

async function collectFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(dir: string) {
    if (result.length >= 5000) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (result.length >= 5000) return;
      if (entry.isDirectory() && IGNORED.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const stat = await fs.stat(absolute);
        if (stat.size <= MAX_FILE_BYTES) result.push(absolute);
      }
    }
  }
  await walk(root);
  return result;
}

function languageFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const names: Record<string, string> = { ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript", ".py": "Python", ".java": "Java", ".c": "C", ".h": "C/C++", ".cpp": "C++", ".go": "Go", ".rs": "Rust", ".php": "PHP", ".rb": "Ruby", ".swift": "Swift", ".kt": "Kotlin", ".css": "CSS", ".scss": "SCSS", ".html": "HTML", ".vue": "Vue", ".svelte": "Svelte", ".sql": "SQL", ".yaml": "YAML", ".yml": "YAML", ".json": "JSON", ".md": "Markdown", ".txt": "Text" };
  return names[ext] ?? "Source";
}

function snippet(line: string, query: string): string {
  const clean = line.trim();
  const index = clean.toLowerCase().indexOf(query.toLowerCase());
  if (clean.length <= 180) return clean;
  if (index < 70) return `${clean.slice(0, 150)}…`;
  return `…${clean.slice(Math.max(0, index - 65), index + 115)}…`;
}

router.get("/repository/search", async (req, res): Promise<void> => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) { res.json({ query: "", total: 0, results: [] }); return; }
  if (query.length > 120) { res.status(400).json({ error: "Search query is too long." }); return; }
  const repoUrl = normalizeRepoUrl(req.query.repoUrl);
  const limit = Math.min(MAX_RESULTS, Math.max(1, Number(req.query.limit) || 50));
  let cloned: { temp: string; root: string } | null = null;
  try {
    cloned = await cloneRepository(repoUrl);
    const files = await collectFiles(cloned.root);
    const lowerQuery = query.toLowerCase();
    const results: Array<{ file: string; line: number; language: string; snippet: string; matchType: "content" | "path" }> = [];

    for (const absolute of files) {
      if (results.length >= limit) break;
      const relative = path.relative(cloned.root, absolute).split(path.sep).join("/");
      const pathMatch = relative.toLowerCase().includes(lowerQuery);
      let content = "";
      try { content = await fs.readFile(absolute, "utf8"); } catch { continue; }
      const lines = content.split(/\r?\n/);
      if (pathMatch) results.push({ file: relative, line: 1, language: languageFor(relative), snippet: `Path match: ${relative}`, matchType: "path" });
      for (let index = 0; index < lines.length && results.length < limit; index += 1) {
        if (lines[index].toLowerCase().includes(lowerQuery)) results.push({ file: relative, line: index + 1, language: languageFor(relative), snippet: snippet(lines[index], query), matchType: "content" });
      }
    }
    res.json({ query, total: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Repository search failed" });
  } finally {
    if (cloned) await fs.rm(cloned.temp, { recursive: true, force: true });
  }
});

export default router;
