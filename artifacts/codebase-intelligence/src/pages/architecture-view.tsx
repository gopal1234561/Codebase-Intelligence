import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, Network, RefreshCw, Search, X, Github } from "lucide-react";
import { Link } from "wouter";

type Risk = "high" | "medium" | "low";
type Node = { id:string; label:string; path:string; directory:string; language:string; lines:number; imports:number; importedBy:number; risk:Risk };
type Edge = { source:string; target:string; kind:string };
type Graph = { nodes:Node[]; edges:Edge[] };
const api=async<T,>(url:string):Promise<T>=>{const r=await fetch(`/api${url}`);const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||"Request failed");return b as T};
const bucket=(n:Node)=>{const p=n.path.toLowerCase();if(/package\.json|requirements\.txt|pom\.xml|cargo\.toml|go\.mod/.test(p))return"Dependencies";if(/db|database|schema|migration|model/.test(p))return"Data";if(/api|route|server|service|controller|handler/.test(p))return"Backend";if(/component|page|view|ui|client|frontend/.test(p))return"Frontend";if(/test|spec/.test(p))return"Tests";return"Core"};
const layerOrder=["Frontend","Backend","Data","Core","Dependencies","Tests"];
function Diagram({g,selected,onSelect}:{g:Graph;selected:Node|null;onSelect:(n:Node)=>void}){
  const shown=g.nodes.slice(0,36);
  const groups=layerOrder.map(layer=>({layer,nodes:shown.filter(n=>bucket(n)===layer)})).filter(x=>x.nodes.length);
  const width=1120;
  const rowHeight=125;
  const top=35;
  const nodeW=150;
  const nodeH=48;
  const positions=new Map<string,{x:number;y:number}>();
  groups.forEach((group,row)=>{
    const gap=22;
    const total=group.nodes.length*nodeW+(group.nodes.length-1)*gap;
    const start=Math.max(24,(width-total)/2);
    group.nodes.forEach((n,i)=>positions.set(n.id,{x:start+i*(nodeW+gap),y:top+row*rowHeight+35}));
  });
  const ids=new Set(positions.keys());
  const height=Math.max(520,top+groups.length*rowHeight+30);
  return <div className="overflow-auto rounded-2xl border border-border bg-card/90 p-3 shadow-lg">
    <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[900px] w-full">
      <defs><marker id="architecture-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" fill="currentColor"/></marker></defs>
      {groups.map((group,row)=><g key={group.layer}>
        <text x="24" y={top+row*rowHeight+16} fontSize="10" fontWeight="800" letterSpacing="1.5" fill="currentColor" opacity=".6">{group.layer.toUpperCase()}</text>
        <line x1="24" x2={width-24} y1={top+row*rowHeight+24} y2={top+row*rowHeight+24} stroke="currentColor" opacity=".08"/>
      </g>)}
      {g.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).slice(0,150).map((e,i)=>{
        const a=positions.get(e.source)!;const b=positions.get(e.target)!;
        const sameRow=Math.abs(a.y-b.y)<2;
        const x1=a.x+nodeW/2,y1=a.y+nodeH,x2=b.x+nodeW/2,y2=b.y;
        const d=sameRow?`M ${x1} ${a.y+nodeH/2} C ${x1+(x2-x1)/2} ${a.y+nodeH/2}, ${x2-(x2-x1)/2} ${b.y+nodeH/2}, ${x2} ${b.y+nodeH/2}`:`M ${x1} ${y1} C ${x1} ${y1+28}, ${x2} ${y2-28}, ${x2} ${y2}`;
        return <path key={i} d={d} fill="none" stroke="currentColor" opacity=".2" markerEnd="url(#architecture-arrow)"/>;
      })}
      {groups.map(group=>group.nodes.map(n=>{const p=positions.get(n.id)!;return <g key={n.id} transform={`translate(${p.x},${p.y})`} onClick={()=>onSelect(n)} className="cursor-pointer">
        <rect width={nodeW} height={nodeH} rx="11" className={selected?.id===n.id?"fill-primary/15 stroke-primary":"fill-background stroke-border"}/>
        <text x={nodeW/2} y="19" textAnchor="middle" fontSize="9" fontWeight="700">{n.label.length>20?n.label.slice(0,19)+"…":n.label}</text>
        <text x={nodeW/2} y="34" textAnchor="middle" fontSize="7" opacity=".55">{n.language} · {n.risk} risk</text>
      </g>}))}
      {groups.slice(0,-1).map((_,row)=><g key={`flow-${row}`}>
        <circle cx={width/2} cy={top+row*rowHeight+108} r="14" className="fill-primary/10 stroke-primary/30"/>
        <path d={`M ${width/2} ${top+row*rowHeight+101} L ${width/2} ${top+row*rowHeight+115}`} stroke="currentColor" strokeWidth="1.5" markerEnd="url(#architecture-arrow)"/>
      </g>)}
    </svg>
  </div>
}
export default function ArchitectureView(){const[g,setG]=useState<Graph|null>(null);const[s,setS]=useState<Node|null>(null);const[q,setQ]=useState("");const[loading,setLoading]=useState(true);const[error,setError]=useState("");const load=async()=>{setLoading(true);setError("");try{setG(await api<Graph>("/repository/graph"))}catch(e){setError(e instanceof Error?e.message:"Analyze a repository first")}finally{setLoading(false)}};useEffect(()=>{void load()},[]);const f=g?{nodes:g.nodes.filter(n=>`${n.path} ${n.label} ${n.language}`.toLowerCase().includes(q.toLowerCase())),edges:g.edges}:null;return <div className="min-h-screen bg-background text-foreground"><header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center gap-3"><Link href="/dashboard" className="grid size-9 place-items-center rounded-lg border border-border bg-card hover:bg-muted"><ArrowLeft size={17}/></Link><Network className="text-primary"/><div className="flex-1"><p className="font-extrabold">Architecture Diagram Generator</p><p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Feature #16 · repository grounded</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold hover:bg-muted"><RefreshCw size={14}/>Regenerate</button></div></header><main className="mx-auto max-w-[1500px] p-4 sm:p-6 md:p-8"><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">See how your codebase is actually connected.</h1><p className="mt-3 text-sm text-muted-foreground">Generated from the same scanned dependency graph used by the workspace. The architecture is arranged as a top-to-bottom flow so the major layers are easy to follow.</p>{loading&&<div className="grid min-h-[430px] place-items-center"><LoaderCircle className="animate-spin text-primary"/></div>}{!loading&&error&&<section className="ci-empty-state mt-8 overflow-hidden rounded-3xl p-7 sm:p-10 md:p-14"><div className="max-w-2xl"><div className="ci-empty-icon mb-6 grid size-14 place-items-center rounded-2xl"><Network size={27}/></div><p className="font-mono text-[10px] font-bold uppercase tracking-[.24em] text-indigo-200">Workspace not connected</p><h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">No repository scanned yet</h2><p className="mt-4 max-w-xl text-sm leading-7 text-indigo-100">Analyze a public GitHub repository from the main workspace first. Once the scan finishes, this page will automatically use the real dependency graph to generate your architecture.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/dashboard" className="ci-empty-action inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold"><Github size={17}/> Analyze a repository</Link><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15"><RefreshCw size={16}/> Check again</button></div><p className="mt-5 text-xs text-indigo-200">Main workspace → paste GitHub URL → Analyze repository</p></div></section>}{!loading&&f&&<><div className="my-5 grid gap-4 sm:grid-cols-3"><div className="ci-surface rounded-xl border p-4 shadow-sm"><p className="text-[10px] uppercase text-muted-foreground">Files</p><p className="mt-2 text-2xl font-bold">{f.nodes.length}</p></div><div className="ci-surface rounded-xl border p-4 shadow-sm"><p className="text-[10px] uppercase text-muted-foreground">Relationships</p><p className="mt-2 text-2xl font-bold">{f.edges.length}</p></div><div className="ci-surface rounded-xl border p-4 shadow-sm"><p className="text-[10px] uppercase text-muted-foreground">Risk nodes</p><p className="mt-2 text-2xl font-bold">{f.nodes.filter(n=>n.risk!=="low").length}</p></div></div><div className="mb-5 flex items-center gap-2 rounded-xl border border-border bg-card/90 px-3 shadow-sm"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search files or languages…" className="flex-1 bg-transparent py-3 text-sm outline-none"/></div><Diagram g={f} selected={s} onSelect={setS}/><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]"><section className="ci-surface rounded-2xl border p-5 shadow-sm"><h2 className="font-extrabold">Architecture layers</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...new Set(f.nodes.map(bucket))].map(x=><div key={x} className="ci-interactive rounded-xl border bg-card/70 p-4 text-sm font-bold">{x}<span className="float-right font-mono text-xs text-muted-foreground">{f.nodes.filter(n=>bucket(n)===x).length}</span></div>)}</div></section><aside className="ci-surface rounded-2xl border p-5 shadow-sm">{s?<><div className="flex justify-between"><div><p className="text-[10px] uppercase text-muted-foreground">Selected module</p><h2 className="font-bold">{s.label}</h2></div><button onClick={()=>setS(null)}><X size={15}/></button></div><p className="mt-4 break-all rounded-lg bg-muted p-3 font-mono text-xs">{s.path}</p><p className="mt-3 text-xs">{s.language} · {s.lines} lines · {s.risk} risk</p><p className="mt-2 text-xs">Imports: {s.imports} · Dependents: {s.importedBy}</p><Link href={`/impact?file=${encodeURIComponent(s.path)}`} className="mt-4 inline-flex w-full justify-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Open impact analysis</Link></>:<div className="py-8 text-center"><p className="font-bold">Inspect a module</p><p className="mt-2 text-xs text-muted-foreground">Click a node in the generated diagram.</p></div>}</aside></div></>}</main></div>}
