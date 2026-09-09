import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type Risk = "high" | "medium" | "low";

export type ScannedFile = {
  path: string;
  name: string;
  directory: string;
  language: string;
  lines: number;
  complexity: number;
  risk: Risk;
  riskLabel: string;
  summary: string;
  imports: string[];
  importedBy: string[];
  symbols: string[];
  excerpt: string;
};

export type ScanResult = {
  projectName: string;
  rootPath: string;
  files: ScannedFile[];
  graphEdges: Array<{ source: string; target: string; kind: "import" | "reference" | "generated" }>;
  risks: Array<{
    id: string;
    severity: Risk;
    title: string;
    detail: string;
    file: string;
    impact: string;
    relatedFiles: string[];
  }>;
  languageBreakdown: Array<{ language: string; files: number; percentage: number }>;
};

const EXTENSIONS: Record<string, string> = {
  ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
  ".mjs": "JavaScript", ".cjs": "JavaScript", ".py": "Python", ".java": "Java",
  ".c": "C", ".h": "C/C++", ".cpp": "C++", ".cc": "C++", ".go": "Go", ".rs": "Rust",
  ".php": "PHP", ".rb": "Ruby", ".swift": "Swift", ".kt": "Kotlin", ".css": "CSS",
  ".scss": "SCSS", ".html": "HTML", ".vue": "Vue", ".svelte": "Svelte", ".sql": "SQL",
  ".yaml": "YAML", ".yml": "YAML", ".json": "JSON", ".md": "Markdown", ".txt": "Text",
};

const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", "coverage", ".next", ".nuxt", ".cache", ".turbo", "vendor", "target", "__pycache__"]);
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 1024 * 1024;

function languageFor(file: string): string | null {
  return EXTENSIONS[path.extname(file).toLowerCase()] ?? null;
}

async function collectFiles(root: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(dir: string) {
    if (result.length >= MAX_FILES) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (result.length >= MAX_FILES) return;
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && languageFor(entry.name)) {
        const stat = await fs.stat(absolute);
        if (stat.size <= MAX_FILE_BYTES) result.push(absolute);
      }
    }
  }
  await walk(root);
  return result;
}

function complexityOf(text: string): number {
  const matches = text.match(/\b(if|else if|for|while|case|catch|switch)\b|&&|\|\||\?/g) ?? [];
  return Math.max(1, 1 + matches.length);
}

function symbolsOf(text: string, language: string): string[] {
  const patterns = language === "Python"
    ? [/\b(?:def|class)\s+([A-Za-z_$][\w$]*)/g]
    : [/\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g, /\b(?:class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g, /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g];
  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) if (match[1]) found.add(match[1]);
  }
  return [...found].slice(0, 40);
}

