import Link from "next/link";

const stages = [
  ["Report", "A worker explains what changed."],
  ["Rule", "An approved source decides what is allowed."],
  ["Action", "The right person authorises the next step."],
  ["Proof", "A receipt makes the outcome inspectable."],
] as const;

export default function HunarOsPage() {
  return (
    <main className="site-shell operator-shell">
      <nav className="topbar" aria-label="Audience">
        <Link
          className="wordmark operator-mark"
          href="/hunar-os"
          aria-current="page"
        >
          Hunar OS
        </Link>
        <Link className="audience-switch" href="/kaam-saathi">
          For workers <span aria-hidden="true">↗</span>
        </Link>
      </nav>
      <section className="hero operator-hero">
        <div className="hero-copy">
          <p className="eyebrow">Exception-resolution infrastructure</p>
          <h1>Frontline exceptions become governed actions.</h1>
          <p className="lede">
            Hunar OS turns messy reports into source-backed decisions,
            authorised next steps, and receipts your operations team can
            inspect.
          </p>
          <p className="hindi-copy" lang="hi">
            उलझे हुए काम को मंज़ूर नियम, सही अनुमति और जाँच योग्य नतीजे में
            बदलें।
          </p>
          <div className="actions">
            <Link className="button button-navy" href="/kaam-saathi">
              Explore KaamSaathi
            </Link>
            <Link className="text-link" href="/studio">
              View the Studio shell
            </Link>
          </div>
        </div>
        <ol
          className="workline"
          aria-label="How Hunar OS resolves an exception"
        >
          {stages.map(([title, description]) => (
            <li key={title}>
              <span className="proof-node" aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <p className="demo-note">
        Built with fictional Sahaay Home Services demonstration data.
      </p>
    </main>
  );
}
