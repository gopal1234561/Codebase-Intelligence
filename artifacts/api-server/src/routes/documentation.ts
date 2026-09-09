import { Router, type IRouter } from "express";
import { scanCodebase, type ScanResult } from "../lib/codebase-scanner";

const router: IRouter = Router();

function normalizeRepoUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Repository URL is required.");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Enter a valid GitHub URL."); }
  if (url.protocol !== "https:" || url.hostname !== "github.com") throw new Error("Only public HTTPS GitHub repositories are supported.");
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!match) throw new Error("URL must look like https://github.com/owner/repository");
  return `https://github.com/${match[1]}/${match[2]}`;
}

function buildDocumentation(result: ScanResult) {
  const languages = result.languageBreakdown.map((x) => `${x.language} (${x.files} files, ${x.percentage}%)`).join(", ") || "Not detected";
  const modules = [...new Set(result.files.map((file) => file.directory).filter(Boolean))].sort();
  const risks = result.risks.slice(0, 12).map((risk) => `- **${risk.severity.toUpperCase()}** ${risk.title} — \`${risk.file}\`: ${risk.detail}`).join("\n") || "- No repository risk findings were detected by the current static rules.";
  const hotspots = result.files.slice().sort((a, b) => (b.complexity * 2 + b.lines) - (a.complexity * 2 + a.lines)).slice(0, 10).map((file) => `- \`${file.path}\` — ${file.lines} lines, complexity ${file.complexity}, ${file.imports.length} imports, ${file.importedBy.length} dependents.`).join("\n");
  const dependencies = (result.externalDependencies ?? []).slice(0, 40).map((dep) => `- \`${dep.name}\`${dep.version ? ` — ${dep.version}` : ""}`).join("\n") || "- No external dependencies were detected from supported manifest files.";
  const structure = modules.slice(0, 40).map((module) => `- \`${module || "/"}\``).join("\n") || "- Root-level source files";
  const entrypoints = result.files.filter((file) => /(^|\/)(main|index|app|server|routes?)\.[^.]+$/i.test(file.path) || /package\.json$/i.test(file.path)).slice(0, 12).map((file) => `- \`${file.path}\``).join("\n") || "- No obvious entrypoint detected.";
  return `# ${result.projectName}\n\n## Overview\n\nThis documentation was generated from a fresh read-only scan of the public repository. It describes detected code structure and should not be treated as a substitute for project-specific developer documentation.\n\n- **Files analyzed:** ${result.files.length}\n- **Modules/directories:** ${modules.length}\n- **Internal dependency edges:** ${result.graphEdges.length}\n- **Languages:** ${languages}\n\n## How the repository is organized\n\n### Detected modules\n${structure}\n\n### Likely entry points\n${entrypoints}\n\n## Architecture\n\nThe scanner maps source imports/references as a directed dependency graph. The most connected files are useful starting points when learning the system or tracing changes.\n\n${hotspots || "No hotspots detected."}\n\n## External dependencies\n\n${dependencies}\n\n## Code quality and maintainability\n\nThe repository contains ${result.files.length} analyzed files. Files with higher complexity or size are potential maintenance hotspots and should be reviewed before major changes.\n\n## Risk register\n\n${risks}\n\n## Recommended onboarding path\n\n1. Start with the likely entry points above.\n2. Follow their direct imports in the dependency graph.\n3. Inspect the most connected modules before changing shared code.\n4. Review high-risk findings and large/complex files before production changes.\n5. Run the project's own tests and validation commands after modifications.\n\n## Important limitation\n\nThis page is generated from static repository analysis. It does not execute the application, infer undocumented business requirements, or guarantee that every architectural relationship has been detected.`;
}

async function improveWithOpenAI(base: string, repoName: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.15, messages: [
        { role: "system", content: "You are a senior software architect. Improve the supplied repository documentation without inventing facts. Preserve every concrete metric, file path, dependency, risk, and limitation. You may improve organization and explanations, but only use the supplied evidence." },
        { role: "user", content: `Repository: ${repoName}\n\nGenerated evidence:\n${base}` },
      ] }),
    });
    if (!response.ok) return null;
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return body.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

router.post("/repository/documentation", async (req, res): Promise<void> => {
  try {
    const repoUrl = normalizeRepoUrl(req.body?.repoUrl);
    const result = await scanCodebase(repoUrl);
    const generated = buildDocumentation(result);
    const ai = await improveWithOpenAI(generated, result.projectName);
    res.json({ projectName: result.projectName, repoUrl, generatedAt: new Date().toISOString(), mode: ai ? "ai-enhanced" : "static-analysis", model: ai ? (process.env.OPENAI_MODEL || "gpt-4o-mini") : null, markdown: ai || generated });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Documentation generation failed" });
  }
});

export default router;
