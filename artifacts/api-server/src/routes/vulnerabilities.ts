import { Router, type IRouter } from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();
let lastSnapshot: { scannedAt: string; vulnerable: number; total: number; findings: string[] } | null = null;

function repoFromUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Analyze a repository first.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Invalid repository URL."); }
  if (url.protocol !== "https:" || url.hostname !== "github.com") throw new Error("Only public HTTPS GitHub repositories are supported.");
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error("Repository URL must look like https://github.com/owner/repository");
  return `https://github.com/${match[1]}/${match[2]}`;
}

async function clone(repoUrl: string) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "codebase-vuln-"));
  const root = path.join(temp, "repo");
  try {
    await execFileAsync("git", ["clone", "--depth", "1", "--single-branch", repoUrl, root], { timeout: 120_000, maxBuffer: 1024 * 1024 });
    return { temp, root };
  } catch (error) {
    await fs.rm(temp, { recursive: true, force: true });
    throw new Error(`Unable to clone repository: ${error instanceof Error ? error.message : "git clone failed"}`);
  }
}

type Dependency = { name: string; version: string; ecosystem: string; manifest: string; direct: boolean };
type Finding = { id: string; package: string; version: string; ecosystem: string; severity: "critical" | "high" | "medium" | "low" | "unknown"; summary: string; advisory: string; fixed: string | null; manifest: string; direct: boolean; recommendation: string };

function npmDeps(text: string, manifest: string): Dependency[] {
  const out: Dependency[] = [];
  try {
    const json = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
    for (const [section, direct] of [["dependencies", true], ["devDependencies", false], ["peerDependencies", true], ["optionalDependencies", true]] as const) {
      for (const [name, version] of Object.entries(json[section] ?? {})) out.push({ name, version, ecosystem: "npm", manifest, direct });
    }
  } catch { /* invalid manifests are reported as scan warnings by the UI */ }
  return out;
}

function pythonDeps(text: string, manifest: string): Dependency[] {
  const out: Dependency[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("-") || line.includes(" @ ")) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*(?:==\s*([A-Za-z0-9+_.-]+)|(?:>=|<=|~=|>|<|!=)\s*([A-Za-z0-9+_.-]+))/);
    if (match) out.push({ name: match[1], version: match[2] ?? match[3] ?? "", ecosystem: "PyPI", manifest, direct: true });
  }
  return out;
}

function mavenDeps(text: string, manifest: string): Dependency[] {
  const out: Dependency[] = [];
  const blocks = text.match(/<dependency>[\s\S]*?<\/dependency>/g) ?? [];
  for (const block of blocks) {
    const group = block.match(/<groupId>\s*([^<]+)\s*<\/groupId>/)?.[1]?.trim();
    const name = block.match(/<artifactId>\s*([^<]+)\s*<\/artifactId>/)?.[1]?.trim();
    const version = block.match(/<version>\s*([^<]+)\s*<\/version>/)?.[1]?.trim() ?? "";
    if (name) out.push({ name: group ? `${group}:${name}` : name, version, ecosystem: "Maven", manifest, direct: true });
  }
  return out;
}

function goDeps(text: string, manifest: string): Dependency[] {
  const out: Dependency[] = [];
  for (const match of text.matchAll(/^\s*([^\s()]+)\s+(v[0-9][^\s]*)/gm)) out.push({ name: match[1], version: match[2], ecosystem: "Go", manifest, direct: true });
  return out;
}

function cargoDeps(text: string, manifest: string): Dependency[] {
  const out: Dependency[] = [];
  let active = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[.*dependencies.*\]\s*$/.test(line)) { active = true; continue; }
    if (/^\s*\[/.test(line) && !/dependencies/.test(line)) active = false;
    if (!active) continue;
    const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*(?:["']([^"']+)["']|\{[^}]*version\s*=\s*["']([^"']+)["'])/);
    if (match) out.push({ name: match[1], version: match[2] ?? match[3] ?? "", ecosystem: "crates.io", manifest, direct: true });
  }
  return out;
}

async function readIfExists(root: string, relative: string): Promise<string | null> {
  try { return await fs.readFile(path.join(root, relative), "utf8"); } catch { return null; }
}

