import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bot, CheckCircle2, Code2, Network, Search, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";

type Risk = "high" | "medium" | "low";
type FileItem = { path: string; name: string; directory: string; language: string; lines: number; complexity: number; risk: Risk; riskLabel: string; summary: string; importsCount: number; importedByCount: number };
type Finding = { id: string; severity: Risk; title: string; detail: string; file: string; impact: string; relatedFiles: string[] };
type Graph = { nodes: Array<{ id: string; label: string; path: string; directory: string; language: string; lines: number; imports: number; importedBy: number; risk: Risk }>; edges: Array<{ source: string; target: string; kind: string }> };
type Overview = { projectName: string; repoUrl: string; scannedAt: string; totalFiles: number; totalModules: number; totalDependencies: number; healthScore: number; riskCount: number; languageBreakdown: Array<{ language: string; files: number; percentage: number }> };

const api = async <T,>(url: string): Promise<T> => {
  const response = await fetch(`/api${url}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
};

export default function IntelligenceCenter() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [risks, setRisks] = useState<Finding[]>([]);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([api<Overview>("/repository/overview"), api<FileItem[]>("/repository/files?limit=5000"), api<Finding[]>("/repository/risks"), api<Graph>("/repository/graph")])
      .then(([o, f, r, g]) => { setOverview(o); setFiles(f); setRisks(r); setGraph(g); })
      .finally(() => setLoading(false));
  }, []);

  const securityFindings = risks.filter((r) => /secret|security|dangerous|credential|key|eval|execution|injection|auth/i.test(`${r.title} ${r.detail}`));
  const technicalDebt = Math.min(100, risks.filter((r) => r.severity === "high").length * 10 + risks.filter((r) => r.severity === "medium").length * 4 + files.filter((f) => f.complexity >= 12 || f.lines >= 400).length * 2);
  const debtScore = 100 - technicalDebt;
  const reviewItems = risks.slice(0, 8);
  const architecture = graph?.nodes.slice().sort((a, b) => b.imports + b.importedBy - a.imports - a.importedBy).slice(0, 10) ?? [];

  const ask = () => {
    const q = question.trim().toLowerCase();
    if (!q) return setAnswer("Ask something about files, dependencies, security, architecture, risks, or technical debt.");
    if (!overview) return setAnswer("Run a repository analysis first from the main dashboard.");
    if (q.includes("security") || q.includes("vulnerab") || q.includes("secret")) return setAnswer(`${securityFindings.length} security-related findings were detected. ${securityFindings.slice(0, 3).map((r) => `${r.title} in ${r.file}`).join("; ") || "No obvious security findings were detected by the current rules."}`);
    if (q.includes("depend") || q.includes("import")) return setAnswer(`${overview.totalDependencies} internal dependency edges were mapped across ${overview.totalModules} modules. ${graph?.edges.slice(0, 3).map((e) => `${e.source} → ${e.target}`).join("; ") || "No dependency edges were found."}`);
    if (q.includes("architecture") || q.includes("structure")) return setAnswer(`The repository contains ${overview.totalModules} modules and ${overview.totalFiles} files. The most connected files are ${architecture.slice(0, 3).map((f) => `${f.path} (${f.imports} imports / ${f.importedBy} dependents)`).join(", ")}.`);
    if (q.includes("debt") || q.includes("maintain")) return setAnswer(`Technical debt score: ${debtScore}/100. ${technicalDebt} weighted debt points come from risk findings and complexity hotspots.`);
    if (q.includes("file") || q.includes("large") || q.includes("complex")) return setAnswer(`The largest/most complex hotspots include ${files.slice().sort((a, b) => b.lines - a.lines).slice(0, 4).map((f) => `${f.path} (${f.lines} lines, complexity ${f.complexity})`).join(", ")}.`);
    return setAnswer(`I found ${files.length} files, ${overview.totalDependencies} dependencies, ${risks.length} findings and a health score of ${overview.healthScore}/100. Try asking about security, dependencies, architecture, files, or technical debt.`);
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">Loading intelligence center…</div>;

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><div className="flex items-center gap-3"><Link href="/" className="grid size-9 place-items-center rounded-lg border border-border bg-card"><ArrowLeft size={17}/></Link><div><p className="font-extrabold">Codebase Intelligence</p><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">AI Insights Center</p></div></div>{overview && <span className="hidden max-w-[360px] truncate rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs sm:block">{overview.projectName}</span>}</div></header>
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 md:p-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"><div className="max-w-4xl"><p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-emerald-700"><Sparkles size={13}/> Codebase Intelligence</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">An AI-powered codebase intelligence platform</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Analyze software architecture, security, code quality, technical debt, and understand the repository through an interactive codebase assistant.</p></div></section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Score label="Health" value={`${overview?.healthScore ?? 0}/100`} icon={<CheckCircle2 size={17}/>} /><Score label="Security" value={`${Math.max(0, 100 - securityFindings.length * 12)}/100`} icon={<ShieldCheck size={17}/>} /><Score label="Code quality" value={`${Math.max(0, 100 - files.filter((f) => f.complexity >= 12).length * 3)}/100`} icon={<Code2 size={17}/>} /><Score label="Technical debt" value={`${debtScore}/100`} icon={<TriangleAlert size={17}/>} /></section>
      <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Bot size={18}/><h2 className="font-bold">Ask your codebase</h2></div><div className="flex gap-2"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Why is authentication risky? Where is the architecture concentrated?" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"/><button onClick={ask} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-xs font-bold text-primary-foreground"><Search size={14}/>Ask</button></div>{answer && <div className="mt-4 rounded-xl border border-border bg-muted/50 p-4 text-sm leading-6">{answer}</div>}<div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="rounded-md bg-muted px-2 py-1">Security</span><span className="rounded-md bg-muted px-2 py-1">Architecture</span><span className="rounded-md bg-muted px-2 py-1">Dependencies</span><span className="rounded-md bg-muted px-2 py-1">Technical debt</span></div></div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><ShieldCheck size={18}/><h2 className="font-bold">Security scanner</h2></div><div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-4xl font-bold">{securityFindings.length}</p><p className="text-xs text-muted-foreground">security-related findings</p></div><span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Automated rules</span></div>{securityFindings.slice(0, 4).map((r) => <div key={r.id} className="border-t border-border py-3"><p className="text-sm font-semibold">{r.title}</p><p className="mt-1 text-xs text-muted-foreground">{r.file}</p></div>)}{securityFindings.length === 0 && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">No security-specific findings detected by the current scanner.</p>}</div>
      </section>
      <section className="grid gap-6 xl:grid-cols-2"><Panel title="AI code review" icon={<Sparkles size={17}/>}><div className="space-y-3">{reviewItems.length ? reviewItems.map((r) => <div key={r.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-sm">{r.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{r.detail}</p></div><Risk risk={r.severity}/></div><p className="mt-2 font-mono text-[10px] text-muted-foreground">{r.file}</p></div>) : <p className="text-sm text-muted-foreground">No review findings yet.</p>}</div></Panel><Panel title="Architecture intelligence" icon={<Network size={17}/>}><div className="mb-4 rounded-xl border border-border bg-muted/30 p-4"><div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">{architecture.slice(0, 6).map((n, i) => <span key={n.id} className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">{n.label}{i < Math.min(architecture.length, 6) - 1 && <span className="ml-2 text-muted-foreground">→</span>}</span>)}</div></div><div className="space-y-2">{architecture.slice(0, 6).map((n) => <div key={n.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2"><span className="truncate text-xs font-semibold">{n.path}</span><span className="font-mono text-[10px] text-muted-foreground">{n.imports} in · {n.importedBy} out</span></div>)}</div></Panel></section>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><TriangleAlert size={17}/><h2 className="font-bold">Technical debt detector</h2><span className="ml-auto font-mono text-sm">{debtScore}/100</span></div><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${debtScore}%` }}/></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Stat label="Complexity hotspots" value={files.filter((f) => f.complexity >= 12).length}/><Stat label="Large files" value={files.filter((f) => f.lines >= 400).length}/><Stat label="Risk findings" value={risks.length}/></div></section>
    </main>
  </div>;
}

function Score({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><span className="text-primary">{icon}</span></div><p className="mt-4 font-mono text-3xl font-bold">{value}</p></div>; }
function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2">{icon}<h2 className="font-bold">{title}</h2></div>{children}</div>; }
function Risk({ risk }: { risk: Risk }) { const c = risk === "high" ? "bg-rose-50 text-rose-700" : risk === "medium" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"; return <span className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase ${c}`}>{risk}</span>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-muted/50 p-3"><p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-mono text-xl font-bold">{value}</p></div>; }
