import Link from "next/link";

const futurePacks = [
  { name: "Pin Rescue", hi: "सही जगह तक पहुँचें", problem: "A delivery pin and the customer’s directions do not match.", flow: "Compare the order state, customer-confirmed landmark and active address-change rule, then update or escalate.", outcome: "A correct delivery attempt with the location decision recorded." },
  { name: "Freshness Gate", hi: "सही पैक चुनें", problem: "A worker cannot confidently read a product’s date label.", flow: "Check the barcode and close-up date label against the expected item and freshness rule, then pick, reject or review.", outcome: "The selected pack meets the operator’s approved freshness rule." },
  { name: "Product Guard", hi: "सही सामान की जाँच", problem: "A product or service kit may not match the active job.", flow: "Scan only the product label, compare it with issued inventory and service rules, then verify or escalate.", outcome: "The right product is used with a traceable decision." },
  { name: "Fix Assist", hi: "सुरक्षित अगला कदम", problem: "A bounded equipment issue needs a safe first check.", flow: "Use an expert-owned procedure for low-risk checks; stop and route anything unsupported or unsafe.", outcome: "A documented safe next step or human escalation—not open-ended repair advice." },
] as const;

export default function KaamSaathiPage() {
  return (
    <main className="site-shell worker-shell kaam-landing">
      <nav className="topbar" aria-label="Audience"><Link className="wordmark worker-mark" href="/kaam-saathi" aria-current="page">KaamSaathi <span lang="hi">कामसाथी</span></Link><Link className="audience-switch" href="/hunar-os">For operators <span aria-hidden="true">↗</span></Link></nav>

      <section className="kaam-hero" aria-labelledby="kaam-title">
        <div><p className="eyebrow" lang="hi">जब काम बदलता है</p><h1 id="kaam-title">When the job changes, get everyone on the same next step.</h1><p className="lede">Tell KaamSaathi what happened in your language. It checks the active booking and approved rules, shows the same decision to you and the customer, and records what was agreed.</p><p className="hindi-copy" lang="hi">अपनी भाषा में बताइए कि काम में क्या बदला। कामसाथी बुकिंग और मंज़ूर नियम जाँचकर आपको और ग्राहक को एक ही अगला कदम दिखाता है।</p><Link className="button button-teal" href="#demos">Choose a demo <span aria-hidden="true">↓</span></Link><p className="capture-boundary">Record your own description. Do not record a customer without permission.</p></div>
        <aside className="voice-to-proof" aria-label="From worker description to agreed next step"><div className="voice-orbit" aria-hidden="true"><span /><i /><i /><i /></div><p lang="hi">“Customer balcony bhi deep clean karne bol rahe hain.”</p><div className="voice-path" aria-hidden="true" /><section><span>Same next step</span><strong>Customer approval needed</strong><small>Fictional task catalogue · ₹299 · +25 min</small></section></aside>
      </section>

      <section className="demo-chooser" id="demos" aria-labelledby="demos-title"><header><p className="eyebrow">Choose a demo</p><h2 id="demos-title">Try a live work moment or preview a changed situation.</h2><p>Both begin with a worker’s own description. Neither listens in the background.</p></header><div className="demo-pair">
        <article className="demo-choice taskconfirm-choice"><div className="demo-choice-top"><span className="status-badge live-status">Live demo</span><span aria-hidden="true">काम बदला</span></div><h3>TaskConfirm</h3><p className="demo-hi" lang="hi">ग्राहक ने नया काम माँगा है। पहले बुकिंग और नियम जाँचें।</p><p>Resolve an extra-task request through worker confirmation, visible policy, customer approval, a booking receipt and completion evidence.</p><ol><li>Tell us what changed</li><li>Check the approved rule</li><li>Get and record agreement</li></ol><Link className="button button-teal" href="/demo">Open TaskConfirm</Link></article>
        <article className="demo-choice replay-choice"><div className="demo-choice-top"><span className="status-badge preview-status">Demo preview</span><span aria-hidden="true">फिर से अभ्यास</span></div><h3>Ride Replay</h3><p className="demo-hi" lang="hi">सुरक्षित जगह रुकने के बाद मुश्किल बातचीत का अभ्यास करें।</p><p>Preview a post-ride practice flow: retell a difficult moment after confirming you are safely stopped, hear a changed phrase, and try one bounded response.</p><ol><li>Confirm you are safely stopped</li><li>Retell—never record the passenger</li><li>Practise one changed situation</li></ol><p className="preview-note">Interactive public demo arrives after its mobile, privacy, persistence and end-to-end checks pass.</p></article>
      </div></section>

      <section className="future-packs" aria-labelledby="future-title"><header><p className="eyebrow">Coming soon</p><h2 id="future-title">More difficult moments, each with a bounded path.</h2><p>Select a preview to see the planned problem, checks and outcome. These flows are not available yet.</p></header><div className="future-grid">{futurePacks.map((pack) => <details key={pack.name} className="future-card"><summary><span><small>Coming soon</small><strong>{pack.name}</strong><em lang="hi">{pack.hi}</em></span><b aria-hidden="true">+</b></summary><div><h3>Frontline problem</h3><p>{pack.problem}</p><h3>Planned bounded flow</h3><p>{pack.flow}</p><h3>Intended outcome</h3><p>{pack.outcome}</p></div></details>)}</div></section>

      <section className="kaam-assurance" aria-labelledby="assurance-title"><div><p className="eyebrow">Your work. Your voice.</p><h2 id="assurance-title">Help for the next moment—not a score on the worker.</h2></div><ul><li>No ambient or continuous recording</li><li>No automatic rating, suspension, pay or job-allocation changes</li><li>Unsupported or consequential cases go to human review</li><li>Practice evidence stays private by default</li></ul></section>
      <footer className="demo-note">KaamSaathi uses fictional Sahaay Home Services demonstration data. It is not affiliated with a delivery, ride or home-services platform.</footer>
    </main>
  );
}
