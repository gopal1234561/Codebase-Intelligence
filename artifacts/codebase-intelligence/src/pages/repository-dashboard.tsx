import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, ExternalLink, FileCode2, GitBranch, LoaderCircle, Maximize2, Menu, Network, RefreshCw, Search, ShieldAlert, Sparkles, X, ZoomIn, ZoomOut } from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  useEffect(() => { setMobileMenuOpen(false); }, [location]);

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

  return <div className="min-h-screen min-w-0 bg-background text-foreground">
    <aside className={`fixed inset-y-0 left-0 z-50 w-[280px] border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:w-[270px] lg:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="flex h-[74px] items-center gap-3 border-b border-sidebar-border px-5 lg:px-6"><div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Network size={18} /></div><div className="min-w-0"><div className="font-extrabold text-white">Codebase</div><div className="font-mono text-[10px] uppercase tracking-[.2em] text-slate-400">intelligence</div></div><button onClick={() => setMobileMenuOpen(false)} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-sidebar-accent hover:text-white lg:hidden" aria-label="Close navigation"><X size={18}/></button></div>
      <div className="p-4"><p className="mb-3 px-3 font-mono text-[10px] uppercase tracking-widest text-slate-500">Workspace</p>{[["/", "Overview", BarChart3], ["/graph", "Dependency graph", GitBranch], ["/files", "Files", FileCode2], ["/risks", "Risk register", ShieldAlert], ["/activity", "Activity", Activity]].map(([href, label, Icon]) => <Link key={String(href)} href={String(href)} onClick={() => setMobileMenuOpen(false)} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${page === (href === "/" ? "overview" : String(href).slice(1)) ? "bg-sidebar-accent text-white" : "text-slate-400 hover:bg-sidebar-accent hover:text-white"}`}><Icon size={16} />{label}</Link>)}</div>
      <div className="hidden p-4 lg:block"><div className="rounded-xl border border-sidebar-border bg-slate-800/70 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Current repository</p><p className="mt-2 truncate font-mono text-xs text-slate-200">{overview?.projectName || "No repository"}</p><p className="mt-1 text-[11px] text-slate-500">{overview ? "Public GitHub · read-only" : "Paste a GitHub URL to begin"}</p></div></div>
    </aside>
    {mobileMenuOpen && <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}
    <main className="min-w-0 flex-1 lg:ml-[270px]">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4 md:px-8"><div className="mx-auto max-w-[1500px]"><div className="mb-3 flex items-center gap-2 lg:hidden"><button onClick={() => setMobileMenuOpen(true)} className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground" aria-label="Open navigation"><Menu size={19}/></button><div className="min-w-0"><p className="truncate text-sm font-extrabold">Codebase Intelligence</p><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Repository analyzer</p></div></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3"><GitBranch size={15} className="shrink-0 text-muted-foreground"/><input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void scan(); }} placeholder="https://github.com/owner/repository" className="min-w-0 flex-1 bg-transparent py-3 text-xs outline-none sm:text-sm"/><button onClick={() => void scan()} disabled={loading} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground disabled:opacity-60 sm:px-4 sm:text-xs">{loading ? <LoaderCircle size={14} className="animate-spin"/> : <Search size={14}/>}<span className="hidden xs:inline">{loading ? "Analyzing" : "Analyze repository"}</span><span className="xs:hidden">{loading ? "Analyzing" : "Analyze"}</span></button></div><button onClick={() => void refresh()} disabled={!overview || loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-bold text-muted-foreground disabled:opacity-50 sm:w-auto"><RefreshCw size={14}/> Refresh</button></div></div></header>
      <div className="mx-auto max-w-[1500px] p-4 sm:p-5 md:p-8">
        {!overview && !loading && <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8 md:p-12"><div className="max-w-3xl"><p className="mb-3 font-mono text-[10px] uppercase tracking-[.2em] text-emerald-700">Repository analyzer</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">Understand any public GitHub codebase.</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">Paste a repository URL above. The backend clones it read-only, indexes source files, maps imports, detects code risks, and exposes the results through this dashboard.</p><div className="mt-7 flex flex-wrap gap-3 text-xs font-semibold"><span className="rounded-lg bg-muted px-3 py-2">📁 File inventory</span><span className="rounded-lg bg-muted px-3 py-2">🕸 Dependency graph</span><span className="rounded-lg bg-muted px-3 py-2">⚠️ Risk detection</span><span className="rounded-lg bg-muted px-3 py-2">🔎 Source inspection</span></div></div></section>}
        {error && <div className="mb-6"><ErrorState message={error} onRetry={overview ? refresh : undefined}/></div>}
        {message && <div className="mb-6 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={16} className="mt-0.5 shrink-0"/>{message}</div>}
        {overview && <>
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div className="min-w-0"><p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Repository overview</p><h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl">{overview.projectName}</h1><a href={overview.repoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate text-xs font-semibold text-primary hover:underline"><span className="truncate">{overview.repoUrl}</span><ExternalLink size={12} className="shrink-0"/></a></div><div className="font-mono text-[10px] text-muted-foreground">Last scan {new Date(overview.scannedAt).toLocaleString()}</div></div>
          {page === "overview" && <OverviewView overview={overview} risks={risks} files={files} />}
          {page === "files" && <FilesView files={filteredFiles} allFiles={files} search={search} setSearch={setSearch} riskFilter={riskFilter} setRiskFilter={setRiskFilter} languageFilter={languageFilter} setLanguageFilter={setLanguageFilter} languages={languages} onOpen={openFile}/>} 
          {page === "graph" && <GraphView graph={graph} onOpen={(path) => { const file = files.find((f) => f.path === path); if (file) void openFile(file); }}/>} 
          {page === "risks" && <RisksView risks={risks} onOpen={(path) => { const file = files.find((f) => f.path === path); if (file) void openFile(file); }}/>} 
          {page === "activity" && <ActivityView activity={activity}/>} 
        </>}
      </div>
    </main>
    {(selectedFile || fileLoading) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4" onClick={() => !fileLoading && setSelectedFile(null)}><div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl sm:max-h-[92vh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>{fileLoading ? <div className="grid min-h-[280px] place-items-center"><LoaderCircle className="animate-spin text-primary" size={28}/></div> : selectedFile && <><div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4"><div className="min-w-0"><p className="truncate font-mono text-xs font-bold sm:text-sm">{selectedFile.path}</p><p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">{selectedFile.language} · {selectedFile.lines} lines · complexity {selectedFile.complexity} · <RiskBadge risk={selectedFile.risk}/></p></div><button onClick={() => setSelectedFile(null)} className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18}/></button></div><div className="grid min-h-0 overflow-auto lg:grid-cols-[280px_1fr]"><div className="border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Summary</p><p className="mt-2 text-sm leading-6">{selectedFile.summary}</p><p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Symbols</p><div className="mt-2 space-y-1">{selectedFile.symbols.length ? selectedFile.symbols.map((s) => <div key={s} className="rounded bg-muted px-2 py-1 font-mono text-[11px]">{s}</div>) : <p className="text-xs text-muted-foreground">No symbols detected.</p>}</div><p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Imports</p><p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{selectedFile.imports.join(", ") || "No imports detected."}</p><p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Imported by</p><p className="mt-2 break-words text-xs leading-5 text-muted-foreground">{selectedFile.importedBy.join(", ") || "No local callers detected."}</p></div><pre className="max-h-[55vh] overflow-auto bg-slate-950 p-4 font-mono text-[11px] leading-6 text-slate-200 sm:p-5 sm:text-xs lg:max-h-none"><code>{selectedFile.content}</code></pre></div></>}</div></div>}
  </div>;
}

