import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, ExternalLink, FileCode2, GitBranch, LoaderCircle, Network, RefreshCw, Search, ShieldAlert, Sparkles, X } from "lucide-react";

type Risk = "high" | "medium" | "low";
type FileItem = { path: string; name: string; directory: string; language: string; lines: number; complexity: number; risk: Risk; riskLabel: string; summary: string; importsCount: number; importedByCount: number };
type Overview = { projectName: string; repoUrl: string; scannedAt: string; totalFiles: number; totalModules: number; totalDependencies: number; healthScore: number; riskCount: number; languageBreakdown: Array<{ language: string; files: number; percentage: number }> };
type Detail = FileItem & { imports: string[]; importedBy: string[]; symbols: string[]; excerpt: string; content: string };
type Graph = { nodes: Array<{ id: string; label: string; path: string; directory: string; language: string; lines: number; imports: number; importedBy: number; risk: Risk }>; edges: Array<{ source: string; target: string; kind: string }> };
type Finding = { id: string; severity: Risk; title: string; detail: string; file: string; impact: string; relatedFiles: string[] };
type EventItem = { id: string; title: string; detail: string; timestamp: string; type: string };

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${url}`, { headers: { "Content-Type": "application/json" }, ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
};

function RiskBadge({ risk }: { risk: Risk }) {
  const styles = { high: "border-rose-200 bg-rose-50 text-rose-700", medium: "border-amber-200 bg-amber-50 text-amber-700", low: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  return <span className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${styles[risk]}`}>{risk}</span>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-4 font-mono text-3xl tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center"><AlertTriangle className="mx-auto mb-3 text-rose-600" size={24} /><p className="font-semibold text-rose-900">We could not load this analysis</p><p className="mx-auto mt-2 max-w-xl text-sm text-rose-700">{message}</p>{onRetry && <button onClick={onRetry} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white">Try again</button>}</div>;
}

