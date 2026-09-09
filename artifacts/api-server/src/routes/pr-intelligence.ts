import { Router, type IRouter } from "express";

const router: IRouter = Router();

function repoFromUrl(value: string) {
  const match = value.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error("Only public GitHub repository URLs are supported.");
  return `${match[1]}/${match[2]}`;
}

router.get("/repository/pr-intelligence", async (req, res): Promise<void> => {
  try {
    const repoUrl = typeof req.query.repo === "string" ? req.query.repo : "";
    const prNumber = Number(req.query.pr);
    if (!repoUrl) { res.status(400).json({ error: "Provide the repository URL." }); return; }
    if (!Number.isInteger(prNumber) || prNumber < 1) { res.status(400).json({ error: "Provide a valid PR number." }); return; }
    const repo = repoFromUrl(repoUrl);
    const headers = { Accept: "application/vnd.github+json", "User-Agent": "Codebase-Intelligence" };
    const pullResponse = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
    if (!pullResponse.ok) { res.status(pullResponse.status === 404 ? 404 : 502).json({ error: pullResponse.status === 404 ? "Pull request not found." : "GitHub PR request failed." }); return; }
    const pull = await pullResponse.json() as any;
    const filesResponse = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/files?per_page=100`, { headers });
    const files = filesResponse.ok ? await filesResponse.json() as Array<{filename:string;status:string;additions:number;deletions:number;changes:number}> : [];
    const changedPaths = files.map((f) => f.filename);
    const directories = [...new Set(changedPaths.map((p) => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "root"))];
    const largeChange = pull.additions + pull.deletions > 500;
    const riskScore = Math.min(100, pull.changed_files * 8 + (largeChange ? 25 : 0) + directories.length * 2);
    const riskLevel = riskScore >= 70 ? "high" : riskScore >= 35 ? "medium" : "low";
    const recommendations = [
      ...(riskLevel === "high" ? ["Review this PR before merge because its change surface is high."] : []),
      ...(largeChange ? ["Split or review the large change set carefully."] : []),
      ...(files.some((f) => /test|spec/i.test(f.filename)) ? [] : ["Run or add tests covering the changed modules."]),
      "Inspect connected dependencies in Dependency Graph and Impact Analysis."
    ];
    res.json({ pullRequest: { number: pull.number, title: pull.title, body: pull.body, state: pull.state, url: pull.html_url, author: pull.user?.login || "unknown", base: pull.base?.ref, head: pull.head?.ref, mergeable: pull.mergeable }, stats: { changedFiles: pull.changed_files, additions: pull.additions, deletions: pull.deletions, directories: directories.length }, risk: { score: riskScore, level: riskLevel }, changedFiles: files, changedPaths, recommendations });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "PR intelligence failed" }); }
});

export default router;
