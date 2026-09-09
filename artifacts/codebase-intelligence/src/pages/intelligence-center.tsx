import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bot, CheckCircle2, Code2, Network, Search, ShieldCheck, Sparkles, TriangleAlert, FileCode2 } from "lucide-react";

type Risk = "high" | "medium" | "low";
type FileItem = { path: string; name: string; directory: string; language: string; lines: number; complexity: number; risk: Risk; riskLabel: string; summary: string; importsCount: number; importedByCount: number };
type Finding = { id: string; severity: Risk; title: string; detail: string; file: string; impact: string; relatedFiles: string[] };
type Graph = { nodes: Array<{ id: string; label: string; path: string; directory: string; language: string; lines: number; imports: number; importedBy: number; risk: Risk }>; edges: Array<{ source: string; target: string; kind: string }> };
type Overview = { projectName: string; repoUrl: string; scannedAt: string; totalFiles: number; totalModules: number; totalDependencies: number; healthScore: number; riskCount: number; languageBreakdown: Array<{ language: string; files: number; percentage: number }> };
type SecurityFinding = { id: string; severity: Risk; title: string; rule: string; file: string; line: number; detail: string };
type SecurityReport = { score: number | null; status: "findings" | "no_findings"; filesScanned: number; rulesScanned: number; findings: SecurityFinding[]; counts: { high: number; medium: number; low: number; total: number }; scannedAt: string };
type AskSource = { file: string; startLine: number; endLine: number; score: number };
type AskResponse = { answer: string; mode: "rag-llm" | "retrieval"; model: string | null; sources: AskSource[] };

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${url}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
};

export default function IntelligenceCenter() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [risks, setRisks] = useState<Finding[]>([]);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [security, setSecurity] = useState<SecurityReport | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([api<Overview>("/repository/overview"), api<FileItem[]>("/repository/files?limit=5000"), api<Finding[]>("/repository/risks"), api<Graph>("/repository/graph"), api<SecurityReport>("/repository/security")])
      .then(([o, f, r, g, s]) => { setOverview(o); setFiles(f); setRisks(r); setGraph(g); setSecurity(s); })
      .finally(() => setLoading(false));
  }, []);

  const securityFindings = security?.findings ?? [];
  const technicalDebt = Math.min(100, risks.filter((r) => r.severity === "high").length * 10 + risks.filter((r) => r.severity === "medium").length * 4 + files.filter((f) => f.complexity >= 12 || f.lines >= 400).length * 2);
  const debtScore = 100 - technicalDebt;
  const reviewItems = risks.slice(0, 8);
  const architecture = graph?.nodes.slice().sort((a, b) => b.imports + b.importedBy - a.imports - a.importedBy).slice(0, 10) ?? [];

  const ask = async () => {
    const q = question.trim();
    if (!q) return;
    setAsking(true); setAskError(""); setAnswer(null);
    try {
      setAnswer(await api<AskResponse>("/repository/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) }));
    } catch (error) { setAskError(error instanceof Error ? error.message : "Could not answer the question."); }
    finally { setAsking(false); }
  };

  if (loading) return <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">Loading intelligence center…</div>;

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><div className="flex items-center gap-3"><Link href="/" className="grid size-9 place-items-center rounded-lg border border-border bg-card"><ArrowLeft size={17}/></Link><div><p className="font-extrabold">Codebase Intelligence</p><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">AI Insights Center</p></div></div>{overview && <span className="hidden max-w-[360px] truncate rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs sm:block">{overview.projectName}</span>}</div></header>
    <main className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 md:p-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"><div className="max-w-4xl"><p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.2em] text-emerald-700"><Sparkles size={13}/> Codebase Intelligence</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">An AI-powered codebase intelligence platform</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">Analyze software architecture, security, code quality, technical debt, and understand the repository through an evidence-grounded codebase assistant.</p></div></section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Score label="Health" value={`${overview?.healthScore ?? 0}/100`} icon={<CheckCircle2 size={17}/>} /><Score label="Security" value={security?.score == null ? "No findings" : `${security.score}/100`} icon={<ShieldCheck size={17}/>} /><Score label="Code quality" value={`${Math.max(0, 100 - files.filter((f) => f.complexity >= 12).length * 3)}/100`} icon={<Code2 size={17}/>} /><Score label="Technical debt" value={`${debtScore}/100`} icon={<TriangleAlert size={17}/>} /></section>
      <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><Bot size={18}/><div><h2 className="font-bold">Ask your codebase</h2><p className="text-[11px] text-muted-foreground">Retrieve relevant source sections and ground the answer in repository evidence.</p></div></div><div className="flex gap-2"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void ask()} placeholder="Where is authentication handled? Why is this module risky?" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"/><button disabled={asking} onClick={() => void ask()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-60"><Search size={14}/>{asking ? "Searching…" : "Ask"}</button></div>{askError && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{askError}</div>}{answer && <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-md bg-background px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{answer.mode === "rag-llm" ? `RAG · ${answer.model}` : "Retrieved evidence"}</span><span className="text-[10px] text-muted-foreground">{answer.sources.length} sources</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{answer.answer}</p>{answer.sources.length > 0 && <div className="mt-4 space-y-2 border-t border-border pt-3"><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Retrieved source sections</p>{answer.sources.map((source) => <div key={`${source.file}:${source.startLine}`} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"><FileCode2 size={14} className="shrink-0 text-primary"/><span className="min-w-0 flex-1 truncate font-mono text-[11px]">{source.file}</span><span className="shrink-0 font-mono text-[10px] text-muted-foreground">L{source.startLine}–{source.endLine}</span></div>)}</div>}</div>}<div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><button onClick={() => setQuestion("Where is authentication handled?")} className="rounded-md bg-muted px-2 py-1 hover:bg-muted/70">Authentication</button><button onClick={() => setQuestion("Which files have the most dependencies?")} className="rounded-md bg-muted px-2 py-1 hover:bg-muted/70">Dependencies</button><button onClick={() => setQuestion("Which parts of the architecture are most connected?")} className="rounded-md bg-muted px-2 py-1 hover:bg-muted/70">Architecture</button><button onClick={() => setQuestion("Which files contribute most to technical debt?")} className="rounded-md bg-muted px-2 py-1 hover:bg-muted/70">Technical debt</button></div></div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="mb-4 flex items-center gap-2"><ShieldCheck size={18}/><h2 className="font-bold">Security scanner</h2></div><div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-4xl font-bold">{securityFindings.length}</p><p className="text-xs text-muted-foreground">security findings</p></div><span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{security?.filesScanned ?? 0} files · {security?.rulesScanned ?? 0} rules</span></div>{securityFindings.slice(0, 4).map((r) => <div key={r.id} className="border-t border-border py-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{r.title}</p><Risk risk={r.severity}/></div><p className="mt-1 text-xs text-muted-foreground">{r.file}:{r.line} · {r.rule}</p></div>)}{securityFindings.length === 0 && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><p className="font-semibold">No findings detected</p><p className="mt-1 text-xs">This means the current {security?.rulesScanned ?? 0} static rules found nothing in {security?.filesScanned ?? 0} scanned files. It is not a guarantee that the repository is vulnerability-free.</p></div>}</div>
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
