import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Copy, Download, FileText, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { Link } from "wouter";

type Overview = { projectName: string; repoUrl: string; totalFiles: number; totalModules: number; totalDependencies: number; healthScore: number };
type Documentation = { projectName: string; repoUrl: string; generatedAt: string; mode: "ai-enhanced" | "static-analysis"; model: string | null; markdown: string };

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${url}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
};

function renderMarkdown(text: string) {
  return text.split("\n").map((line, index) => {
    if (line.startsWith("# ")) return <h1 key={index} className="mt-2 mb-4 text-3xl font-extrabold tracking-tight">{line.slice(2)}</h1>;
    if (line.startsWith("## ")) return <h2 key={index} className="mt-8 mb-3 border-b border-border pb-2 text-xl font-bold">{line.slice(3)}</h2>;
    if (line.startsWith("### ")) return <h3 key={index} className="mt-5 mb-2 text-base font-bold">{line.slice(4)}</h3>;
    if (line.startsWith("- ")) return <li key={index} className="ml-5 list-disc py-1 text-sm leading-6 text-muted-foreground">{line.slice(2).split(/(`[^`]+`)/g).map((part, i) => part.startsWith("`") ? <code key={i} className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">{part.slice(1, -1)}</code> : part)}</li>;
    if (!line.trim()) return <div key={index} className="h-2" />;
    return <p key={index} className="text-sm leading-7 text-muted-foreground">{line}</p>;
  });
}

export default function DocumentationGenerator() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [documentation, setDocumentation] = useState<Documentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api<Overview>("/repository/overview").then(setOverview).catch((e) => setError(e instanceof Error ? e.message : "No repository has been analyzed yet.")).finally(() => setLoading(false)); }, []);

  const generate = async () => {
    if (!overview) return;
    setGenerating(true); setError("");
    try { setDocumentation(await api<Documentation>("/repository/documentation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repoUrl: overview.repoUrl }) })); }
    catch (e) { setError(e instanceof Error ? e.message : "Documentation generation failed"); }
    finally { setGenerating(false); }
  };

  const copy = async () => { if (documentation) await navigator.clipboard.writeText(documentation.markdown); };
  const download = () => { if (!documentation) return; const blob = new Blob([documentation.markdown], { type: "text/markdown;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${documentation.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-documentation.md`; a.click(); URL.revokeObjectURL(url); };

  if (loading) return <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">Loading documentation generator…</div>;

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6"><div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4"><div className="flex items-center gap-3"><Link href="/" className="grid size-9 place-items-center rounded-lg border border-border bg-card"><ArrowLeft size={17}/></Link><div><p className="font-extrabold">Repository Documentation</p><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Codebase Intelligence</p></div></div>{overview && <span className="hidden max-w-[360px] truncate rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs sm:block">{overview.projectName}</span>}</div></header>
    <main className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 md:p-8">
      {!overview ? <section className="rounded-2xl border border-border bg-card p-8 text-center"><FileText className="mx-auto mb-4" size={30}/><h1 className="text-2xl font-bold">Analyze a repository first</h1><p className="mt-2 text-sm text-muted-foreground">Return to the workspace and analyze a public GitHub repository.</p><Link href="/" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground">Go to workspace</Link></section> : <>
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-emerald-700"><BookOpen size={13}/> Documentation generator</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Turn the codebase into a developer guide.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">Generate architecture, structure, dependencies, risk findings, hotspots, and a practical onboarding path from the repository's actual scan results.</p></div><button onClick={() => void generate()} disabled={generating} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-xs font-bold text-primary-foreground disabled:opacity-60">{generating ? <LoaderCircle size={15} className="animate-spin"/> : <WandSparkles size={15}/>} {generating ? "Generating…" : "Generate documentation"}</button></div></section>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Files" value={overview.totalFiles}/><Metric label="Modules" value={overview.totalModules}/><Metric label="Dependencies" value={overview.totalDependencies}/><Metric label="Health" value={`${overview.healthScore}/100`}/></section>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
        {documentation && <section className="rounded-2xl border border-border bg-card shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="flex items-center gap-2"><Sparkles size={16}/><span className="font-mono text-[10px] uppercase tracking-widest">{documentation.mode === "ai-enhanced" ? `AI enhanced · ${documentation.model}` : "Static analysis grounded"}</span></div><div className="flex gap-2"><button onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold"><Copy size={14}/> Copy Markdown</button><button onClick={download} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold"><Download size={14}/> Export .md</button></div></div><article className="p-6 md:p-10">{renderMarkdown(documentation.markdown)}</article></section>}
      </>}
    </main>
  </div>;
}
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-border bg-card p-4 shadow-sm"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-2 font-mono text-2xl font-bold">{value}</p></div>; }