function importsOf(text: string, language: string): string[] {
  const found = new Set<string>();
  if (["TypeScript", "JavaScript", "Vue", "Svelte"].includes(language)) {
    for (const m of text.matchAll(/(?:import\s+(?:[^'";]+?\s+from\s+)?|require\s*\(\s*|import\s*\()(['"])(.*?)\1/g)) found.add(m[2]);
  } else if (language === "Python") {
    for (const m of text.matchAll(/^\s*(?:from|import)\s+([A-Za-z0-9_.$/-]+)/gm)) found.add(m[1]);
  } else if (language === "Java") {
    for (const m of text.matchAll(/^\s*import\s+([^;]+);/gm)) found.add(m[1]);
  } else if (["Go", "Rust", "C", "C/C++", "C++"].includes(language)) {
    for (const m of text.matchAll(/(?:import\s+|#include\s*[<"])([^>"]+)/g)) found.add(m[1]);
  }
  return [...found].slice(0, 80);
}

function resolveImport(importer: string, specifier: string, root: string, known: Set<string>): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(importer), specifier);
  const candidates = [base, ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".java", ".css", ".json"].map((ext) => `${base}${ext}`)];
  candidates.push(...["index.ts", "index.tsx", "index.js", "index.jsx", "index.py"].map((name) => path.join(base, name)));
  for (const candidate of candidates) {
    const rel = path.relative(root, candidate).split(path.sep).join("/");
    if (known.has(rel)) return rel;
  }
  return null;
}

function riskFor(text: string, complexity: number, lines: number): { risk: Risk; label: string } {
  if (/\b(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|PRIVATE KEY|api[_-]?key|secret)\s*[:=]/i.test(text)) return { risk: "high", label: "Potential secret" };
  if (/\beval\s*\(|child_process|exec\s*\(|shell=True|subprocess\.run/i.test(text)) return { risk: "high", label: "Dangerous execution" };
  if (complexity >= 25 || lines >= 800) return { risk: "high", label: "Complexity hotspot" };
  if (/TODO|FIXME|HACK|XXX/.test(text)) return { risk: "medium", label: "Known TODO" };
  if (complexity >= 12 || lines >= 400) return { risk: "medium", label: "High change surface" };
  return { risk: "low", label: "Stable" };
}

function summaryFor(language: string, imports: string[], symbols: string[], lines: number): string {
  if (symbols.length) return `${language} module defining ${symbols.slice(0, 3).join(", ")}${symbols.length > 3 ? " and more" : ""}.`;
  if (imports.length) return `${language} source with ${imports.length} detected dependencies and ${lines} lines.`;
  return `${language} source file containing ${lines} lines.`;
}

async function cloneRepository(repoUrl: string): Promise<{ root: string; cleanup: () => Promise<void>; projectName: string }> {
  let url: URL;
  try { url = new URL(repoUrl); } catch { throw new Error("repoUrl must be a valid HTTPS GitHub URL"); }
  if (url.protocol !== "https:" || url.hostname !== "github.com") throw new Error("Only public HTTPS GitHub repositories are supported");
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error("repoUrl must look like https://github.com/owner/repository");
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "codebase-intelligence-"));
  const target = path.join(temp, "repo");
  try {
    await execFileAsync("git", ["clone", "--depth", "1", "--single-branch", repoUrl, target], { timeout: 120_000, maxBuffer: 1024 * 1024 });
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : "git clone failed";
    throw new Error(`Unable to clone repository: ${message}`);
  }
  return { root: target, cleanup: () => fs.rm(temp, { recursive: true, force: true }), projectName: match[2] };
}

export async function scanCodebase(repoUrl?: string): Promise<ScanResult> {
  const localRoot = process.cwd();
  const source = repoUrl ? await cloneRepository(repoUrl) : { root: localRoot, cleanup: async () => {}, projectName: path.basename(localRoot) };
  try {
    const absoluteFiles = await collectFiles(source.root);
    const relativeFiles = absoluteFiles.map((file) => path.relative(source.root, file).split(path.sep).join("/"));
    const known = new Set(relativeFiles);
    const scanned: ScannedFile[] = [];
    const importsByFile = new Map<string, string[]>();
    for (let i = 0; i < absoluteFiles.length; i++) {
      const absolute = absoluteFiles[i];
      const rel = relativeFiles[i];
      const text = await fs.readFile(absolute, "utf8");
      const language = languageFor(rel) ?? "Unknown";
      const lines = text.length ? text.split(/\r?\n/).length : 0;
      const complexity = complexityOf(text);
      const imports = importsOf(text, language);
      const symbols = symbolsOf(text, language);
      const riskInfo = riskFor(text, complexity, lines);
      const excerpt = text.split(/\r?\n/).find((line) => line.trim() && !line.trim().startsWith("//"))?.trim().slice(0, 240) ?? "";
      scanned.push({ path: rel, name: path.basename(rel), directory: path.posix.dirname(rel) === "." ? "." : path.posix.dirname(rel), language, lines, complexity, ...riskInfo, summary: summaryFor(language, imports, symbols, lines), imports, importedBy: [], symbols, excerpt });
      importsByFile.set(rel, imports);
    }
    const edges: ScanResult["graphEdges"] = [];
    const incoming = new Map<string, string[]>();
    for (const file of scanned) {
      for (const specifier of importsByFile.get(file.path) ?? []) {
        const target = resolveImport(path.join(source.root, file.path), specifier, source.root, known);
        if (!target) continue;
        edges.push({ source: file.path, target, kind: "import" });
        const list = incoming.get(target) ?? [];
        list.push(file.path);
        incoming.set(target, list);
      }
    }
    for (const file of scanned) file.importedBy = incoming.get(file.path) ?? [];

    const risks = scanned.filter((file) => file.risk !== "low").map((file) => ({
      id: `risk-${file.path.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      severity: file.risk,
      title: `${file.riskLabel}: ${file.name}`,
      detail: file.risk === "high" ? "This file contains patterns that deserve immediate review." : "This file has a larger-than-normal change or maintenance surface.",
      file: file.path,
      impact: file.risk === "high" ? "Potential reliability or security issue" : "Maintenance risk",
      relatedFiles: file.importedBy.slice(0, 10),
    }));
    const counts = new Map<string, number>();
    for (const file of scanned) counts.set(file.language, (counts.get(file.language) ?? 0) + 1);
    const total = scanned.length || 1;
    const languageBreakdown = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([language, files]) => ({ language, files, percentage: Math.round((files / total) * 100) }));
    return { projectName: source.projectName, rootPath: source.root, files: scanned, graphEdges: edges, risks, languageBreakdown };
  } finally {
    await source.cleanup();
  }
}
