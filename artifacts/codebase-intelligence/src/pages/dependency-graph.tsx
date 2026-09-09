import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, GitBranch, LoaderCircle, Maximize2, Search, X, ZoomIn, ZoomOut } from "lucide-react";

type Risk = "high" | "medium" | "low";
type Graph = {
  nodes: Array<{ id: string; label: string; path: string; directory: string; language: string; lines: number; imports: number; importedBy: number; risk: Risk }>;
  edges: Array<{ source: string; target: string; kind: string }>;
};
type Overview = { projectName: string; repoUrl: string; scannedAt: string };
type Detail = { path: string; language: string; lines: number; complexity: number; risk: Risk; summary: string; imports: string[]; importedBy: string[]; symbols: string[]; content: string };

const api = async <T,>(url: string): Promise<T> => {
  const response = await fetch(`/api${url}`, { headers: { "Content-Type": "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
};

const riskClass: Record<Risk, string> = { high: "border-rose-400/70 bg-rose-500/10", medium: "border-amber-400/70 bg-amber-500/10", low: "border-emerald-400/70 bg-emerald-500/10" };
const riskDot: Record<Risk, string> = { high: "bg-rose-400", medium: "bg-amber-400", low: "bg-emerald-400" };

export default function DependencyGraph() {
  const [, navigate] = useLocation();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    Promise.all([api<Graph>("/repository/graph"), api<Overview>("/repository/overview")])
      .then(([g, o]) => { setGraph(g); setOverview(o); })
      .catch((e) => setError(e instanceof Error ? e.message : "No repository analysis is available."))
      .finally(() => setLoading(false));
  }, []);

  const openFile = async (path: string) => {
    setDetailLoading(true);
    try { setDetail(await api<Detail>(`/repository/file/${path.split("/").map(encodeURIComponent).join("/")}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not open source file"); }
    finally { setDetailLoading(false); }
  };

  const connected = useMemo(() => {
    if (!graph || !selected) return new Set<string>();
    const result = new Set<string>([selected]);
    graph.edges.forEach((e) => { if (e.source === selected) result.add(e.target); if (e.target === selected) result.add(e.source); });
    return result;
  }, [graph, selected]);

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    const q = search.trim().toLowerCase();
    return graph.nodes.filter((n) => !q || `${n.path} ${n.label} ${n.directory}`.toLowerCase().includes(q));
  }, [graph, search]);

  const edgeKinds = useMemo(() => graph ? [...new Set(graph.edges.map((e) => e.kind))].sort() : [], [graph]);
  const filteredEdges = useMemo(() => graph ? graph.edges.filter((e) => kind === "all" || e.kind === kind) : [], [graph, kind]);

  const cycleNodes = useMemo(() => {
    if (!graph) return new Set<string>();
    const adjacency = new Map<string, string[]>();
    graph.nodes.forEach((n) => adjacency.set(n.id, []));
    graph.edges.forEach((e) => adjacency.get(e.source)?.push(e.target));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const cycles = new Set<string>();
    const stack: string[] = [];
    const walk = (id: string) => {
      visiting.add(id); stack.push(id);
      for (const next of adjacency.get(id) || []) {
        if (visiting.has(next)) { const start = stack.indexOf(next); if (start >= 0) stack.slice(start).forEach((n) => cycles.add(n)); }
        else if (!visited.has(next)) walk(next);
      }
      stack.pop(); visiting.delete(id); visited.add(id);
    };
    graph.nodes.forEach((n) => { if (!visited.has(n.id)) walk(n.id); });
    return cycles;
  }, [graph]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-300"><LoaderCircle className="animate-spin" size={28}/></div>;
  if (error || !graph || !overview) return <div className="min-h-screen bg-background p-6"><div className="mx-auto mt-20 max-w-xl rounded-2xl border border-border bg-card p-8 text-center"><AlertTriangle className="mx-auto mb-3 text-amber-500" size={28}/><h1 className="text-lg font-bold">Dependency graph unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error || "Analyze a repository first, then open Dependency graph."}</p><button onClick={() => navigate("/")} className="mt-5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Back to repository</button></div></div>;

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const activeNodes = filteredNodes.slice(0, 140);
  const activeIds = new Set(activeNodes.map((n) => n.id));
  const activeEdges = filteredEdges.filter((e) => activeIds.has(e.source) && activeIds.has(e.target));
  const columns = Math.max(3, Math.ceil(Math.sqrt(activeNodes.length || 1) * 1.35));
  const spacingX = 190;
  const spacingY = 130;
  const canvasWidth = Math.max(1100, columns * spacingX + 100);
  const canvasHeight = Math.max(650, Math.ceil(activeNodes.length / columns) * spacingY + 120);
  const positions = new Map(activeNodes.map((n, i) => [n.id, { x: 70 + (i % columns) * spacingX, y: 70 + Math.floor(i / columns) * spacingY }]));

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur sm:px-6"><div className="mx-auto max-w-[1600px]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><div className="flex items-center gap-2"><button onClick={() => navigate("/")} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/10" title="Back"><GitBranch size={16}/></button><div className="min-w-0"><h1 className="truncate text-lg font-extrabold sm:text-xl">Dependency Graph</h1><p className="truncate text-[11px] text-slate-500">{overview.projectName} · software dependency topology</p></div></div></div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400"><span>{graph.nodes.length} nodes</span><span>·</span><span>{graph.edges.length} edges</span><span>·</span><span>{cycleNodes.size} cycle nodes</span></div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[.03] px-3"><Search size={14} className="shrink-0 text-slate-500"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files, modules, directories..." className="min-w-0 flex-1 bg-transparent py-2.5 text-xs outline-none"/></div><select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-xs text-slate-300"><option value="all">All relationships</option>{edgeKinds.map((k) => <option key={k} value={k}>{k}</option>)}</select><div className="flex gap-2"><button onClick={() => setZoom((v) => Math.min(1.8, v + .15))} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"><ZoomIn size={15}/></button><button onClick={() => setZoom((v) => Math.max(.55, v - .15))} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"><ZoomOut size={15}/></button><button onClick={() => setZoom(1)} className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"><Maximize2 size={15}/></button></div></div>
    </div></header>

    <main className="mx-auto max-w-[1600px] p-3 sm:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3"><div><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Repository topology</p><p className="mt-1 text-xs text-slate-400">Click a node to inspect source and highlight its direct neighborhood.</p></div><div className="flex flex-wrap gap-2 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-emerald-400"/>low</span><span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-amber-400"/>medium</span><span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-rose-400"/>high</span><span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-fuchsia-400"/>cycle</span></div></div>
          <div className="h-[68vh] min-h-[520px] overflow-auto bg-[radial-gradient(circle_at_center,rgba(148,163,184,.16)_1px,transparent_1px)] [background-size:24px_24px] touch-pan-x touch-pan-y">
            <svg width={canvasWidth} height={canvasHeight} viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} className="origin-top-left transition-transform duration-200" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
              <defs><marker id="dep-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#64748b"/></marker></defs>
              {activeEdges.map((edge, i) => { const s = positions.get(edge.source), t = positions.get(edge.target); if (!s || !t) return null; const highlighted = selected && (edge.source === selected || edge.target === selected); const dx = t.x - s.x; const bend = Math.min(80, Math.max(25, Math.abs(dx) * .2)); return <g key={`${edge.source}-${edge.target}-${i}`} opacity={selected ? (highlighted ? 1 : .16) : .72}><path d={`M${s.x + 72},${s.y + 27} C${s.x + 72 + dx*.25},${s.y + 27 + bend} ${t.x + 72 - dx*.25},${t.y + 27 - bend} ${t.x + 72},${t.y + 27}`} fill="none" stroke={highlighted ? "#38bdf8" : "#64748b"} strokeWidth={highlighted ? 2.2 : 1.25} markerEnd="url(#dep-arrow)"/><title>{edge.kind}: {nodeMap.get(edge.source)?.path} → {nodeMap.get(edge.target)?.path}</title></g>; })}
              {activeNodes.map((node) => { const p = positions.get(node.id)!; const isSelected = selected === node.id; const isConnected = connected.has(node.id); const isCycle = cycleNodes.has(node.id); return <g key={node.id} transform={`translate(${p.x},${p.y})`} onClick={() => setSelected(node.id)} className="cursor-pointer" opacity={selected && !isConnected ? .28 : 1}><rect x="0" y="0" width="145" height="55" rx="9" className={`fill-slate-900 ${riskClass[node.risk]}`} stroke={isSelected ? "#38bdf8" : isCycle ? "#e879f9" : undefined} strokeWidth={isSelected ? 2 : isCycle ? 1.5 : 1}/><circle cx="13" cy="15" r="4" className={riskDot[node.risk].replace("bg-", "fill-")}/><text x="23" y="18" fill="#e2e8f0" fontSize="10" fontWeight="700" fontFamily="ui-monospace,monospace">{node.label.length > 19 ? `${node.label.slice(0,18)}…` : node.label}</text><text x="10" y="34" fill="#94a3b8" fontSize="8" fontFamily="ui-monospace,monospace">{node.path.length > 23 ? `…${node.path.slice(-22)}` : node.path}</text><text x="10" y="47" fill="#64748b" fontSize="8" fontFamily="ui-monospace,monospace">↑{node.imports} · ↓{node.importedBy}{isCycle ? " · cycle" : ""}</text></g>; })}
            </svg>
          </div>
          {activeNodes.length < filteredNodes.length && <div className="border-t border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-[10px] text-amber-200">Showing the first {activeNodes.length} matching nodes. Search or filter to focus a large repository.</div>}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Selected node</p>{selected && nodeMap.get(selected) ? (() => { const n = nodeMap.get(selected)!; const upstream = graph.edges.filter(e => e.target === n.id).map(e => nodeMap.get(e.source)).filter(Boolean); const downstream = graph.edges.filter(e => e.source === n.id).map(e => nodeMap.get(e.target)).filter(Boolean); return <div className="mt-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-sm font-bold">{n.label}</h2><p className="mt-1 break-all font-mono text-[10px] text-slate-500">{n.path}</p></div><span className={`size-2 shrink-0 rounded-full ${riskDot[n.risk]}`}/></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-white/[.04] p-2"><p className="text-[9px] text-slate-500">Language</p><p className="mt-1 text-xs">{n.language}</p></div><div className="rounded-lg bg-white/[.04] p-2"><p className="text-[9px] text-slate-500">Lines</p><p className="mt-1 font-mono text-xs">{n.lines}</p></div><div className="rounded-lg bg-white/[.04] p-2"><p className="text-[9px] text-slate-500">Imports</p><p className="mt-1 font-mono text-xs">{n.imports}</p></div><div className="rounded-lg bg-white/[.04] p-2"><p className="text-[9px] text-slate-500">Imported by</p><p className="mt-1 font-mono text-xs">{n.importedBy}</p></div></div><button onClick={() => void openFile(n.path)} className="mt-4 w-full rounded-lg bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground">Inspect source</button><div className="mt-4"><p className="mb-2 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-slate-500"><ArrowUp size={11}/> upstream dependencies</p>{upstream.slice(0,6).map((x) => <button key={x!.id} onClick={() => setSelected(x!.id)} className="mb-1 block w-full truncate rounded bg-white/[.04] px-2 py-1.5 text-left font-mono text-[10px] text-slate-300 hover:bg-white/[.08]">{x!.path}</button>)}{!upstream.length && <p className="text-[10px] text-slate-600">None detected</p>}</div><div className="mt-4"><p className="mb-2 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-slate-500"><ArrowDown size={11}/> downstream dependents</p>{downstream.slice(0,6).map((x) => <button key={x!.id} onClick={() => setSelected(x!.id)} className="mb-1 block w-full truncate rounded bg-white/[.04] px-2 py-1.5 text-left font-mono text-[10px] text-slate-300 hover:bg-white/[.08]">{x!.path}</button>)}{!downstream.length && <p className="text-[10px] text-slate-600">None detected</p>}</div></div> : <p className="mt-2 text-xs leading-5 text-slate-500">Select any file/module in the graph to see its direct dependencies and dependents.</p>}</section>
          <section className="rounded-2xl border border-white/10 bg-slate-900 p-4"><p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Graph signals</p><div className="mt-3 space-y-2 text-xs"><div className="flex justify-between"><span className="text-slate-500">High-risk nodes</span><span>{graph.nodes.filter(n => n.risk === "high").length}</span></div><div className="flex justify-between"><span className="text-slate-500">Most connected</span><span>{Math.max(...graph.nodes.map(n => n.imports + n.importedBy))}</span></div><div className="flex justify-between"><span className="text-slate-500">Cycle nodes</span><span className={cycleNodes.size ? "text-fuchsia-300" : "text-emerald-300"}>{cycleNodes.size}</span></div></div></section>
        </aside>
      </div>
    </main>

    {(detail || detailLoading) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-5" onClick={() => !detailLoading && setDetail(null)}><div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900" onClick={(e) => e.stopPropagation()}>{detailLoading ? <div className="grid min-h-[300px] place-items-center"><LoaderCircle className="animate-spin" size={28}/></div> : detail && <><div className="flex items-start justify-between gap-3 border-b border-white/10 p-4"><div className="min-w-0"><p className="truncate font-mono text-xs font-bold">{detail.path}</p><p className="mt-1 text-[10px] text-slate-500">{detail.language} · {detail.lines} lines · complexity {detail.complexity} · {detail.risk}</p></div><button onClick={() => setDetail(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={17}/></button></div><div className="grid min-h-0 overflow-auto lg:grid-cols-[280px_1fr]"><div className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r"><p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">Summary</p><p className="mt-2 text-xs leading-5 text-slate-300">{detail.summary}</p><p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-slate-500">Symbols</p><div className="mt-2 space-y-1">{detail.symbols.length ? detail.symbols.map(s => <div key={s} className="rounded bg-white/[.04] px-2 py-1 font-mono text-[10px]">{s}</div>) : <p className="text-[10px] text-slate-600">No symbols detected.</p>}</div><p className="mt-5 font-mono text-[9px] uppercase tracking-widest text-slate-500">Imports</p><p className="mt-2 break-words text-[10px] leading-5 text-slate-400">{detail.imports.join(", ") || "None"}</p></div><pre className="max-h-[55vh] overflow-auto bg-slate-950 p-4 font-mono text-[10px] leading-5 text-slate-300 sm:text-xs lg:max-h-none"><code>{detail.content}</code></pre></div></>}</div></div>}
  </div>;
}
