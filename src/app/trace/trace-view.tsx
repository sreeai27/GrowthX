import Link from "next/link";

import type { PublicTrace } from "../../domain/public-trace";

const gallery = [
  ["included", "Included request", "No extra approval needed"],
  ["approved", "Customer-approved add-on", "Authorised and completed"],
  ["escalated", "Escalated request", "Work preserved for human review"],
] as const;

function readable(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

export function TraceGallery({ activeId }: { readonly activeId?: string }) {
  return (
    <nav className="trace-gallery" aria-label="Curated trace gallery">
      <p className="trace-label">FICTIONAL EXAMPLES</p>
      <div>
        {gallery.map(([id, label, detail]) => (
          <Link
            aria-current={activeId === id ? "page" : undefined}
            href={`/trace/${id}`}
            key={id}
          >
            <strong>{label}</strong>
            <span>{detail}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function TraceEmpty() {
  return (
    <main className="trace-shell">
      <header className="trace-topbar">
        <Link className="wordmark" href="/hunar-os">Hunar Trace</Link>
        <Link className="audience-switch" href="/demo">Open demo · डेमो खोलें</Link>
      </header>
      <section className="trace-empty">
        <p className="eyebrow">Public Trace · सार्वजनिक ट्रेस</p>
        <h1>No current trace in this browser</h1>
        <p>Start the guided demo here, or inspect one of the fixed fictional examples below.</p>
        <Link className="button button-teal" href="/demo">Start guided demo · डेमो शुरू करें</Link>
      </section>
      <TraceGallery />
    </main>
  );
}

export function TraceView({
  trace,
  current = false,
  activeId,
}: {
  readonly trace: PublicTrace;
  readonly current?: boolean;
  readonly activeId?: string;
}) {
  return (
    <main className="trace-shell">
      <header className="trace-topbar">
        <Link className="wordmark" href="/hunar-os">Hunar Trace</Link>
        <span className="trace-readonly">READ ONLY · केवल देखने के लिए</span>
      </header>

      <section className="trace-hero">
        <div>
          <p className="eyebrow">{current ? "Current demo trace" : "Curated fictional trace"}</p>
          <h1>{trace.outcome}</h1>
          <p>{trace.title}</p>
        </div>
        <dl className="trace-identity">
          <div><dt>Trace</dt><dd>{trace.traceId}</dd></div>
          <div><dt>Scenario</dt><dd>{readable(trace.scenario)}</dd></div>
        </dl>
      </section>

      <section className="trace-record" aria-labelledby="trace-record-title">
        <div className="trace-record-intro">
          <p className="trace-label">ORDERED EVIDENCE</p>
          <h2 id="trace-record-title">How this outcome was reached</h2>
          <p>Only approved public fields are shown. This view cannot change the run.</p>
        </div>
        <ol className="trace-workline" aria-label="Decision trace">
          {trace.stages.map((stage) => (
            <li key={`${stage.sequence}-${stage.label}`}>
              <span className="trace-node">{stage.sequence}</span>
              <article>
                <div className="trace-stage-header">
                  <div><p className="trace-label">{stage.actor}</p><h3>{stage.label}</h3></div>
                  <span className={`trace-status status-${stage.status.toLowerCase()}`}>{readable(stage.status)}</span>
                </div>
                <p>{stage.summary}</p>
                <dl className="trace-facts">
                  {stage.source ? <div><dt>Approved source</dt><dd>{stage.source.id} · v{stage.source.version}</dd></div> : null}
                  {stage.versions ? <div><dt>Versions</dt><dd>Flow {stage.versions.flow}{stage.versions.prompt ? ` · Prompt ${stage.versions.prompt}` : ""}{stage.versions.model ? ` · Model ${stage.versions.model}` : ""}</dd></div> : null}
                  {stage.approval ? <div><dt>Approval</dt><dd>{readable(stage.approval.state)}{stage.approval.approvedBy ? ` by ${readable(stage.approval.approvedBy)}` : ""}</dd></div> : null}
                  {stage.receipt ? <div><dt>Receipt</dt><dd>{readable(stage.receipt.state)}{stage.receipt.reference ? ` · ${stage.receipt.reference}` : ""}</dd></div> : null}
                  {stage.metrics ? <div><dt>Provider evidence</dt><dd>{stage.metrics.latencyMs !== undefined ? `${stage.metrics.latencyMs} ms` : ""}{stage.metrics.inputTokens !== undefined ? ` · ${stage.metrics.inputTokens} input tokens` : ""}{stage.metrics.outputTokens !== undefined ? ` · ${stage.metrics.outputTokens} output tokens` : ""}{stage.metrics.estimatedCostMinor !== undefined ? ` · estimated cost ${stage.metrics.estimatedCostMinor} minor units` : ""}</dd></div> : null}
                </dl>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <aside className="trace-privacy">
        <span className="proof-node" aria-hidden="true" />
        <div><p className="trace-label">PUBLIC PROJECTION</p><h2>Bounded by design</h2><p>Private contact details, unnecessary transcript text, system instructions and diagnostic details stay out of this view.</p></div>
      </aside>
      <TraceGallery activeId={activeId} />
    </main>
  );
}
