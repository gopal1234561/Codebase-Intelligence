import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Check,
  ChevronRight,
  CircleDot,
  Command,
  FileCode2,
  LayoutDashboard,
  LoaderCircle,
  Network,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
  X,
} from 'lucide-react';
import {
  getGetDependencyGraphQueryKey,
  getGetIntelligenceOverviewQueryKey,
  getHealthCheckQueryKey,
  getListCodebaseFilesQueryKey,
  getListCodebaseRisksQueryKey,
  getListScanActivityQueryKey,
  useHealthCheck,
  useStartCodebaseScan,
} from '@workspace/api-client-react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/graph', label: 'Dependency graph', icon: Network },
  { href: '/files', label: 'Files', icon: FileCode2 },
  { href: '/risks', label: 'Risk register', icon: ShieldAlert },
  { href: '/activity', label: 'Activity', icon: Activity },
];

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState('');
  const queryClient = useQueryClient();
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey() } });
  const scan = useStartCodebaseScan();

  const triggerScan = () => {
    setScanNotice('');
    scan.mutate(
      { data: { scope: 'full' } },
      {
        onSuccess: (result) => {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: getGetIntelligenceOverviewQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getGetDependencyGraphQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getListCodebaseFilesQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getListCodebaseRisksQueryKey() }),
            queryClient.invalidateQueries({ queryKey: getListScanActivityQueryKey() }),
          ]);
          setScanNotice(`Scan ${result.scanId} accepted`);
        },
        onError: () => setScanNotice('Scan could not be started'),
      },
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground lg:flex">
      <aside className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[278px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:relative lg:translate-x-0`}>
        <div className="flex h-[76px] items-center justify-between border-b border-sidebar-border px-6">
          <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
            <span className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
              <Command size={19} strokeWidth={2.5} />
            </span>
            <span>
              <span className="block text-[15px] font-extrabold tracking-[-0.03em] text-white">Codebase</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.19em] text-slate-400">intelligence</span>
            </span>
          </Link>
          <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-sidebar-accent lg:hidden" onClick={() => setMobileOpen(false)} data-testid="button-close-navigation">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 pt-7">
          <p className="mb-3 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.17em] text-slate-500">Workspace</p>
          <nav className="space-y-1" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-colors ${active ? 'bg-sidebar-accent text-white' : 'text-slate-400 hover:bg-sidebar-accent/70 hover:text-slate-100'}`}
                  data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon size={17} className={active ? 'text-sidebar-primary' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span>{item.label}</span>
                  {active && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto p-4">
          <div className="rounded-xl border border-sidebar-border bg-[#1e293c] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Repository</span>
              <span className={`flex items-center gap-1.5 font-mono text-[10px] ${health.isError ? 'text-rose-300' : 'text-sidebar-primary'}`} data-testid="status-health">
                <span className={`size-1.5 rounded-full ${health.isError ? 'bg-rose-400' : 'bg-sidebar-primary'}`} />
                {health.isLoading ? 'checking' : health.isError ? 'offline' : 'online'}
              </span>
            </div>
            <p className="truncate font-mono text-xs text-slate-200" data-testid="text-repository-name">atlas-web / main</p>
            <p className="mt-1 text-[11px] text-slate-500">Local analysis workspace</p>
          </div>
          <div className="mt-4 flex items-center gap-2 px-2 text-[11px] text-slate-500">
            <CircleDot size={12} className="text-sidebar-primary" />
            <span>Read-only analysis mode</span>
          </div>
        </div>
      </aside>
      {mobileOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setMobileOpen(false)} data-testid="button-navigation-overlay" />}
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <button type="button" className="rounded-lg border border-border bg-card p-2 text-muted-foreground lg:hidden" onClick={() => setMobileOpen(true)} data-testid="button-open-navigation">
              <Command size={17} />
            </button>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <TerminalSquare size={15} />
              <span className="font-mono">atlas-web</span>
              <ChevronRight size={13} />
              <span className="text-foreground">{navItems.find((item) => item.href === location)?.label ?? 'Workspace'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {scanNotice && <span className={`hidden text-xs md:block ${scanNotice.includes('could') ? 'text-destructive' : 'text-emerald-700'}`} data-testid="status-scan-notice">{scanNotice}</span>}
            <button type="button" onClick={triggerScan} disabled={scan.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-px disabled:cursor-wait disabled:opacity-70" data-testid="button-start-scan">
              {scan.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              <span>{scan.isPending ? 'Scanning' : 'Run scan'}</span>
            </button>
            <div className="grid size-9 place-items-center rounded-full border border-border bg-card font-mono text-xs font-semibold text-muted-foreground" data-testid="avatar-current-user">AR</div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1500px] p-5 md:p-8">{children}</div>
      </main>
    </div>
  );
}

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        <p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.19em] text-muted-foreground"><span className="size-1.5 rounded-full bg-accent" />{eyebrow}</p>
        <h1 className="text-[clamp(1.8rem,4vw,2.7rem)] font-extrabold leading-none tracking-[-0.055em] text-foreground" data-testid="text-page-title">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function MetricCard({ label, value, note, icon: Icon, accent = 'mint' }: { label: string; value: string | number; note: string; icon: typeof Boxes; accent?: 'mint' | 'amber' | 'coral' | 'blue' }) {
  const accentClass = { mint: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', coral: 'bg-rose-50 text-rose-700', blue: 'bg-sky-50 text-sky-700' }[accent];
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs" data-testid={`card-metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
        <span className={`grid size-8 place-items-center rounded-lg ${accentClass}`}><Icon size={16} /></span>
      </div>
      <p className="mt-5 font-mono text-[29px] font-medium tracking-[-0.08em] text-foreground" data-testid={`text-metric-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function LoadingState({ lines = 4 }: { lines?: number }) {
  return <div className="space-y-3" data-testid="state-loading">{Array.from({ length: lines }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div>;
}

export function QueryState({ loading, error, empty, onRetry, children }: { loading: boolean; error: boolean; empty: boolean; onRetry?: () => void; children: ReactNode }) {
  if (loading) return <LoadingState />;
  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-8 text-center" data-testid="state-error"><AlertTriangle className="mx-auto mb-3 text-rose-600" size={22} /><p className="font-semibold text-rose-900">We could not load this analysis</p><p className="mt-1 text-sm text-rose-700">The repository service may be catching up.</p>{onRetry && <button type="button" onClick={onRetry} className="mt-4 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white" data-testid="button-retry">Try again</button>}</div>;
  if (empty) return <div className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center" data-testid="state-empty"><Sparkles className="mx-auto mb-3 text-muted-foreground" size={22} /><p className="font-semibold">Nothing here yet</p><p className="mt-1 text-sm text-muted-foreground">Run a scan to populate this view.</p></div>;
  return <>{children}</>;
}

export function RiskBadge({ risk }: { risk: string }) {
  const styles: Record<string, string> = { high: 'border-rose-200 bg-rose-50 text-rose-700', medium: 'border-amber-200 bg-amber-50 text-amber-700', low: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] ${styles[risk] ?? styles.low}`} data-testid={`badge-risk-${risk}`}>{risk}</span>;
}

export function EmptyRows({ label }: { label: string }) {
  return <div className="flex items-center justify-center p-12 text-sm text-muted-foreground" data-testid="state-empty-rows">{label}</div>;
}