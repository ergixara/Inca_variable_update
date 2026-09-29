import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, Check, ChevronDown, FileCode2, FileSearch2, LockKeyhole, RotateCcw, Search, ShieldCheck, Shuffle, Upload, X } from "lucide-react";
import { parseA2lMeasurements } from "@/lib/a2l-match";
import { decodeProjectBytes, patchProject, planProject, type ProjectPlan, type ProjectRecord } from "@/lib/prj-a2l";

export const Route = createFileRoute("/")({ component: Home });

type Analysis = { plan: ProjectPlan; outputBytes: Uint8Array; projectName: string; a2lName: string };
type Filter = "all" | "change" | "unmatched" | "already" | "no-inca";

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Home() {
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [a2lFile, setA2lFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const records = analysis?.plan.records ?? [];
    const term = search.trim().toLowerCase();
    return records.filter((record) =>
      (filter === "all" || record.status === filter) &&
      (!term || `${record.did} ${record.currentName ?? ""} ${record.selectedName ?? ""}`.toLowerCase().includes(term)),
    );
  }, [analysis, filter, search]);

  function updateProject(file: File | null) {
    setProjectFile(file);
    setAnalysis(null);
    setError(null);
  }

  function updateA2l(file: File | null) {
    setA2lFile(file);
    setAnalysis(null);
    setError(null);
  }

  async function analyze() {
    if (!projectFile || !a2lFile) return;
    setBusy(true);
    setError(null);
    setAnalysis(null);
    setFilter("all");
    setSearch("");
    try {
      if (!/\.prj$/i.test(projectFile.name)) throw new Error("Choose an ETAS .prj project file.");
      if (!/\.a2l$/i.test(a2lFile.name)) throw new Error("Choose an .a2l description file.");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 30));
      const [projectBuffer, a2lText] = await Promise.all([projectFile.arrayBuffer(), a2lFile.text()]);
      const projectText = decodeProjectBytes(new Uint8Array(projectBuffer));
      const measurements = parseA2lMeasurements(a2lText);
      if (!measurements.count) throw new Error("No A2L MEASUREMENT declarations were found.");
      const plan = planProject(projectText, measurements);
      if (!plan.records.length) throw new Error("No DID parameter records were found in this project.");
      const patched = patchProject(projectText, plan);
      const outputBytes = new TextEncoder().encode(patched);
      setAnalysis({ plan, outputBytes, projectName: projectFile.name, a2lName: a2lFile.name });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "These files could not be analyzed.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!analysis) return;
    const name = analysis.projectName.replace(/\.prj$/i, "") + "_A2L_matched.prj";
    const blob = new Blob([new Uint8Array(analysis.outputBytes)], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  const stats = analysis?.plan.stats;
  const filters: { key: Filter; label: string; count: number }[] = analysis ? [
    { key: "all", label: "All records", count: analysis.plan.records.length },
    { key: "change", label: "Will change", count: stats!.change },
    { key: "unmatched", label: "No match", count: stats!.unmatched },
    { key: "already", label: "Already ready", count: stats!.already },
    { key: "no-inca", label: "No value", count: stats!.noInca },
  ] : [];

  return (
    <main className="min-h-screen bg-bg text-fg">
      <div className="app-glow pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-8 lg:px-10">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border/80">
          <div className="flex items-center gap-3">
            <div className="brand-mark flex size-9 items-center justify-center rounded-lg border border-accent/40 bg-accent/10 font-mono text-sm font-semibold text-accent">IV</div>
            <div className="leading-tight"><p className="text-sm font-semibold tracking-wide">INCA Variable Studio</p><p className="font-mono text-xs tracking-wide text-fg-subtle">PRJ / A2L MATCHING</p></div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs text-fg-muted sm:flex"><LockKeyhole className="size-3.5 text-accent" /> Files stay in your browser</div>
        </header>

        <section className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:py-14">
          <div>
            <div className="mb-4 flex items-center gap-2 font-mono text-xs tracking-widest text-accent uppercase"><span className="h-px w-7 bg-accent" /> Project alignment</div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-fg sm:text-5xl lg:text-6xl">Match the variable.<br /><span className="text-fg-muted">Preserve the project.</span></h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-fg-muted sm:text-base">Compare every DID in an INCA project with declared A2L measurements. Review the exact value each record will receive, then download a project with changes confined to <code className="text-fg">INCAvar</code> values.</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface/85 p-5 shadow-panel">
            <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4 text-accent" /> Change boundary</div>
            <p className="mt-3 text-sm leading-6 text-fg-muted">The app writes only the contents of selected <code className="text-fg">INCAvar</code> value nodes. It verifies that everything outside those values is identical.</p>
          </div>
        </section>

        <section aria-labelledby="source-heading" className="rounded-3xl border border-border bg-surface/75 p-4 shadow-panel sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="section-kicker">01 / SOURCE FILES</p><h2 id="source-heading" className="mt-2 text-xl font-semibold">Add the two files</h2></div><span className="rounded-full border border-border px-3 py-1.5 font-mono text-xs text-fg-subtle">LOCAL ANALYSIS</span></div>
          <div className="grid gap-4 md:grid-cols-2">
            <FileDrop number="01" title="INCA project" detail="The .prj containing your current DIDs and INCAvar values" accept=".prj" file={projectFile} onFile={updateProject} icon="project" />
            <FileDrop number="02" title="A2L description" detail="Declared measurement names used to find replacement candidates" accept=".a2l" file={a2lFile} onFile={updateA2l} icon="a2l" />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
            <p className="max-w-xl text-xs leading-5 text-fg-subtle">ECU-TEST shows names in single quotes, but its PRJ file stores the name without those quote characters. Unmatched records remain untouched.</p>
            <button type="button" onClick={analyze} disabled={!projectFile || !a2lFile || busy} className="action-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40">{busy ? <RotateCcw className="size-4 animate-spin" /> : <FileSearch2 className="size-4" />}{busy ? "Analyzing files…" : analysis ? "Analyze again" : "Analyze files"}{!busy ? <ArrowRight className="size-4" /> : null}</button>
          </div>
          {error ? <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
        </section>

        {analysis ? (
          <section aria-labelledby="review-heading" className="mt-7 space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Project DIDs" value={analysis.plan.records.length} detail="records inspected" />
              <Metric label="Will change" value={stats!.change} detail={`${stats!.nameChanges} names · ${stats!.formatChanges} format fixes`} tone="accent" />
              <Metric label="No A2L match" value={stats!.unmatched} detail="kept as they are" />
              <Metric label="Multiple choices" value={stats!.multiple} detail="one random pick per DID" />
            </div>
            <div className="overflow-hidden rounded-3xl border border-border bg-surface/85 shadow-panel">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6"><div><p className="section-kicker">02 / CHANGE REVIEW</p><h2 id="review-heading" className="mt-2 text-xl font-semibold">Current and proposed values</h2><p className="mt-1 text-xs text-fg-subtle">{analysis.plan.measurementCount.toLocaleString()} declared measurements found in {analysis.a2lName}</p><p className="mt-1 text-xs text-fg-subtle">Quotes reflect the ECU-TEST editor display; the downloaded PRJ stores bare variable names.</p></div><div className="flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent"><ShieldCheck className="size-3.5" /> Integrity check passed</div></div>
              <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex max-w-full gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Filter records">{filters.map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-medium transition ${filter === item.key ? "bg-surface-3 text-fg" : "text-fg-subtle hover:bg-surface-2 hover:text-fg"}`}>{item.label} <span className="ml-1 font-mono opacity-65">{item.count}</span></button>)}</div>
                <label className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-border bg-bg/70 px-3 focus-within:border-accent lg:w-64"><Search className="size-4 shrink-0 text-fg-subtle" /><span className="sr-only">Search DID or variable</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search DID or variable" className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle" /></label>
              </div>
              <div className="max-h-[36rem] overflow-auto"><table className="w-full min-w-[58rem] border-collapse text-left text-xs"><thead className="sticky top-0 z-10 bg-surface-2 text-fg-subtle"><tr><th className="table-head">DID</th><th className="table-head">Current INCAvar</th><th className="table-head">Proposed INCAvar</th><th className="table-head">A2L choice</th><th className="table-head">Result</th></tr></thead><tbody>{visible.map((record) => <RecordRow key={record.id} record={record} />)}</tbody></table>{!visible.length ? <p className="px-6 py-12 text-center text-sm text-fg-muted">No records match this filter.</p> : null}</div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4 sm:px-6"><p className="text-xs leading-5 text-fg-subtle">Showing {visible.length} of {analysis.plan.records.length} records. {stats!.noInca} records have no editable INCAvar value and remain unchanged.</p><button type="button" onClick={download} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"><ArrowDownToLine className="size-4" /> Download revised .prj</button></div>
            </div>
          </section>
        ) : (
          <section className="mt-7 rounded-3xl border border-dashed border-border bg-surface/35 px-6 py-12 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-surface-2 text-fg-muted"><FileSearch2 className="size-5" /></div><h2 className="mt-4 text-sm font-semibold">The review will appear here</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-fg-subtle">Add a project and its A2L, then analyze to see every DID, every proposed INCAvar, and exactly which records stay untouched.</p></section>
        )}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-xs text-fg-subtle"><span>INCA Variable Studio</span><span>Measured changes. Original project structure preserved.</span></footer>
      </div>
    </main>
  );
}

function FileDrop({ number, title, detail, accept, file, onFile, icon }: { number: string; title: string; detail: string; accept: string; file: File | null; onFile: (file: File | null) => void; icon: "project" | "a2l" }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return <div onDragOver={(event) => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(event) => { event.preventDefault(); setOver(false); onFile(event.dataTransfer.files[0] ?? null); }} className={`file-drop min-w-0 rounded-2xl border p-5 transition sm:p-6 ${over ? "border-accent bg-accent/5" : file ? "border-accent/30 bg-surface-2/70" : "border-border bg-bg/40 hover:border-fg-subtle"}`}>
    <input ref={ref} type="file" accept={accept} className="sr-only" onChange={(event) => { onFile(event.target.files?.[0] ?? null); event.target.value = ""; }} aria-label={`Choose ${title} file`} />
    <div className="flex items-start justify-between gap-3"><div className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface-2 text-accent">{icon === "project" ? <FileCode2 className="size-5" /> : <FileSearch2 className="size-5" />}</div><span className="font-mono text-xs tracking-widest text-fg-subtle">{number}</span></div>
    <h3 className="mt-5 text-base font-semibold">{title}</h3><p className="mt-1 min-h-10 text-xs leading-5 text-fg-muted">{detail}</p>
    {file ? <div className="mt-4 flex min-w-0 items-center gap-3 rounded-xl border border-accent/25 bg-accent/5 p-3"><Check className="size-4 shrink-0 text-accent" /><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs text-fg" title={file.name}>{file.name}</p><p className="mt-0.5 text-xs text-fg-subtle">{formatBytes(file.size)}</p></div><button type="button" onClick={() => onFile(null)} aria-label={`Remove ${title}`} className="flex size-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-3 hover:text-fg"><X className="size-4" /></button></div> : <div className="mt-4 flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs text-fg-subtle"><Upload className="size-3.5" /> Drop {accept} here</span><button type="button" onClick={() => ref.current?.click()} className="min-h-9 rounded-lg border border-border bg-surface-2 px-3 text-xs font-medium text-fg hover:border-fg-subtle">Browse file</button></div>}
    {file ? <button type="button" onClick={() => ref.current?.click()} className="mt-3 text-xs font-medium text-accent hover:text-accent-hover">Choose another file <ArrowRight className="ml-1 inline size-3" /></button> : null}
  </div>;
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone?: "accent" }) {
  return <div className="rounded-2xl border border-border bg-surface/85 p-4 shadow-panel sm:p-5"><p className="text-xs text-fg-subtle">{label}</p><p className={`mt-2 font-mono text-3xl font-medium tracking-tight ${tone === "accent" ? "text-accent" : "text-fg"}`}>{value.toLocaleString()}</p><p className="mt-2 text-xs text-fg-muted">{detail}</p></div>;
}

function editorValue(raw: string | null): string | null {
  if (!raw) return raw;
  return raw.startsWith("'") && raw.endsWith("'") ? raw : `'${raw}'`;
}

function RecordRow({ record }: { record: ProjectRecord }) {
  const proposed = editorValue(record.selectedName ?? record.currentRaw);
  const badge = record.status === "change" ? record.changeKind === "format" ? "Format fix" : "Name change" : record.status === "already" ? "Already ready" : record.status === "unmatched" ? "No A2L match" : "No value";
  return <tr className="border-t border-border/60 align-top transition-colors hover:bg-surface-2/60">
    <td className="table-cell font-mono font-semibold text-fg">{record.did}</td>
    <td className="table-cell max-w-xs break-all font-mono text-fg-muted">{editorValue(record.currentRaw) || <span className="text-fg-subtle">—</span>}</td>
    <td className={`table-cell max-w-xs break-all font-mono ${record.status === "change" ? "text-fg" : "text-fg-muted"}`}>{proposed || <span className="text-fg-subtle">—</span>}</td>
    <td className="table-cell min-w-40">{record.candidates.length > 1 ? <details className="group"><summary className="flex cursor-pointer list-none items-center gap-1.5 text-accent"><Shuffle className="size-3.5" /> 1 of {record.candidates.length} selected <ChevronDown className="size-3 transition group-open:rotate-180" /></summary><div className="mt-2 space-y-1 rounded-lg border border-border bg-bg/70 p-2 font-mono text-xs">{record.candidates.map((name) => <div key={name} className={name === record.selectedName ? "text-accent" : "text-fg-subtle"}>{name === record.selectedName ? "✓ " : "· "}{name}</div>)}</div></details> : record.candidates.length ? <span className="text-fg-subtle">1 declared name</span> : <span className="text-fg-subtle">No candidate</span>}</td>
    <td className="table-cell"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 font-medium ${record.status === "change" ? "border-accent/30 bg-accent/10 text-accent" : record.status === "already" ? "border-border bg-surface-2 text-fg-muted" : "border-warn/30 bg-warn/10 text-warn"}`}>{badge}</span></td>
  </tr>;
}
