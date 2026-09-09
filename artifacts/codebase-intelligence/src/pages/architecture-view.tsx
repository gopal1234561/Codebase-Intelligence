import { Link } from "wouter";
import { ArrowDown, ArrowLeft, BrainCircuit, Boxes, Database, Github, Layers3, Network, ScanSearch, Server, ShieldCheck, Sparkles } from "lucide-react";

type LayerProps = { icon: React.ReactNode; eyebrow: string; title: string; description: string; children?: React.ReactNode };

function Layer({ icon, eyebrow, title, description, children }: LayerProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          {children}
        </div>
      </div>
    </section>
  );
}

function FlowArrow() {
  return <div className="flex justify-center py-2 text-primary"><div className="flex flex-col items-center"><div className="h-5 w-px bg-border"/><ArrowDown size={18}/></div></div>;
}

function MiniCard({ title, text, icon }: { title: string; text: string; icon: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-background p-4"><div className="flex items-center gap-2 text-sm font-bold">{icon}{title}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>;
}

export default function ArchitectureView() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link href="/" className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card"><ArrowLeft size={17}/></Link>
          <div><p className="font-extrabold">Codebase Intelligence</p><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">System architecture</p></div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 sm:p-6 md:p-8">
        <div className="mb-7 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">How the system works</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Codebase Intelligence Architecture</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">A vertical view of the platform: a repository enters at the top, passes through scanning and intelligence layers, and becomes actionable insights in the dashboard.</p>
        </div>

        <div className="mx-auto max-w-3xl">
          <Layer icon={<Github size={21}/>} eyebrow="1 · Input" title="GitHub Repository" description="The user provides a public GitHub repository URL. The system uses the repository as the source of truth for the analysis.">
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs">https://github.com/owner/repository</div>
          </Layer>

          <FlowArrow />

          <Layer icon={<ScanSearch size={21}/>} eyebrow="2 · Ingestion" title="Repository Scanner & Indexer" description="The backend reads the repository, indexes source files, identifies languages, extracts imports, and builds the analysis dataset.">
            <div className="mt-4 grid gap-3 sm:grid-cols-3"><MiniCard title="Clone / read" text="Load repository contents safely for analysis." icon={<Github size={15}/>} /><MiniCard title="File index" text="Catalog files, languages, lines and symbols." icon={<Database size={15}/>} /><MiniCard title="Dependency map" text="Resolve imports and relationships between modules." icon={<Network size={15}/>} /></div>
          </Layer>

          <FlowArrow />

          <Layer icon={<Layers3 size={21}/>} eyebrow="3 · Analysis engine" title="Code Analysis Engine" description="The indexed code is processed by multiple analyzers. These analyzers produce structured findings instead of simply displaying raw files.">
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><MiniCard title="Architecture analyzer" text="Identifies application structure, modules and dependency relationships." icon={<Network size={15}/>} /><MiniCard title="Security analyzer" text="Looks for security-related risks and suspicious patterns." icon={<ShieldCheck size={15}/>} /><MiniCard title="Quality analyzer" text="Evaluates complexity, large files and maintainability signals." icon={<Boxes size={15}/>} /><MiniCard title="Risk analyzer" text="Prioritizes findings by severity and potential impact." icon={<ScanSearch size={15}/>} /></div>
          </Layer>

          <FlowArrow />

          <Layer icon={<BrainCircuit size={21}/>} eyebrow="4 · Intelligence" title="Codebase Intelligence Layer" description="The analysis results are converted into higher-level engineering insights that help a developer understand the system quickly.">
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><MiniCard title="Security insights" text="Security score, findings and review priorities." icon={<ShieldCheck size={15}/>} /><MiniCard title="Code quality" text="Quality signals and complexity hotspots." icon={<Boxes size={15}/>} /><MiniCard title="Technical debt" text="Debt score based on risks, complexity and large files." icon={<Layers3 size={15}/>} /><MiniCard title="AI assistant" text="Natural-language questions about architecture, risks and dependencies." icon={<Sparkles size={15}/>} /></div>
          </Layer>

          <FlowArrow />

          <Layer icon={<Server size={21}/>} eyebrow="5 · Application API" title="API Server" description="The backend exposes the analyzed repository data to the frontend through API endpoints for overview, files, risks, activity, graph data and source inspection.">
            <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4"><div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono"><span className="rounded-md bg-background px-2 py-1">/repository/overview</span><span className="rounded-md bg-background px-2 py-1">/repository/files</span><span className="rounded-md bg-background px-2 py-1">/repository/risks</span><span className="rounded-md bg-background px-2 py-1">/repository/graph</span><span className="rounded-md bg-background px-2 py-1">/repository/file/:path</span></div></div>
          </Layer>

          <FlowArrow />

          <Layer icon={<Sparkles size={21}/>} eyebrow="6 · Output" title="React Intelligence Dashboard" description="The frontend presents the results as scores, architecture, security findings, code review, technical debt, files, activity and interactive source inspection.">
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><MiniCard title="Overview" text="Health score, repository metrics and priority risks." icon={<Boxes size={15}/>} /><MiniCard title="Architecture" text="Understand the system flow from repository to intelligence." icon={<Network size={15}/>} /><MiniCard title="Risk register" text="Review prioritized findings and affected source files." icon={<ShieldCheck size={15}/>} /><MiniCard title="Ask your codebase" text="Explore the repository through natural-language questions." icon={<BrainCircuit size={15}/>} /></div>
          </Layer>

          <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center sm:p-6"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">End-to-end flow</p><p className="mt-2 text-sm font-bold leading-7">GitHub Repository → Scanner → Analysis Engine → Intelligence Layer → API Server → React Dashboard</p></div>
        </div>
      </main>
    </div>
  );
}