function OverviewView({ overview, risks, files }: { overview: Overview; risks: Finding[]; files: FileItem[] }) {
  const hotspots = [...files].sort((a,b) => b.importedByCount - a.importedByCount).slice(0, 5);
  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Health score" value={`${overview.healthScore}/100`} note="Based on detected risk findings"/><Metric label="Files indexed" value={overview.totalFiles.toLocaleString()} note={`${overview.totalModules} modules mapped`}/><Metric label="Dependencies" value={overview.totalDependencies.toLocaleString()} note="Detected import edges"/><Metric label="Open risks" value={overview.riskCount.toLocaleString()} note="Prioritized for review"/></div><div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Language mix</h2><Link href="/files" className="text-xs font-bold text-primary">Explore files →</Link></div>{overview.languageBreakdown.map((item) => <div key={item.language} className="mb-4"><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="font-semibold">{item.language}</span><span className="shrink-0 font-mono text-muted-foreground">{item.files} files · {item.percentage}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${item.percentage}%`}}/></div></div>)}</section><section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Priority risks</h2><Link href="/risks" className="text-xs font-bold text-primary">View all →</Link></div>{risks.slice(0,4).map((r) => <div key={r.id} className="mb-3 rounded-lg bg-muted/60 p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold">{r.title}</p><RiskBadge risk={r.severity}/></div><p className="mt-1 truncate text-[11px] text-muted-foreground">{r.file}</p></div>)}{!risks.length && <p className="text-sm text-muted-foreground">No risks detected.</p>}</section></div><section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Blast radius candidates</h2><p className="mt-1 text-sm font-semibold">Files with the most local callers</p></div><Link href="/graph" className="shrink-0 text-xs font-bold text-primary">Open graph →</Link></div><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">{hotspots.map((file) => <div key={file.path} className="rounded-lg border border-border p-3"><p className="truncate font-mono text-xs font-bold">{file.name}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{file.path}</p><p className="mt-3 font-mono text-lg">{file.importedByCount}</p><p className="text-[10px] text-muted-foreground">local callers</p></div>)}</div></section></div>;
}

