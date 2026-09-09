import { Router, type IRouter } from "express";
import { currentScanState } from "./repository-state";

const router: IRouter = Router();

function normalizeRepo(value: string) {
  const match = value.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error("Only public GitHub repository URLs are supported.");
  return `${match[1]}/${match[2]}`;
}

router.get("/repository/pr-intelligence", async (req, res): Promise<void> => {
  try {
    const state = currentScanState();
    if (!state.repoUrl || !state.scan) { res.status(404).json({ error: "No repository scanned yet" }); return; }
    const repo = normalizeRepo(state.repoUrl);
    const pr = Number(req.query.pr);
    if (!Number.isInteger(pr) || pr < 1) { res.status(400).json({ error: "Provide a valid PR number, for example ?pr=12" }); return; }
    const response = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Codebase-Intelligence" } });
    if (!response.ok) { res.status(response.status === 404 ? 404 : 502).json({ error: response.status === 404 ? "Pull request not found" : "GitHub PR request failed" }); return; }
    const pull = await response.json() as { number:number; title:string; body:string|null; state:string; html_url:string; user?:{login:string}; additions:number; deletions:number; changed_files:number; base?:{ref:string}; head?:{ref:string}; mergeable?:boolean|null };
    const filesResponse = await fetch(`https://api.github.com/repos/${repo}/pulls/${pr}/files?per_page=100`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Codebase-Intelligence" } });
    const files = filesResponse.ok ? await filesResponse.json() as Array<{filename:string;status:string;additions:number;deletions:number;changes:number}> : [];
    const graph = state.scan.graphEdges;
    const changed = new Set(files.map((file) => file.filename));
    const affected = new Set<string>();
    for (const edge of graph) {
      if (changed.has(edge.source)) affected.add(edge.target);
      if (changed.has(edge.target)) affected.add(edge.source);
    }
    const risk = Math.min(100, (pull.changed_files * 6) + (pull.deletions + pull.additions > 500 ? 25 : 0) + (affected.size * 3));
    const riskLevel = risk >= 70 ? "high" : risk >= 35 ? "medium" : "low";
    res.json({
      pullRequest: { number: pull.number, title: pull.title, body: pull.body, state: pull.state, url: pull.html_url, author: pull.user?.login || "unknown", base: pull.base?.ref, head: pull.head?.ref, mergeable: pull.mergeable },
      stats: { changedFiles: pull.changed_files, additions: pull.additions, deletions: pull.deletions, affectedFiles: affected.size },
      risk: { score: risk, level: riskLevel },
      changedFiles: files.map((file) => ({ ...file, affected: affected.has(file.filename) })),
      impactedFiles: [...affected].slice(0, 100),
      recommendations: [
        ...(riskLevel === "high" ? ["Review the high-impact changes before merging."] : []),
        ...(affected.size ? [`Inspect ${Math.min(affected.size, 100)} connected files for downstream effects.`] : ["No connected files were detected from the current dependency graph."]),
        ...(files.some((file) => /test|spec/i.test(file.filename)) ? [] : ["Run or add tests covering the changed modules."]),
        "Use the Impact Analysis view to inspect dependency paths for critical files."
      ]
    });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "PR intelligence failed" }); }
});

export default router;
