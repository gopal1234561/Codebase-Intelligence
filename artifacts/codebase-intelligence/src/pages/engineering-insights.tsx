import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, GitCommit, Flame, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";

type Overview = { repoUrl: string; projectName: string; totalFiles: number };
type Commit = { sha: string; shortSha: string; author: string; date: string; subject: string };
type History = { commits: Commit[]; totalCommits: number; fileChurn: Array<{ file: string; changes: number }> };
type Hotspot = { file: string; changes: number; lines: number; complexity: number; score: number; risk: "high" | "medium" | "low" };
type DriftFinding = { severity: "high" | "medium" | "low"; title: string; detail: string; files: string[] };
type Drift = { status: "drift_detected" | "aligned"; filesAnalyzed: number; findings: DriftFinding[] };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function fmtDate(value: string) { try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; } }
function badgeClass(level: string) { return level === "high" ? "border-red-500/30 bg-red-500/10 text-red-300" : level === "medium" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-border bg-muted text-muted-foreground"; }

export default function EngineeringInsights() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [drift, setDrift] = useState<Drift | null>(null);
  const [tab, setTab] = useState<"overview" | "history" | "hotspots" | "drift">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const current = await getJson<Overview>("/api/repository/overview");
      setOverview(current);
      const encoded = encodeURIComponent(current.repoUrl);
      const [h, hs, d] = await Promise.all([
        getJson<History>(`/api/repository/history?repoUrl=${encoded}&limit=20`),
        getJson<{ hotspots: Hotspot[] }>(`/api/repository/hotspots?repoUrl=${encoded}`),
        getJson<Drift>(`/api/repository/drift?repoUrl=${encoded}`),
      ]);
      setHistory(h); setHotspots(hs.hotspots); setDrift(d);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load engineering insights"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const topChurn = useMemo(() => history?.fileChurn.slice(0, 8) ?? [], [history]);
  const highHotspots = hotspots.filter((h) => h.risk === "high").length;
  const driftHigh = drift?.findings.filter((f) => f.severity === "high").length ?? 0;

  return <main className="min-h-screen bg-background text-foreground p-4 md:p-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-xl border border-border bg-card p-2 hover:bg-muted"><ArrowLeft size={18}/></Link>
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Engineering intelligence</p><h1 className="text-2xl font-black md:text-3xl">{overview?.projectName ?? "Repository"}</h1><p className="text-sm text-muted-foreground">Change history, code hotspots and architecture drift</p></div>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold hover:bg-muted disabled:opacity-60"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> Refresh analysis</button>
      </div>

      {error && <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}<div className="mt-1 text-xs text-red-200/70">Analyze a repository from the main workspace first.</div></div>}

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        {[{ icon: GitCommit, label: "Commits analyzed", value: history?.totalCommits ?? "—" }, { icon: Flame, label: "High-risk hotspots", value: highHotspots }, { icon: ShieldAlert, label: "Architecture drift", value: driftHigh ? `${driftHigh} high` : drift ? "Aligned" : "—" }, { icon: TrendingUp, label: "Files scanned", value: overview?.totalFiles ?? "—" }].map(({ icon: Icon, label, value }) => <div key={label} className="ci-surface rounded-2xl p-4"><Icon size={18} className="mb-3 text-cyan-300"/><div className="text-2xl font-black">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>)}
      </div>

      <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2">
        {([["overview", "Overview"], ["history", "Git history"], ["hotspots", "Code hotspots"], ["drift", "Architecture drift"]] as const).map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`rounded-xl px-4 py-2 text-sm font-bold transition ${tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{label}</button>)}
      </div>

      {loading ? <div className="ci-surface rounded-2xl p-10 text-center text-sm text-muted-foreground">Analyzing repository engineering signals…</div> : tab === "overview" ? <div className="grid gap-5 lg:grid-cols-2">
        <section className="ci-surface rounded-2xl p-5"><h2 className="mb-1 text-lg font-black">What changed most?</h2><p className="mb-4 text-xs text-muted-foreground">Files touched most often in the latest 30 commits.</p>{topChurn.length ? <div className="space-y-3">{topChurn.map((item) => <div key={item.file}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate font-semibold">{item.file}</span><span className="text-muted-foreground">{item.changes} commits</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.changes / Math.max(1, topChurn[0].changes) * 100)}%` }}/></div></div>)}</div> : <p className="text-sm text-muted-foreground">No history available.</p>}</section>
        <section className="ci-surface rounded-2xl p-5"><h2 className="mb-1 text-lg font-black">Architecture health</h2><p className="mb-4 text-xs text-muted-foreground">Structural signals detected from the analyzed repository.</p>{drift?.findings.length ? <div className="space-y-3">{drift.findings.map((f) => <div key={f.title} className="rounded-xl border border-border p-3"><div className="mb-1 flex items-center justify-between gap-3"><span className="font-bold">{f.title}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${badgeClass(f.severity)}`}>{f.severity}</span></div><p className="text-xs text-muted-foreground">{f.detail}</p></div>)}</div> : <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4"><CheckCircle2 className="text-emerald-300" size={20}/><div><p className="font-bold">No structural drift detected</p><p className="text-xs text-muted-foreground">The current repository structure passes the available architecture checks.</p></div></div>}</section>
      </div> : tab === "history" ? <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="ci-surface rounded-2xl p-5"><h2 className="mb-4 text-lg font-black">Recent commits</h2><div className="space-y-2">{history?.commits.map((commit) => <div key={commit.sha} className="rounded-xl border border-border p-3"><div className="flex gap-3"><GitCommit size={17} className="mt-0.5 shrink-0 text-cyan-300"/><div className="min-w-0"><p className="font-semibold">{commit.subject}</p><p className="mt-1 text-xs text-muted-foreground">{commit.shortSha} · {commit.author} · {fmtDate(commit.date)}</p></div></div></div>)}</div></section>
        <section className="ci-surface rounded-2xl p-5"><h2 className="mb-1 text-lg font-black">File churn</h2><p className="mb-4 text-xs text-muted-foreground">Higher churn can indicate maintenance hotspots.</p><div className="space-y-3">{topChurn.map((item) => <div key={item.file} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm"><span className="truncate">{item.file}</span><span className="rounded-lg bg-muted px-2 py-1 text-xs font-bold">{item.changes}</span></div>)}</div></section>
      </div> : tab === "hotspots" ? <section className="ci-surface overflow-hidden rounded-2xl"><div className="border-b border-border p-5"><h2 className="text-lg font-black">Code hotspots</h2><p className="text-xs text-muted-foreground">Hotspot score combines recent change frequency, file size and static complexity.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">File</th><th className="px-5 py-3">Score</th><th className="px-5 py-3">Changes</th><th className="px-5 py-3">Lines</th><th className="px-5 py-3">Complexity</th><th className="px-5 py-3">Risk</th></tr></thead><tbody>{hotspots.map((h) => <tr key={h.file} className="border-t border-border"><td className="max-w-[420px] truncate px-5 py-3 font-semibold">{h.file}</td><td className="px-5 py-3 font-black">{h.score}</td><td className="px-5 py-3">{h.changes}</td><td className="px-5 py-3">{h.lines}</td><td className="px-5 py-3">{h.complexity}</td><td className="px-5 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${badgeClass(h.risk)}`}>{h.risk}</span></td></tr>)}</tbody></table></div></section> : <div className="space-y-4">{drift?.findings.length ? drift.findings.map((f) => <section key={f.title} className="ci-surface rounded-2xl p-5"><div className="flex items-start justify-between gap-4"><div><div className="mb-1 flex items-center gap-2">{f.severity === "high" ? <AlertTriangle size={18} className="text-red-300"/> : <ShieldAlert size={18} className="text-amber-300"/>}<h2 className="font-black">{f.title}</h2></div><p className="text-sm text-muted-foreground">{f.detail}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${badgeClass(f.severity)}`}>{f.severity}</span></div>{f.files.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{f.files.map((file) => <span key={file} className="rounded-lg bg-muted px-2 py-1 text-xs font-mono">{file}</span>)}</div>}</section>) : <section className="ci-surface rounded-2xl p-8 text-center"><CheckCircle2 size={30} className="mx-auto mb-3 text-emerald-300"/><h2 className="font-black">Architecture aligned</h2><p className="mt-1 text-sm text-muted-foreground">No boundary or structural drift signals were detected in this scan.</p></section>}</div>}
    </div>
  </main>;
}