function FilesView({ files, allFiles, search, setSearch, riskFilter, setRiskFilter, languageFilter, setLanguageFilter, languages, onOpen }: { files: FileItem[]; allFiles: FileItem[]; search: string; setSearch: (v:string)=>void; riskFilter:string; setRiskFilter:(v:string)=>void; languageFilter:string; setLanguageFilter:(v:string)=>void; languages:string[]; onOpen:(f:FileItem)=>void }) {
  return <div><div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3"><Search size={15} className="shrink-0 text-muted-foreground"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search paths, summaries, symbols..." className="w-full min-w-0 bg-transparent py-2 text-sm outline-none"/></div><div className="grid grid-cols-2 gap-3 lg:flex"><select value={riskFilter} onChange={(e)=>setRiskFilter(e.target.value)} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-xs"><option value="all">All risks</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><select value={languageFilter} onChange={(e)=>setLanguageFilter(e.target.value)} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-xs"><option value="all">All languages</option>{languages.map((l)=><option key={l}>{l}</option>)}</select></div></div><div className="mb-3 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{files.length.toLocaleString()} matching files · {allFiles.length.toLocaleString()} indexed</p></div><div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block"><div className="grid grid-cols-[minmax(0,1fr)_130px_90px_100px_100px] border-b border-border bg-muted/60 px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span>File</span><span>Language</span><span>Lines</span><span>Complexity</span><span>Risk</span></div>{files.map((file)=><button key={file.path} onClick={()=>onOpen(file)} className="grid w-full grid-cols-[minmax(0,1fr)_130px_90px_100px_100px] items-center border-b border-border px-4 py-3 text-left last:border-0 hover:bg-muted/50"><span className="min-w-0"><span className="block truncate font-mono text-xs font-semibold">{file.path}</span><span className="block truncate text-[11px] text-muted-foreground">{file.summary}</span></span><span className="text-xs text-muted-foreground">{file.language}</span><span className="font-mono text-xs">{file.lines}</span><span className="font-mono text-xs">{file.complexity}</span><span><RiskBadge risk={file.risk}/></span></button>)}{!files.length&&<div className="p-12 text-center text-sm text-muted-foreground">No files match your filters.</div>}</div><div className="space-y-3 md:hidden">{files.map((file)=><button key={file.path} onClick={()=>onOpen(file)} className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm active:bg-muted/50"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs font-semibold">{file.path}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{file.summary}</p></div><RiskBadge risk={file.risk}/></div><div className="mt-4 grid grid-cols-3 gap-2 text-[10px]"><div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">Language</p><p className="mt-1 truncate font-semibold">{file.language}</p></div><div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">Lines</p><p className="mt-1 font-mono font-semibold">{file.lines}</p></div><div className="rounded-lg bg-muted/60 p-2"><p className="text-muted-foreground">Complexity</p><p className="mt-1 font-mono font-semibold">{file.complexity}</p></div></div></button>)}{!files.length&&<div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No files match your filters.</div>}</div></div>;
}