async function discoverDependencies(root: string): Promise<Dependency[]> {
  const result: Dependency[] = [];
  const npm = await readIfExists(root, "package.json"); if (npm) result.push(...npmDeps(npm, "package.json"));
  const req = await readIfExists(root, "requirements.txt"); if (req) result.push(...pythonDeps(req, "requirements.txt"));
  const pom = await readIfExists(root, "pom.xml"); if (pom) result.push(...mavenDeps(pom, "pom.xml"));
  const go = await readIfExists(root, "go.mod"); if (go) result.push(...goDeps(go, "go.mod"));
  const cargo = await readIfExists(root, "Cargo.toml"); if (cargo) result.push(...cargoDeps(cargo, "Cargo.toml"));
  return [...new Map(result.map((d) => [`${d.ecosystem}:${d.name}:${d.version}`, d])).values()];
}

function severityOf(vuln: any): Finding["severity"] {
  const database = vuln?.database_specific?.severity;
  if (typeof database === "string") return database.toLowerCase() as Finding["severity"];
  const score = Number(vuln?.severity?.find?.((s: any) => s.type === "CVSS_V3")?.score);
  if (Number.isFinite(score)) return score >= 9 ? "critical" : score >= 7 ? "high" : score >= 4 ? "medium" : "low";
  return "unknown";
}

function versionHint(vuln: any): string | null {
  const ranges = vuln?.affected?.flatMap?.((a: any) => a.ranges ?? []) ?? [];
  for (const range of ranges) for (const event of range.events ?? []) if (event.fixed) return event.fixed;
  return null;
}

async function queryOSV(dependencies: Dependency[]): Promise<Finding[]> {
  if (!dependencies.length) return [];
  const queries = dependencies.map((d) => ({ package: { name: d.name, ecosystem: d.ecosystem }, version: d.version }));
  const response = await fetch("https://api.osv.dev/v1/querybatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queries }) });
  if (!response.ok) throw new Error(`OSV vulnerability service returned ${response.status}`);
  const body = await response.json() as { results?: Array<{ vulns?: any[] }> };
  const findings: Finding[] = [];
  dependencies.forEach((dependency, index) => {
    for (const vuln of body.results?.[index]?.vulns ?? []) {
      const fixed = versionHint(vuln);
      findings.push({
        id: vuln.id,
        package: dependency.name,
        version: dependency.version,
        ecosystem: dependency.ecosystem,
        severity: severityOf(vuln),
        summary: vuln.summary || "Known vulnerability reported by OSV.",
        advisory: `https://osv.dev/vulnerability/${encodeURIComponent(vuln.id)}`,
        fixed,
        manifest: dependency.manifest,
        direct: dependency.direct,
        recommendation: fixed ? `Upgrade ${dependency.name} to ${fixed} or later, then rerun the scan.` : `Review the advisory and upgrade ${dependency.name} to a patched release when available.`,
      });
    }
  });
  return findings;
}

router.get("/repository/vulnerabilities", async (req, res): Promise<void> => {
  const repoUrl = repoFromUrl(req.query.repo);
  let cloned: { temp: string; root: string } | null = null;
  try {
    cloned = await clone(repoUrl);
    const dependencies = await discoverDependencies(cloned.root);
    const findings = await queryOSV(dependencies);
    const scannedAt = new Date().toISOString();
    const vulnerablePackages = new Set(findings.map((f) => `${f.ecosystem}:${f.package}`));
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
    findings.forEach((f) => { severityCounts[f.severity] += 1; });
    const findingIds = findings.map((f) => f.id);
    const previous = lastSnapshot;
    const newFindings = previous ? findings.filter((f) => !previous.findings.includes(f.id)).length : 0;
    const resolvedFindings = previous ? previous.findings.filter((id) => !findingIds.includes(id)).length : 0;
    lastSnapshot = { scannedAt, vulnerable: vulnerablePackages.size, total: dependencies.length, findings: findingIds };
    res.json({
      scannedAt,
      source: "OSV.dev",
      repository: repoUrl,
      dependencies,
      totalDependencies: dependencies.length,
      vulnerablePackages: vulnerablePackages.size,
      totalFindings: findings.length,
      severityCounts,
      findings,
      monitoring: { previousScanAt: previous?.scannedAt ?? null, newFindings, resolvedFindings, status: previous ? (newFindings ? "changed" : "stable") : "baseline" },
      supportedManifests: ["package.json", "requirements.txt", "pom.xml", "go.mod", "Cargo.toml"],
    });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "Dependency vulnerability scan failed" });
  } finally { if (cloned) await fs.rm(cloned.temp, { recursive: true, force: true }); }
});

export default router;
