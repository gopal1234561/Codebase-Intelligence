import { useEffect, useState } from "react";
import { ArrowLeft, FileCode2, LoaderCircle, Search, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

type Overview = { projectName: string; repoUrl: string };
type SearchResult = { file: string; line: number; language: string; snippet: string; matchType: "content" | "path" };

async function api<T>(url: string): Promise<T> {
  const response = await fetch(`/api${url}`, { headers: { "Content-Type": "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export default function CodeSearch() {
  const [, navigate] = useLocation();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api<Overview>("/repository/overview").then(setOverview).catch(() => setOverview(null)); }, []);

  useEffect(() => {
    if (!overview || !query.trim()) { setResults([]); setTotal(0); setLoading(false); return; }
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const data = await api<{ total: number; results: SearchResult[] }>(`/repository/search?q=${encodeURIComponent(query.trim())}&repoUrl=${encodeURIComponent(overview.repoUrl)}&limit=100`);
        setResults(data.results); setTotal(data.total);
      } catch (e) { setError(e instanceof Error ? e.message : "Search failed"); setResults([]); setTotal(0); }
      finally { setLoading(false); }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, overview]);

  const openFile = (result: SearchResult) => navigate(`/files?open=${encodeURIComponent(result.file)}&line=${result.line}`);

  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-4 py-4 backdrop-blur sm:px-6 md:px-8">
      <div className="mx-auto flex max-w-[1200px] items-center gap-3">
        <button onClick={() => navigate("/")} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-muted"><ArrowLeft size={14}/> Repository</button>
        <div className="min-w-0 flex-1"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Workspace / Code Search</p><h1 className="truncate text-xl font-extrabold sm:text-2xl">Global Code Search</h1></div>
      </div>
    </header>

    <main className="mx-auto max-w-[1200px] p-4 sm:p-6 md:p-8">
      {!overview && <div className="rounded-2xl border border-border bg-card p-8 text-center"><p className="font-semibold">No repository is currently analyzed.</p><button onClick={() => navigate("/")} className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Analyze a repository</button></div>}
      {overview && <>
        <section className="ci-surface ci-interactive rounded-2xl p-5 sm:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1"><p className="text-sm font-bold">Search the analyzed repository</p><p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{overview.projectName} · {overview.repoUrl}</p></div>
            <a href={overview.repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">GitHub <ExternalLink size={12}/></a>
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-primary/20">
            {loading ? <LoaderCircle size={18} className="shrink-0 animate-spin text-primary"/> : <Search size={18} className="shrink-0 text-muted-foreground"/>}
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search functions, imports, errors, components, filenames..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            {query && <button onClick={() => setQuery("")} className="text-xs font-semibold text-muted-foreground hover:text-foreground">Clear</button>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="rounded-md bg-muted px-2.5 py-1.5">Searches source + paths</span><span className="rounded-md bg-muted px-2.5 py-1.5">Up to 100 matches</span><span className="rounded-md bg-muted px-2.5 py-1.5">Read-only</span></div>
        </section>

        {error && <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
        {query.trim() && !loading && !error && <div className="mt-7 flex items-center justify-between"><p className="text-sm font-semibold">{total ? `${total} match${total === 1 ? "" : "es"}` : "No matches"}</p><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Current repository only</p></div>}

        <div className="mt-4 space-y-3">
          {results.map((result, index) => <button key={`${result.file}-${result.line}-${index}`} onClick={() => openFile(result)} className="ci-interactive group block w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm hover:border-primary/40">
            <div className="flex items-start gap-3"><div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-primary"><FileCode2 size={15}/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate font-mono text-xs font-bold text-foreground">{result.file}</span><span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{result.language}</span><span className="font-mono text-[10px] text-muted-foreground">line {result.line}</span></div><p className="mt-2 overflow-hidden rounded-lg bg-muted/60 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground group-hover:text-foreground">{result.snippet}</p></div></div>
          </button>)}
        </div>
        {query.trim() && !loading && !error && !results.length && <div className="mt-4 rounded-2xl border border-dashed border-border p-12 text-center"><Search className="mx-auto text-muted-foreground" size={28}/><p className="mt-3 font-semibold">Nothing matched “{query}”</p><p className="mt-1 text-sm text-muted-foreground">Try a filename, function name, import, error message, or keyword.</p></div>}
        {!query.trim() && <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-border bg-card p-5"><p className="text-2xl">⌕</p><p className="mt-3 font-semibold">Find symbols</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Locate functions, classes, components, and variables.</p></div><div className="rounded-xl border border-border bg-card p-5"><p className="text-2xl">↗</p><p className="mt-3 font-semibold">Trace usage</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Jump from a match into the source inspection workflow.</p></div><div className="rounded-xl border border-border bg-card p-5"><p className="text-2xl">◎</p><p className="mt-3 font-semibold">Search safely</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Search is scoped to the repository you analyzed.</p></div></div>}
      </>}
    </main>
  </div>;
}
