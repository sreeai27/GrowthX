import Link from "next/link";
import { copy } from "../../content/copy";

export default function KaamSaathiPage() {
  return (
    <main className="site-shell worker-shell">
      <nav className="topbar" aria-label="Audience">
        <Link
          className="wordmark worker-mark"
          href="/kaam-saathi"
          aria-current="page"
        >
          KaamSaathi <span lang="hi">कामसाथी</span>
        </Link>
        <Link className="audience-switch" href="/hunar-os">
          For operators <span aria-hidden="true">↗</span>
        </Link>
      </nav>
      <section className="hero worker-hero">
        <div className="hero-copy">
          <p className="eyebrow" lang="hi">
            {copy.hi.workerEyebrow}
          </p>
          <h1>Agree on the next step, without guessing.</h1>
          <p className="lede">{copy.en.workerPromise}</p>
          <p className="hindi-copy" lang="hi">
            {copy.hi.workerPromise}
          </p>
          <Link className="button button-teal" href="/demo">
            Try TaskConfirm
          </Link>
        </div>
        <aside className="moment-card" aria-label="Example work exception">
          <span className="moment-label">Today · Booking DEMO-4821</span>
          <blockquote lang="hi">
            “Customer balcony bhi deep clean karne bol rahe hain.”
          </blockquote>
          <div className="agreement-card">
            <span className="proof-node" aria-hidden="true" />
            <div>
              <strong>Balcony deep cleaning</strong>
              <p>Customer approval needed · +25 min · ₹299</p>
            </div>
          </div>
          <small>Fictional demonstration catalogue data</small>
        </aside>
      </section>
    </main>
  );
}