export default function RepositoryDashboard() {
  const [location, navigate] = useLocation();
  const [repoUrl, setRepoUrl] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [risks, setRisks] = useState<Finding[]>([]);
  const [activity, setActivity] = useState<EventItem[]>([]);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [selectedFile, setSelectedFile] = useState<Detail | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const refresh = async () => {
    setError("");
    if (!overview) return;
    try {
      const [o, f, r, a, g] = await Promise.all([
        api<Overview>("/repository/overview"),
        api<FileItem[]>("/repository/files?limit=5000"),
        api<Finding[]>("/repository/risks"),
        api<EventItem[]>("/repository/activity"),
        api<Graph>("/repository/graph"),
      ]);
      setOverview(o); setFiles(f); setRisks(r); setActivity(a); setGraph(g); setRepoUrl(o.repoUrl);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to refresh analysis"); }
  };

  useEffect(() => { api<Overview>("/repository/overview").then((o) => { setOverview(o); setRepoUrl(o.repoUrl); return refresh(); }).catch(() => {}); }, []);

  const scan = async () => {
    setError(""); setMessage("");
    if (!repoUrl.trim()) { setError("Paste a public GitHub repository URL first."); return; }
    setLoading(true);
    try {
      const result = await api<{ projectName: string }>("/repository/scan", { method: "POST", body: JSON.stringify({ repoUrl }) });
      setMessage(`Analyzed ${result.projectName}.`);
      const [o, f, r, a, g] = await Promise.all([api<Overview>("/repository/overview"), api<FileItem[]>("/repository/files?limit=5000"), api<Finding[]>("/repository/risks"), api<EventItem[]>("/repository/activity"), api<Graph>("/repository/graph")]);
      setOverview(o); setFiles(f); setRisks(r); setActivity(a); setGraph(g); setRepoUrl(o.repoUrl); navigate("/");
    } catch (e) { setError(e instanceof Error ? e.message : "Repository scan failed"); }
    finally { setLoading(false); }
  };

  const openFile = async (file: FileItem) => {
    setFileLoading(true); setError("");
    try { setSelectedFile(await api<Detail>(`/repository/file/${file.path.split("/").map(encodeURIComponent).join("/")}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not open file"); }
    finally { setFileLoading(false); }
  };

  const languages = useMemo(() => [...new Set(files.map((file) => file.language))].sort(), [files]);
  const filteredFiles = useMemo(() => files.filter((file) => (!search || `${file.path} ${file.summary}`.toLowerCase().includes(search.toLowerCase())) && (riskFilter === "all" || file.risk === riskFilter) && (languageFilter === "all" || file.language === languageFilter)), [files, search, riskFilter, languageFilter]);
  const page = location === "/files" ? "files" : location === "/graph" ? "graph" : location === "/risks" ? "risks" : location === "/activity" ? "activity" : "overview";

  return <div className="min-h-screen bg-background text-foreground lg:flex">
    <aside className="w-full border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:fixed lg:inset-y-0 lg:w-[270px] lg:border-b-0 lg:border-r">
      <div className="flex h-[74px] items-center gap-3 border-b border-sidebar-border px-6"><div className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Network size={18} /></div><div><div className="font-extrabold text-white">Codebase</div><div className="font-mono text-[10px] uppercase tracking-[.2em] text-slate-400">intelligence</div></div></div>
      <div className="p-4"><p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-widest text-slate-500">Workspace</p>{[["/", "Overview", BarChart3], ["/graph", "Dependency graph", GitBranch], ["/files", "Files", FileCode2], ["/risks", "Risk register", ShieldAlert], ["/activity", "Activity", Activity]].map(([href, label, Icon]) => <Link key={String(href)} href={String(href)} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${page === (href === "/" ? "overview" : String(href).slice(1)) ? "bg-sidebar-accent text-white" : "text-slate-400 hover:bg-sidebar-accent hover:text-white"}`}><Icon size={16} />{label}</Link>)}</div>
      <div className="hidden p-4 lg:block"><div className="rounded-xl border border-sidebar-border bg-slate-800/70 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Current repository</p><p className="mt-2 truncate font-mono text-xs text-slate-200">{overview?.projectName || "No repository"}</p><p className="mt-1 text-[11px] text-slate-500">{overview ? "Public GitHub · read-only" : "Paste a GitHub URL to begin"}</p></div></div>
    </aside>

    <main className="min-w-0 flex-1 lg:ml-[270px]">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-5 py-4 backdrop-blur md:px-8"><div className="mx-auto max-w-[1500px]"><div className="flex flex-col gap-3 xl:flex-row xl:items-center"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3"><GitBranch size={15} className="shrink-0 text-muted-foreground"/><input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void scan(); }} placeholder="https://github.com/owner/repository" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"/><button onClick={() => void scan()} disabled={loading} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">{loading ? <LoaderCircle size={14} className="animate-spin"/> : <Search size={14}/>} {loading ? "Analyzing" : "Analyze repository"}</button></div><button onClick={() => void refresh()} disabled={!overview || loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold text-muted-foreground disabled:opacity-50"><RefreshCw size={14}/> Refresh</button></div></div></header>

      <div className="mx-auto max-w-[1500px] p-5 md:p-8">
        {!overview && !loading && <section className="mb-8 rounded-2xl border border-border bg-card p-8 shadow-sm md:p-12"><div className="max-w-3xl"><p className="mb-3 font-mono text-[10px] uppercase tracking-[.2em] text-emerald-700">Repository analyzer</p><h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">Understand any public GitHub codebase.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">Paste a repository URL above. The backend clones it read-only, indexes source files, maps imports, detects code risks, and exposes the results through this dashboard.</p><div className="mt-7 flex flex-wrap gap-3 text-xs font-semibold"><span className="rounded-lg bg-muted px-3 py-2">📁 File inventory</span><span className="rounded-lg bg-muted px-3 py-2">🕸 Dependency graph</span><span className="rounded-lg bg-muted px-3 py-2">⚠️ Risk detection</span><span className="rounded-lg bg-muted px-3 py-2">🔎 Source inspection</span></div></div></section>}
        {error && <div className="mb-6"><ErrorState message={error} onRetry={overview ? refresh : undefined}/></div>}
        {message && <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={16}/>{message}</div>}
        {overview && <>
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Repository overview</p><h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{overview.projectName}</h1><a href={overview.repoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">{overview.repoUrl}<ExternalLink size={12}/></a></div><div className="font-mono text-[10px] text-muted-foreground">Last scan {new Date(overview.scannedAt).toLocaleString()}</div></div>
          {page === "overview" && <OverviewView overview={overview} risks={risks} files={files} />}
          {page === "files" && <FilesView files={filteredFiles} allFiles={files} search={search} setSearch={setSearch} riskFilter={riskFilter} setRiskFilter={setRiskFilter} languageFilter={languageFilter} setLanguageFilter={setLanguageFilter} languages={languages} onOpen={openFile}/>} 
          {page === "graph" && <GraphView graph={graph}/>} 
          {page === "risks" && <RisksView risks={risks} onOpen={(path) => { const file = files.find((f) => f.path === path); if (file) void openFile(file); }}/>} 
          {page === "activity" && <ActivityView activity={activity}/>} 
        </>}
      </div>
    </main>

    {(selectedFile || fileLoading) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => !fileLoading && setSelectedFile(null)}><div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>{fileLoading ? <div className="grid min-h-[280px] place-items-center"><LoaderCircle className="animate-spin text-primary" size={28}/></div> : selectedFile && <><div className="flex items-center justify-between border-b border-border px-5 py-4"><div className="min-w-0"><p className="truncate font-mono text-sm font-bold">{selectedFile.path}</p><p className="mt-1 text-xs text-muted-foreground">{selectedFile.language} · {selectedFile.lines} lines · complexity {selectedFile.complexity} · <RiskBadge risk={selectedFile.risk}/></p></div><button onClick={() => setSelectedFile(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18}/></button></div><div className="grid min-h-0 overflow-auto lg:grid-cols-[280px_1fr]"><div className="border-b border-border p-5 lg:border-b-0 lg:border-r"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Summary</p><p className="mt-2 text-sm leading-6">{selectedFile.summary}</p><p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Symbols</p><div className="mt-2 space-y-1">{selectedFile.symbols.length ? selectedFile.symbols.map((s) => <div key={s} className="rounded bg-muted px-2 py-1 font-mono text-[11px]">{s}</div>) : <p className="text-xs text-muted-foreground">No symbols detected.</p>}</div><p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Imports</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{selectedFile.imports.join(", ") || "No imports detected."}</p><p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Imported by</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{selectedFile.importedBy.join(", ") || "No local callers detected."}</p></div><pre className="overflow-auto bg-slate-950 p-5 font-mono text-xs leading-6 text-slate-200"><code>{selectedFile.content}</code></pre></div></>}</div></div>}
  </div>;
}

function OverviewView({ overview, risks, files }: { overview: Overview; risks: Finding[]; files: FileItem[] }) {
  const hotspots = [...files].sort((a,b) => b.importedByCount - a.importedByCount).slice(0, 5);
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Health score" value={`${overview.healthScore}/100`} note="Based on detected risk findings"/><Metric label="Files indexed" value={overview.totalFiles.toLocaleString()} note={`${overview.totalModules} modules mapped`}/><Metric label="Dependencies" value={overview.totalDependencies.toLocaleString()} note="Detected import edges"/><Metric label="Open risks" value={overview.riskCount.toLocaleString()} note="Prioritized for review"/></div><div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><section className="rounded-xl border border-border bg-card p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Language mix</h2><Link href="/files" className="text-xs font-bold text-primary">Explore files →</Link></div>{overview.languageBreakdown.map((item) => <div key={item.language} className="mb-4"><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold">{item.language}</span><span className="font-mono text-muted-foreground">{item.files} files · {item.percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${item.percentage}%`}}/></div></div>)}</section><section className="rounded-xl border border-border bg-card p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Priority risks</h2><Link href="/risks" className="text-xs font-bold text-primary">View all →</Link></div>{risks.slice(0,4).map((r) => <div key={r.id} className="mb-3 rounded-lg bg-muted/60 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold">{r.title}</p><RiskBadge risk={r.severity}/></div><p className="mt-1 text-[11px] text-muted-foreground">{r.file}</p></div>)}{!risks.length && <p className="text-sm text-muted-foreground">No risks detected.</p>}</section></div><section className="rounded-xl border border-border bg-card p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Blast radius candidates</h2><p className="mt-1 text-sm font-semibold">Files with the most local callers</p></div><Link href="/graph" className="text-xs font-bold text-primary">Open graph →</Link></div><div className="grid gap-3 md:grid-cols-5">{hotspots.map((file) => <div key={file.path} className="rounded-lg border border-border p-3"><p className="truncate font-mono text-xs font-bold">{file.name}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{file.path}</p><p className="mt-3 font-mono text-lg">{file.importedByCount}</p><p className="text-[10px] text-muted-foreground">local callers</p></div>)}</div></section></div>;
}

function FilesView({ files, allFiles, search, setSearch, riskFilter, setRiskFilter, languageFilter, setLanguageFilter, languages, onOpen }: { files: FileItem[]; allFiles: FileItem[]; search: string; setSearch: (v:string)=>void; riskFilter:string; setRiskFilter:(v:string)=>void; languageFilter:string; setLanguageFilter:(v:string)=>void; languages:string[]; onOpen:(f:FileItem)=>void }) {
  return <div><div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row"><div className="flex flex-1 items-center gap-2 rounded-lg border border-border px-3"><Search size={15} className="text-muted-foreground"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search paths, summaries, symbols..." className="w-full bg-transparent py-2 text-sm outline-none"/></div><select value={riskFilter} onChange={(e)=>setRiskFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs"><option value="all">All risks</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select value={languageFilter} onChange={(e)=>setLanguageFilter(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs"><option value="all">All languages</option>{languages.map((l)=><option key={l}>{l}</option>)}</select></div><div className="mb-3 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{files.length.toLocaleString()} matching files · {allFiles.length.toLocaleString()} indexed</p></div><div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="grid grid-cols-[minmax(0,1fr)_130px_90px_100px_100px] border-b border-border bg-muted/60 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span>File</span><span>Language</span><span>Lines</span><span>Complexity</span><span>Risk</span></div>{files.map((file)=><button key={file.path} onClick={()=>onOpen(file)} className="grid w-full grid-cols-[minmax(0,1fr)_130px_90px_100px_100px] items-center border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted/50"><span className="min-w-0"><span className="block truncate font-mono text-xs font-semibold">{file.path}</span><span className="block truncate text-[11px] text-muted-foreground">{file.summary}</span></span><span className="text-xs text-muted-foreground">{file.language}</span><span className="font-mono text-xs">{file.lines}</span><span className="font-mono text-xs">{file.complexity}</span><span><RiskBadge risk={file.risk}/></span></button>)}{!files.length&&<div className="p-12 text-center text-sm text-muted-foreground">No files match your filters.</div>}</div></div>;
}

function GraphView({ graph }: { graph: Graph | null }) {
  if (!graph) return <div className="rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">No graph available.</div>;
  const top = [...graph.nodes].sort((a,b)=>b.importedBy-a.importedBy).slice(0,30);
  return <div className="grid gap-6 xl:grid-cols-[1fr_340px]"><section className="rounded-xl border border-border bg-slate-950 p-6 text-slate-200"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Live topology</p><p className="mt-1 text-sm font-semibold">{graph.nodes.length} nodes · {graph.edges.length} edges</p></div><span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] text-slate-400">import graph</span></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{top.map((node)=><div key={node.id} className="rounded-lg border border-white/10 bg-white/5 p-3"><div className="flex items-center justify-between gap-2"><p className="truncate font-mono text-xs font-semibold">{node.label}</p><RiskBadge risk={node.risk}/></div><p className="mt-1 truncate text-[10px] text-slate-500">{node.path}</p><div className="mt-3 flex gap-4 font-mono text-[10px] text-slate-400"><span>{node.imports} imports</span><span>{node.importedBy} callers</span></div></div>)}</div></section><section className="rounded-xl border border-border bg-card p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Most connected modules</p><div className="mt-4 space-y-3">{top.slice(0,10).map((node,i)=><div key={node.id} className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded bg-muted font-mono text-[10px]">{i+1}</span><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs font-semibold">{node.path}</p><p className="text-[10px] text-muted-foreground">{node.importedBy} callers</p></div></div>)}</div></section></div>;
}

function RisksView({ risks, onOpen }: { risks: Finding[]; onOpen: (path:string)=>void }) {
  return <div><div className="mb-5 grid gap-4 sm:grid-cols-3"><Metric label="High" value={risks.filter(r=>r.severity==="high").length} note="Immediate review"/><Metric label="Medium" value={risks.filter(r=>r.severity==="medium").length} note="Maintenance risk"/><Metric label="Total" value={risks.length} note="Detected findings"/></div><div className="space-y-3">{risks.map((r)=><button key={r.id} onClick={()=>onOpen(r.file)} className="w-full rounded-xl border border-border bg-card p-5 text-left shadow-sm hover:border-primary"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className={`size-2 rounded-full ${r.severity === "high" ? "bg-rose-500" : r.severity === "medium" ? "bg-amber-500" : "bg-emerald-500"}`}/><h3 className="text-sm font-bold">{r.title}</h3></div><RiskBadge risk={r.severity}/></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{r.detail}</p><div className="mt-3 flex flex-wrap gap-3 text-[11px]"><span className="rounded bg-muted px-2 py-1 font-mono">{r.file}</span><span className="text-muted-foreground">Impact: {r.impact}</span></div></button>)}{!risks.length&&<div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No risks detected in this repository.</div>}</div></div>;
}

function ActivityView({ activity }: { activity: EventItem[] }) {
  return <div className="rounded-xl border border-border bg-card p-6 shadow-sm"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Scan activity</p><div className="mt-4 divide-y divide-border">{activity.map((item)=><div key={item.id} className="flex gap-4 py-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted"><Activity size={14}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold">{item.title}</p><span className="font-mono text-[10px] text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></div></div>)}{!activity.length&&<p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>}</div></div>;
}
