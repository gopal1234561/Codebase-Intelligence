import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCode2,
  GitBranch,
  ListFilter,
  Network,
  Search,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Waypoints,
} from 'lucide-react';
import {
  getGetCodebaseFileQueryKey,
  getGetDependencyGraphQueryKey,
  getGetIntelligenceOverviewQueryKey,
  getListCodebaseFilesQueryKey,
  getListCodebaseRisksQueryKey,
  getListScanActivityQueryKey,
  useGetCodebaseFile,
  useGetDependencyGraph,
  useGetIntelligenceOverview,
  useListCodebaseFiles,
  useListCodebaseRisks,
  useListScanActivity,
} from '@workspace/api-client-react';
import type { CodebaseFile, DependencyNode, RiskFinding } from '@workspace/api-client-react';
import {
  EmptyRows,
  MetricCard,
  PageIntro,
  QueryState,
  RiskBadge,
} from '@/components/intelligence';

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatNumber(value?: number) {
  return typeof value === 'number' ? new Intl.NumberFormat('en').format(value) : '—';
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-center justify-between"><h2 className="font-mono text-[10px] font-medium uppercase tracking-[0.17em] text-muted-foreground">{children}</h2>{action}</div>;
}

export function OverviewPage() {
  const overview = useGetIntelligenceOverview({ query: { queryKey: getGetIntelligenceOverviewQueryKey() } });
  const risks = useListCodebaseRisks({ query: { queryKey: getListCodebaseRisksQueryKey() } });
  const activity = useListScanActivity({ query: { queryKey: getListScanActivityQueryKey() } });
  const overviewData = overview.data;
  const topRisks = risks.data?.slice(0, 3) ?? [];
  const recentActivity = activity.data?.slice(0, 4) ?? [];
  const languageTotal = overviewData?.languageBreakdown?.reduce((sum, item) => sum + item.files, 0) ?? 0;

  return (
    <>
      <PageIntro eyebrow="Repository overview" title={overviewData?.projectName ?? 'Codebase command center'} description="A compact read on how this repository is shaped, where it is under pressure, and what changed in the last scan." action={<Link href="/activity" className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:text-accent" data-testid="link-view-history">View scan history <ArrowUpRight size={14} /></Link>} />
      <QueryState loading={overview.isLoading} error={overview.isError} empty={!overviewData} onRetry={() => void overview.refetch()}>
        {overviewData && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Health score" value={`${overviewData.healthScore}`} note={`Last scan ${formatDate(overviewData.lastScanAt)}`} icon={BarChart3} accent={overviewData.healthScore >= 80 ? 'mint' : 'amber'} />
              <MetricCard label="Files indexed" value={formatNumber(overviewData.totalFiles)} note={`${formatNumber(overviewData.totalModules)} modules mapped`} icon={FileCode2} accent="blue" />
              <MetricCard label="Dependencies" value={formatNumber(overviewData.totalDependencies)} note="Edges across the repository" icon={Waypoints} accent="mint" />
              <MetricCard label="Open risks" value={formatNumber(overviewData.riskCount)} note="Prioritized for review" icon={ShieldAlert} accent={overviewData.riskCount > 0 ? 'coral' : 'mint'} />
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
              <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <SectionLabel action={<Link href="/files" className="text-xs font-bold text-muted-foreground hover:text-primary" data-testid="link-explore-files">Explore inventory <ArrowUpRight size={13} className="ml-1 inline" /></Link>}>Language mix</SectionLabel>
                {overviewData.languageBreakdown?.length ? <div className="space-y-5">{overviewData.languageBreakdown.map((item, index) => { const colors = ['bg-primary', 'bg-accent', 'bg-amber-400', 'bg-sky-400', 'bg-rose-400']; const percent = languageTotal ? Math.round((item.files / languageTotal) * 100) : item.percentage; return <div key={item.language} data-testid={`row-language-${item.language}`}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold">{item.language}</span><span className="font-mono text-muted-foreground">{percent}% <span className="ml-2 text-[10px]">{item.files} files</span></span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${colors[index % colors.length]}`} style={{ width: `${Math.min(percent, 100)}%` }} /></div></div>; })}</div> : <EmptyRows label="No language data returned." />}
                <div className="mt-7 grid grid-cols-3 gap-3 border-t border-border pt-5"><div><p className="font-mono text-lg font-medium">{formatNumber(overviewData.totalModules)}</p><p className="text-[11px] text-muted-foreground">modules</p></div><div><p className="font-mono text-lg font-medium">{formatNumber(overviewData.totalDependencies)}</p><p className="text-[11px] text-muted-foreground">edges</p></div><div><p className="font-mono text-lg font-medium">{overviewData.healthScore}/100</p><p className="text-[11px] text-muted-foreground">health</p></div></div>
              </section>
              <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <SectionLabel action={<Link href="/risks" className="text-xs font-bold text-muted-foreground hover:text-primary" data-testid="link-view-all-risks">View all <ArrowUpRight size={13} className="ml-1 inline" /></Link>}>Priority risks</SectionLabel>
                <QueryState loading={risks.isLoading} error={risks.isError} empty={!topRisks.length} onRetry={() => void risks.refetch()}>{topRisks.length ? <div className="space-y-1">{topRisks.map((risk) => <RiskRow key={risk.id} risk={risk} compact />)}</div> : null}</QueryState>
              </section>
            </div>
            <div className="grid gap-6 xl:grid-cols-[1fr_1.35fr]">
              <section className="rounded-xl border border-border bg-[#e6f3ee] p-6 shadow-xs">
                <p className="mb-7 font-mono text-[10px] font-medium uppercase tracking-[0.17em] text-emerald-800">Analyst note</p>
                <Sparkles className="mb-5 text-emerald-700" size={20} />
                <p className="max-w-md text-lg font-semibold leading-7 tracking-[-0.03em] text-emerald-950">Start with the files that sit at the center of the graph, not just the ones with the most lines.</p>
                <p className="mt-4 max-w-md text-sm leading-6 text-emerald-800/80">High fan-in modules amplify change. Use the graph to trace their callers before making a broad refactor.</p>
                <Link href="/graph" className="mt-6 inline-flex items-center gap-2 rounded-lg border border-emerald-800/20 bg-emerald-950 px-3.5 py-2.5 text-xs font-bold text-white" data-testid="link-open-graph">Open dependency graph <Network size={14} /></Link>
              </section>
              <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
                <SectionLabel action={<Link href="/activity" className="text-xs font-bold text-muted-foreground hover:text-primary" data-testid="link-view-activity">All activity <ArrowUpRight size={13} className="ml-1 inline" /></Link>}>Recent activity</SectionLabel>
                <QueryState loading={activity.isLoading} error={activity.isError} empty={!recentActivity.length} onRetry={() => void activity.refetch()}>{recentActivity.length ? <div className="divide-y divide-border">{recentActivity.map((item) => <div key={item.id} className="flex gap-3 py-4 first:pt-1" data-testid={`row-activity-${item.id}`}><ActivityDot type={item.type} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{item.title}</p><span className="font-mono text-[10px] text-muted-foreground">{formatDate(item.timestamp)}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></div></div>)}</div> : null}</QueryState>
              </section>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}

function ActivityDot({ type }: { type: string }) {
  const Icon = type === 'finding' ? CircleAlert : type === 'dependency' ? GitBranch : type === 'scan' ? RefreshCw : CheckCircle2;
  return <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"><Icon size={13} /></span>;
}

function RiskRow({ risk, compact = false }: { risk: RiskFinding; compact?: boolean }) {
  return <div className={`group rounded-lg ${compact ? 'p-3 hover:bg-muted/60' : 'border border-border bg-card p-5 shadow-xs'} transition-colors`} data-testid={`row-risk-${risk.id}`}><div className="flex items-start gap-3"><span className={`mt-1 size-2 shrink-0 rounded-full ${risk.severity === 'high' ? 'bg-rose-500' : risk.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold leading-5">{risk.title}</h3><RiskBadge risk={risk.severity} /></div><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{risk.detail}</p><div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span className="rounded bg-muted px-2 py-1 font-mono">{risk.file}</span>{!compact && <span>{risk.relatedFiles.length} related files</span>}</div>{!compact && <p className="mt-3 border-l-2 border-amber-300 pl-3 text-xs leading-5 text-amber-900/80"><strong>Impact:</strong> {risk.impact}</p>}</div></div></div>;
}

export function GraphPage() {
  const [groupBy, setGroupBy] = useState<'directory' | 'layer'>('directory');
  const [selectedId, setSelectedId] = useState<string>();
  const graph = useGetDependencyGraph(groupBy === 'directory' ? { groupBy: 'directory' } : { groupBy: 'layer' }, { query: { queryKey: getGetDependencyGraphQueryKey({ groupBy }) } });
  const nodes = graph.data?.nodes ?? [];
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const positions = useMemo(() => {
    return nodes.map((node, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      return { node, x: 100 + col * 164, y: 90 + row * 112 };
    });
  }, [nodes]);
  const positionMap = new Map(positions.map((item) => [item.node.id, item]));
  return (
    <>
      <PageIntro eyebrow="System map" title="Dependency graph" description="Trace the paths that make a module important. Group the view by directory or layer, then select a node to inspect its reach." action={<div className="flex items-center rounded-lg border border-border bg-card p-1" data-testid="control-graph-grouping"><button type="button" onClick={() => setGroupBy('directory')} className={`rounded-md px-3 py-2 text-xs font-bold ${groupBy === 'directory' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} data-testid="button-group-directory">Directory</button><button type="button" onClick={() => setGroupBy('layer')} className={`rounded-md px-3 py-2 text-xs font-bold ${groupBy === 'layer' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} data-testid="button-group-layer">Layer</button></div>} />
      <QueryState loading={graph.isLoading} error={graph.isError} empty={!nodes.length} onRetry={() => void graph.refetch()}>
        {nodes.length ? <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="overflow-hidden rounded-xl border border-border bg-[#152134] shadow-md"><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Live topology</p><p className="mt-1 text-sm font-semibold text-slate-200">{nodes.length} nodes <span className="mx-1 text-slate-600">/</span> {graph.data?.edges.length ?? 0} edges</p></div><span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-slate-400"><span className="size-1.5 rounded-full bg-accent" />{groupBy} view</span></div><div className="relative min-h-[500px] overflow-auto p-5" data-testid="graph-canvas"><svg viewBox="0 0 720 430" className="min-w-[680px]"><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" />{graph.data?.edges.map((edge, index) => { const source = positionMap.get(edge.source); const target = positionMap.get(edge.target); if (!source || !target) return null; return <path key={`${edge.source}-${edge.target}-${index}`} d={`M ${source.x + 54} ${source.y + 19} C ${(source.x + target.x) / 2 + 22} ${source.y}, ${(source.x + target.x) / 2 - 22} ${target.y + 38}, ${target.x - 3} ${target.y + 19}`} fill="none" stroke={edge.kind === 'reference' ? '#64748b' : '#63d4b2'} strokeDasharray={edge.kind === 'reference' ? '5 5' : undefined} strokeOpacity=".52" strokeWidth="1.3" />; })}{positions.map(({ node, x, y }) => <g key={node.id} transform={`translate(${x},${y})`} onClick={() => setSelectedId(node.id)} className="cursor-pointer" data-testid={`graph-node-${node.id}`}><rect width="108" height="39" rx="7" fill={selected?.id === node.id ? '#63d4b2' : '#22334b'} stroke={selected?.id === node.id ? '#b4f3dd' : node.risk === 'high' ? '#e58a7f' : '#3b506b'} strokeWidth={selected?.id === node.id ? '2' : '1'} /><circle cx="13" cy="19.5" r="4" fill={node.risk === 'high' ? '#e58a7f' : node.risk === 'medium' ? '#efc16d' : '#63d4b2'} /><text x="24" y="17" fill={selected?.id === node.id ? '#14202f' : '#e2e8f0'} fontSize="10" fontWeight="600">{node.label.length > 13 ? `${node.label.slice(0, 12)}…` : node.label}</text><text x="24" y="30" fill={selected?.id === node.id ? '#355e53' : '#8495ab'} fontSize="8">{node.importedBy} callers</text></g>)}</svg></div><div className="flex flex-wrap items-center gap-4 border-t border-white/10 px-5 py-3 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#63d4b2]" />import</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#64748b]" />reference</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-[#e58a7f]" />high risk node</span></div></section><GraphDetails node={selected} /></div> : null}
      </QueryState>
    </>
  );
}

function GraphDetails({ node }: { node?: DependencyNode }) {
  if (!node) return <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Select a node to inspect it.</div>;
  return <aside className="rounded-xl border border-border bg-card shadow-xs" data-testid="panel-node-details"><div className="border-b border-border p-6"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Selected module</p><div className="mt-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold tracking-[-0.04em]">{node.label}</h2><p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{node.path}</p></div><RiskBadge risk={node.risk} /></div></div><div className="space-y-6 p-6"><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted p-3"><p className="font-mono text-xl">{node.lines}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">lines</p></div><div className="rounded-lg bg-muted p-3"><p className="font-mono text-xl">{node.imports}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">imports</p></div><div className="rounded-lg bg-muted p-3"><p className="font-mono text-xl">{node.importedBy}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">imported by</p></div><div className="rounded-lg bg-muted p-3"><p className="font-mono text-xl">{node.language}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">language</p></div></div><div><p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Directory</p><p className="rounded-lg border border-border px-3 py-2 font-mono text-xs">{node.directory}</p></div><Link href={`/files?path=${encodeURIComponent(node.path)}`} className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground" data-testid="link-open-selected-file">Open file intelligence <ArrowUpRight size={14} /></Link></div></aside>;
}

export function FilesPage() {
  const [location] = useLocation();
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [language, setLanguage] = useState('');
  const queryPath = new URLSearchParams(location.split('?')[1] ?? '').get('path') ?? '';
  const [selectedPath, setSelectedPath] = useState(queryPath);
  const params = { search: search || undefined, risk, language: language || undefined, limit: 100 };
  const files = useListCodebaseFiles(params, { query: { queryKey: getListCodebaseFilesQueryKey(params) } });
  const detail = useGetCodebaseFile(selectedPath, { query: { enabled: Boolean(selectedPath), queryKey: getGetCodebaseFileQueryKey(selectedPath) } });
  const data = files.data ?? [];
  const languages = [...new Set(data.map((file) => file.language))].sort();
  return (
    <>
      <PageIntro eyebrow="Inventory" title="Files" description="Search the complete file inventory and understand the complexity, blast radius, and risk of every module." />
      <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs lg:flex-row"><div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search paths, names, or summaries" className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none ring-ring focus:ring-2" data-testid="input-file-search" /></div><div className="flex gap-2"><select value={risk} onChange={(event) => setRisk(event.target.value as typeof risk)} className="h-10 rounded-lg border border-input bg-background px-3 text-xs font-semibold outline-none" data-testid="select-file-risk"><option value="all">All risk</option><option value="high">High risk</option><option value="medium">Medium risk</option><option value="low">Low risk</option></select><select value={language} onChange={(event) => setLanguage(event.target.value)} className="h-10 max-w-[150px] rounded-lg border border-input bg-background px-3 text-xs font-semibold outline-none" data-testid="select-file-language"><option value="">All languages</option>{languages.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>
      <QueryState loading={files.isLoading} error={files.isError} empty={!data.length} onRetry={() => void files.refetch()}><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"><div className="flex items-center justify-between border-b border-border px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{data.length} files matched</p><span className="text-xs text-muted-foreground">Select a row for detail</span></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-muted/60"><tr className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground"><th className="px-5 py-3 font-medium">File</th><th className="px-4 py-3 font-medium">Language</th><th className="px-4 py-3 font-medium">Lines</th><th className="px-4 py-3 font-medium">Complexity</th><th className="px-5 py-3 font-medium">Risk</th></tr></thead><tbody className="divide-y divide-border">{data.map((file) => <FileRow key={file.path} file={file} selected={selectedPath === file.path} onSelect={() => setSelectedPath(file.path)} />)}</tbody></table></div></section><FileDetailPanel loading={detail.isLoading} error={detail.isError} file={detail.data} /></div></QueryState>
    </>
  );
}

function FileRow({ file, selected, onSelect }: { file: CodebaseFile; selected: boolean; onSelect: () => void }) {
  return <tr className={`cursor-pointer transition-colors hover:bg-muted/60 ${selected ? 'bg-emerald-50/60' : ''}`} onClick={onSelect} data-testid={`row-file-${file.path}`}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-muted text-muted-foreground"><FileCode2 size={15} /></span><div><p className="font-mono text-xs font-medium">{file.name}</p><p className="mt-1 max-w-[310px] truncate text-[11px] text-muted-foreground">{file.directory}</p></div></div></td><td className="px-4 py-4 font-mono text-xs text-muted-foreground">{file.language}</td><td className="px-4 py-4 font-mono text-xs">{formatNumber(file.lines)}</td><td className="px-4 py-4"><span className={`font-mono text-xs ${file.complexity > 15 ? 'text-rose-700' : file.complexity > 8 ? 'text-amber-700' : 'text-muted-foreground'}`}>{file.complexity}</span></td><td className="px-5 py-4"><RiskBadge risk={file.risk} /></td></tr>;
}

function FileDetailPanel({ loading, error, file }: { loading: boolean; error: boolean; file?: any }) {
  return <aside className="rounded-xl border border-border bg-card shadow-xs" data-testid="panel-file-details"><div className="border-b border-border p-6"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">File intelligence</p>{!file && !loading && !error && <div className="py-12 text-center"><FileCode2 className="mx-auto mb-3 text-muted-foreground" size={24} /><p className="text-sm font-semibold">Select a file</p><p className="mt-1 text-xs text-muted-foreground">Trace imports, symbols, and the excerpt here.</p></div>}{loading && <div className="mt-5 space-y-2"><div className="h-5 animate-pulse rounded bg-muted" /><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /></div>}{error && <p className="mt-5 text-sm text-rose-700">Detail unavailable for this file.</p>}{file && <><div className="mt-4 flex items-start justify-between gap-3"><h2 className="break-all text-base font-extrabold tracking-[-0.03em]">{file.name}</h2><RiskBadge risk={file.risk} /></div><p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{file.path}</p><p className="mt-4 text-xs leading-5 text-muted-foreground">{file.summary}</p></>}</div>{file && <div className="space-y-6 p-6"><div className="grid grid-cols-2 gap-3"><div><p className="font-mono text-lg">{file.lines}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">lines</p></div><div><p className="font-mono text-lg">{file.complexity}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">complexity</p></div></div><DetailList label="Imports" items={file.imports} /><DetailList label="Imported by" items={file.importedBy} /><DetailList label="Symbols" items={file.symbols} /><div><p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Excerpt</p><pre className="max-h-48 overflow-auto rounded-lg bg-[#152134] p-3 font-mono text-[10px] leading-5 text-slate-300">{file.excerpt}</pre></div></div>}</aside>;
}

function DetailList({ label, items }: { label: string; items: string[] }) {
  return <div><p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label} <span className="text-foreground">({items.length})</span></p>{items.length ? <div className="space-y-1.5">{items.slice(0, 4).map((item) => <p key={item} className="truncate rounded bg-muted px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">{item}</p>)}</div> : <p className="text-xs text-muted-foreground">None detected</p>}</div>;
}

export function RisksPage() {
  const risks = useListCodebaseRisks({ query: { queryKey: getListCodebaseRisksQueryKey() } });
  const [severity, setSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const data = (risks.data ?? []).filter((risk) => severity === 'all' || risk.severity === severity);
  return <><PageIntro eyebrow="Prioritization" title="Risk register" description="Findings are ordered by severity and potential blast radius so review time goes where it matters." action={<div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><ListFilter size={14} /><select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)} className="bg-transparent font-semibold text-foreground outline-none" data-testid="select-risk-severity"><option value="all">All findings</option><option value="high">High severity</option><option value="medium">Medium severity</option><option value="low">Low severity</option></select></div>} /><QueryState loading={risks.isLoading} error={risks.isError} empty={!data.length} onRetry={() => void risks.refetch()}><div className="grid gap-4">{data.map((risk, index) => <div key={risk.id} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]"><RiskRow risk={risk} /><div className="hidden rounded-xl border border-border bg-card p-5 lg:block"><p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Finding {String(index + 1).padStart(2, '0')}</p><p className="text-xs leading-5 text-muted-foreground">{risk.relatedFiles.length} related files share this concern.</p><div className="mt-4 space-y-2">{risk.relatedFiles.slice(0, 3).map((file) => <Link key={file} href={`/files?path=${encodeURIComponent(file)}`} className="block truncate font-mono text-[10px] text-primary hover:text-accent" data-testid={`link-related-file-${risk.id}-${file}`}>{file}</Link>)}</div></div></div>)}</div></QueryState></>;
}

export function ActivityPage() {
  const activity = useListScanActivity({ query: { queryKey: getListScanActivityQueryKey() } });
  const [type, setType] = useState('all');
  const data = (activity.data ?? []).filter((item) => type === 'all' || item.type === type);
  return <><PageIntro eyebrow="Timeline" title="Activity" description="A trace of scans, dependency analysis, and findings as the repository changes over time." action={<div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><Clock3 size={14} /><select value={type} onChange={(event) => setType(event.target.value)} className="bg-transparent font-semibold text-foreground outline-none" data-testid="select-activity-type"><option value="all">Everything</option><option value="scan">Scans</option><option value="finding">Findings</option><option value="dependency">Dependencies</option><option value="system">System</option></select></div>} /><QueryState loading={activity.isLoading} error={activity.isError} empty={!data.length} onRetry={() => void activity.refetch()}><section className="rounded-xl border border-border bg-card p-6 shadow-xs"><div className="relative ml-3 border-l border-border">{data.map((item) => <div key={item.id} className="relative pb-8 pl-8 last:pb-0" data-testid={`row-activity-detail-${item.id}`}><span className="absolute -left-[9px] top-0 grid size-[17px] place-items-center rounded-full border-4 border-card bg-accent" /><div className="flex flex-col justify-between gap-2 md:flex-row"><div><div className="mb-1 flex items-center gap-2"><span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{item.type}</span><span className="text-border">/</span><span className="font-mono text-[10px] text-muted-foreground">{formatDate(item.timestamp)}</span></div><h2 className="text-sm font-bold">{item.title}</h2><p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground">{item.detail}</p></div><span className="font-mono text-[10px] text-muted-foreground">{item.id}</span></div></div>)}</div></section></QueryState></>;
}