function GraphView({ graph, onOpen }: { graph: Graph | null; onOpen: (path: string) => void }) {
  const [zoom, setZoom] = useState(1);
  const visibleNodes = useMemo(() => graph ? [...graph.nodes].sort((a,b) => (b.importedBy + b.imports) - (a.importedBy + a.imports)).slice(0, 80) : [], [graph]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => graph ? graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)) : [], [graph, visibleIds]);
  const positions = useMemo(() => {
    const width = 1200;
    const height = Math.max(720, Math.ceil(visibleNodes.length / 5) * 150 + 80);
    const columns = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(Math.max(visibleNodes.length, 1)))));
    const rows = Math.ceil(Math.max(visibleNodes.length, 1) / columns);
    const colGap = width / (columns + 1);
    const rowGap = Math.max(130, (height - 100) / Math.max(rows, 1));
    return new Map(visibleNodes.map((node, index) => [node.id, { x: colGap * ((index % columns) + 1), y: 70 + rowGap * Math.floor(index / columns) }]));
  }, [visibleNodes]);

  if (!graph) return <div className="rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">No graph available.</div>;
  if (!graph.nodes.length) return <div className="rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">No dependency nodes were detected.</div>;

  const canvasHeight = Math.max(720, Math.ceil(visibleNodes.length / 5) * 150 + 80);
  const riskStroke = { high: "#fb7185", medium: "#fbbf24", low: "#34d399" };
  const edgePath = (source: {x:number;y:number}, target: {x:number;y:number}) => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const curve = Math.min(110, Math.max(30, Math.abs(dx) * 0.18));
    return `M ${source.x} ${source.y} C ${source.x + dx * 0.35} ${source.y + (dy > 0 ? curve : -curve)}, ${target.x - dx * 0.35} ${target.y - (dy > 0 ? curve : -curve)}, ${target.x} ${target.y}`;
  };

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><section className="min-w-0 overflow-hidden rounded-xl border border-border bg-slate-950 text-slate-200 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5"><div><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Live topology</p><p className="mt-1 text-sm font-semibold">{graph.nodes.length} nodes · {graph.edges.length} edges</p></div><div className="flex items-center gap-2"><span className="hidden rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] text-slate-400 sm:inline">imports → modules</span><button onClick={() => setZoom((v) => Math.min(1.8, Number((v + 0.15).toFixed(2))))} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10" title="Zoom in"><ZoomIn size={15}/></button><button onClick={() => setZoom((v) => Math.max(0.55, Number((v - 0.15).toFixed(2))))} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10" title="Zoom out"><ZoomOut size={15}/></button><button onClick={() => setZoom(1)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10" title="Reset zoom"><Maximize2 size={15}/></button></div></div>
      <div className="h-[55vh] min-h-[460px] overflow-auto touch-pan-x touch-pan-y bg-[radial-gradient(circle_at_center,rgba(51,65,85,.28)_1px,transparent_1px)] [background-size:24px_24px] sm:h-[620px] lg:h-[720px]">
        <svg width="1200" height={canvasHeight} viewBox={`0 0 1200 ${canvasHeight}`} className="min-w-[900px] origin-top-left transition-transform duration-200 sm:min-w-[1000px]" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
          <defs><marker id="dependency-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L9,4.5 L0,9 z" fill="#64748b" /></marker></defs>
          <g opacity="0.9">{visibleEdges.map((edge, index) => { const source = positions.get(edge.source); const target = positions.get(edge.target); if (!source || !target) return null; return <path key={`${edge.source}-${edge.target}-${edge.kind}-${index}`} d={edgePath({x:source.x,y:source.y + 34},{x:target.x,y:target.y - 34})} fill="none" stroke="#64748b" strokeWidth="1.5" strokeOpacity="0.72" markerEnd="url(#dependency-arrow)" />; })}</g>
          <g>{visibleNodes.map((node) => { const p = positions.get(node.id); if (!p) return null; return <g key={node.id} transform={`translate(${p.x - 92},${p.y - 34})`} onClick={() => onOpen(node.path)} className="cursor-pointer"><rect width="184" height="68" rx="10" fill="#0f172a" stroke={riskStroke[node.risk]} strokeWidth="1.5" /><rect x="0" y="0" width="4" height="68" rx="2" fill={riskStroke[node.risk]} /><text x="14" y="21" fill="#e2e8f0" fontSize="11" fontWeight="700" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}</text><text x="14" y="38" fill="#64748b" fontSize="9" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{node.path.length > 27 ? `${node.path.slice(0, 26)}…` : node.path}</text><text x="14" y="55" fill="#94a3b8" fontSize="9" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">↓ {node.importedBy} callers · ↑ {node.imports} imports</text></g>; })}</g>
        </svg>
      </div>
      {visibleNodes.length < graph.nodes.length && <div className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[11px] text-amber-200 sm:px-5">Showing the 80 most connected nodes so the graph stays readable. {graph.nodes.length - visibleNodes.length} lower-connectivity nodes are omitted from the visual view.</div>}
    </section>
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Most connected modules</p><p className="mt-1 text-xs text-muted-foreground">Click a node to inspect its source.</p></div><Sparkles size={16} className="text-primary"/></div><div className="mt-4 space-y-3">{visibleNodes.slice(0,10).map((node,i)=><button key={node.id} onClick={() => onOpen(node.path)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"><span className="grid size-6 shrink-0 place-items-center rounded bg-muted font-mono text-[10px]">{i+1}</span><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs font-semibold">{node.path}</p><p className="text-[10px] text-muted-foreground">{node.importedBy} callers · {node.imports} imports</p></div><RiskBadge risk={node.risk}/></button>)}</div></section>
  </div>;
}

function RisksView({ risks, onOpen }: { risks: Finding[]; onOpen: (path:string)=>void }) {
  return <div><div className="mb-5 grid gap-4 sm:grid-cols-3"><Metric label="High" value={risks.filter(r=>r.severity==="high").length} note="Immediate review"/><Metric label="Medium" value={risks.filter(r=>r.severity==="medium").length} note="Maintenance risk"/><Metric label="Total" value={risks.length} note="Detected findings"/></div><div className="space-y-3">{risks.map((r)=><button key={r.id} onClick={()=>onOpen(r.file)} className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm hover:border-primary sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className={`size-2 shrink-0 rounded-full ${r.severity === "high" ? "bg-rose-500" : r.severity === "medium" ? "bg-amber-500" : "bg-emerald-500"}`}/><h3 className="text-sm font-bold">{r.title}</h3></div><RiskBadge risk={r.severity}/></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{r.detail}</p><div className="mt-3 flex flex-wrap gap-3 text-[11px]"><span className="max-w-full truncate rounded bg-muted px-2 py-1 font-mono">{r.file}</span><span className="text-muted-foreground">Impact: {r.impact}</span></div></button>)}{!risks.length&&<div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No risks detected in this repository.</div>}</div></div>;
}

function ActivityView({ activity }: { activity: EventItem[] }) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Scan activity</p><div className="mt-4 divide-y divide-border">{activity.map((item)=><div key={item.id} className="flex gap-3 py-4 sm:gap-4"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted"><Activity size={14}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-semibold">{item.title}</p><span className="font-mono text-[10px] text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></div></div>)}{!activity.length&&<p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>}</div></div>;
}