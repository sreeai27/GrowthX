import Link from "next/link";

type ProductStage = {
  name: string; status: string; tone: "available" | "preview" | "future";
  title: string; body: string; proof: string; preview?: boolean; href?: string;
};

const productFlow: readonly ProductStage[] = [
  { name: "KaamSaathi", status: "Available", tone: "available", title: "Handle the frontline moment", body: "A worker retells what changed. The guided flow checks the active booking, approved rules and the person who must decide next.", proof: "Worker-initiated · no ambient recording" },
  { name: "Hunar Studio", status: "Available · protected", tone: "available", title: "Govern what the system may use", body: "Approved sources, review queues and named evaluations stay behind team access. This public view is a non-interactive preview.", proof: "Source taskconfirm-scope-policy · v1.0.0", preview: true },
  { name: "Hunar Trace", status: "Available · read-only", tone: "available", title: "Prove the decision and outcome", body: "See the source version, approval, authorised action and connector receipt without exposing private prompts or contact data.", proof: "Curated fictional evidence", href: "/trace" },
  { name: "Hunar Connect + Graph", status: "Platform preview", tone: "preview", title: "Carry actions and outcomes through the platform", body: "Connect defines bounded action interfaces. Graph links incidents, sources, receipts and recurrence signals. Their responsibilities work today; standalone public interfaces do not.", proof: "No public worker graph" },
  { name: "Hunar Passport + Network", status: "Coming soon", tone: "future", title: "Extend evidence only with worker control", body: "Portable practice evidence and opportunity matching remain future directions—not credentials or a live marketplace. Sharing would require explicit worker consent.", proof: "Future surface · not yet built" },
];

const trustRules = ["Worker initiated", "Source visible", "No always-on recording", "No automated punishment", "Human review for consequential decisions"];

export default function HunarOsPage() {
  return (
    <main className="site-shell operator-shell hunar-landing">
      <nav className="topbar" aria-label="Audience">
        <Link className="wordmark operator-mark" href="/hunar-os" aria-current="page">Hunar OS</Link>
        <Link className="audience-switch" href="/kaam-saathi">For workers <span aria-hidden="true">↗</span></Link>
      </nav>
      <section className="hunar-hero" aria-labelledby="hunar-title">
        <div><p className="eyebrow">Exception-resolution infrastructure for frontline work</p><h1 id="hunar-title">When frontline work leaves the happy path, resolve the next step.</h1><p className="lede">Hunar OS turns messy voice, screenshots and job context into a policy-grounded action, coordinates the required approval, records execution evidence and turns the incident into future capability.</p><div className="actions"><Link className="button button-navy" href="/kaam-saathi">Open KaamSaathi</Link><Link className="text-link" href="/trace">See the resolution trace</Link></div></div>
        <aside className="proof-console" aria-label="Example resolution proof"><p className="console-label">Fictional run · TaskConfirm</p><div className="console-input"><span>Messy input</span><p>“Customer balcony bhi deep clean karne bol rahe hain.”</p></div><div className="console-decision"><span className="proof-node" aria-hidden="true" /><div><strong>Customer approval needed</strong><p>Catalogue rule · +25 min · ₹299</p></div></div><dl><div><dt>Action</dt><dd>Authorised</dd></div><div><dt>Evidence</dt><dd>Receipt stored</dd></div></dl></aside>
      </section>
      <p className="proof-strip" aria-label="Resolution sequence">Messy input <span>→</span> approved policy <span>→</span> authorised action <span>→</span> evidence <span>→</span> outcome <span>→</span> replay</p>
      <section className="system-story" aria-labelledby="system-story-title">
        <header className="section-intro"><p className="eyebrow">One connected system</p><h2 id="system-story-title">The Workline follows the exception—not a product menu.</h2><p>Each surface has one job. Available, preview and future states are marked plainly.</p></header>
        <ol className="platform-workline">{productFlow.map((item, index) => <li key={item.name} className={`workline-stage stage-${item.tone}`}><span className="stage-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><article><div className="stage-heading"><p>{item.name}</p><span>{item.status}</span></div><h3>{item.title}</h3><p>{item.body}</p>{item.preview ? <div className="studio-preview" aria-label="Non-interactive Hunar Studio preview"><span>Approved source</span><strong>TaskConfirm scope policy</strong><code>ACTIVE · v1.0.0</code><span>Review state</span><strong>Evidence ready</strong></div> : null}{item.href ? <Link className="stage-link" href={item.href}>Open curated Public Trace <span aria-hidden="true">→</span></Link> : null}<small>{item.proof}</small></article></li>)}</ol>
      </section>
      <section className="interpret-resolve-learn" aria-label="How Hunar OS works"><article><span>Interpret</span><h2>Find the bounded exception.</h2><p>Map language and job context to approved task candidates—or abstain.</p></article><article><span>Resolve</span><h2>Let rules and people decide.</h2><p>Deterministic policy controls price, time, permissions and approval.</p></article><article><span>Learn</span><h2>Keep proof, then replay.</h2><p>Link the outcome to inspectable evidence and private practice.</p></article></section>
      <section className="trust-block" aria-labelledby="trust-title"><div><p className="eyebrow">Operating boundaries</p><h2 id="trust-title">Trust comes from what the system refuses to do.</h2></div><ul>{trustRules.map((rule) => <li key={rule}><span aria-hidden="true">✓</span>{rule}</li>)}</ul></section>
      <section className="landing-cta" aria-labelledby="landing-cta-title"><p className="eyebrow">See the reference flow</p><h2 id="landing-cta-title">Start with the frontline moment. Inspect every decision after.</h2><div className="actions"><Link className="button button-navy" href="/kaam-saathi">Open KaamSaathi</Link><Link className="text-link" href="/trace">Browse Public Trace</Link></div></section>
      <footer className="demo-note">Built with fictional Sahaay Home Services demonstration data. No named platform affiliation is implied.</footer>
    </main>
  );
}
