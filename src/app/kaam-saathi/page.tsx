import Image from "next/image";
import Link from "next/link";

import { LandingSmoothScroll } from "../landing-smooth-scroll";
import { PublicPageMotion } from "../motion/public-page-motion";

const workerVoiceImage = "/landing/kaamsaathi-worker-voice.png";
const customerAgreementImage = "/landing/kaamsaathi-customer-agreement.png";
const riderReplayImage = "/landing/kaamsaathi-safe-ride-replay.png";
const workerStatesImage = "/landing/kaamsaathi-worker-states.png";
const workerJourneyImage = "/landing/kaamsaathi-guided-journey.png";

const futurePacks = [
  {
    name: "Pin Rescue",
    hi: "सही जगह तक पहुँचें",
    problem: "A delivery pin and the customer’s directions do not match.",
    flow: "Compare the order state, customer-confirmed landmark and active address-change rule, then update or escalate.",
    outcome: "A correct delivery attempt with the location decision recorded.",
  },
  {
    name: "Freshness Gate",
    hi: "सही पैक चुनें",
    problem: "A worker cannot confidently read a product’s date label.",
    flow: "Check the barcode and close-up date label against the expected item and freshness rule, then pick, reject or review.",
    outcome: "The selected pack meets the operator’s approved freshness rule.",
  },
  {
    name: "Product Guard",
    hi: "सही सामान की जाँच",
    problem: "A product or service kit may not match the active job.",
    flow: "Scan only the product label, compare it with issued inventory and service rules, then verify or escalate.",
    outcome: "The right product is used with a traceable decision.",
  },
  {
    name: "Fix Assist",
    hi: "सुरक्षित अगला कदम",
    problem: "A bounded equipment issue needs a safe first check.",
    flow: "Use an expert-owned procedure for low-risk checks; stop and route anything unsupported or unsafe.",
    outcome:
      "A documented safe next step or human escalation—not open-ended repair advice.",
  },
] as const;

export default function KaamSaathiPage() {
  return (
    <main
      className="site-shell worker-shell kaam-landing"
      data-kaam-motion-root
    >
      <LandingSmoothScroll />
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

      <section
        className="kaam-hero"
        aria-labelledby="kaam-title"
        data-motion-hero
      >
        <div className="landing-hero-copy">
          <p className="eyebrow" lang="hi">
            जब काम बदलता है
          </p>
          <h1 id="kaam-title">
            When the job changes, KaamSaathi helps everyone agree on the next
            step.
          </h1>
          <p className="lede">
            Tell KaamSaathi what changed, in your own language. It checks the
            booking and approved rules, then shows you and the customer the same
            clear next step—before the work continues.
          </p>
          <p className="hindi-copy" lang="hi">
            अपनी भाषा में बताइए कि काम में क्या बदला। कामसाथी बुकिंग और मंज़ूर
            नियम देखकर आपको और ग्राहक को एक ही साफ़ अगला कदम दिखाता है—काम आगे
            बढ़ने से पहले।
          </p>
          <Link className="button button-teal" href="#demos">
            Try a work-change demo <span aria-hidden="true">↓</span>
          </Link>
          <p className="capture-boundary">
            Describe the moment in your own words. Record a customer only with
            their permission.
          </p>
        </div>

        <figure className="landing-hero-visual kaam-hero-visual">
          <Image
            className="landing-hero-photo"
            src={workerVoiceImage}
            alt="A fictional home-service worker deliberately describing a work change on her phone"
            width={1536}
            height={1024}
            priority
            sizes="(max-width: 760px) 100vw, 54vw"
          />
          <aside
            className="voice-to-proof"
            aria-label="From worker description to agreed next step"
            data-motion-proof
          >
            <div className="voice-orbit" aria-hidden="true">
              <span />
              <i />
              <i />
              <i />
            </div>
            <p lang="hi">
              “Customer balcony bhi deep clean karne bol rahe hain.”
            </p>
            <div className="voice-path" aria-hidden="true" />
            <section>
              <span>Same next step</span>
              <strong>Customer approval needed</strong>
              <small>Fictional task catalogue · ₹299 · +25 min</small>
            </section>
          </aside>
        </figure>
      </section>

      <figure className="kaam-journey" data-motion-reveal>
        <Image
          src={workerJourneyImage}
          alt="Illustrated KaamSaathi journey from speaking and checking a source to agreement and replay"
          width={1536}
          height={1024}
          sizes="(max-width: 760px) 100vw, 78rem"
        />
        <figcaption>
          Speak in your words. Check the rule. Agree together. Keep the proof.
        </figcaption>
      </figure>

      <section
        className="demo-chooser"
        id="demos"
        aria-labelledby="demos-title"
      >
        <header>
          <p className="eyebrow">Choose a demo</p>
          <h2 id="demos-title">
            See what happens when the job no longer matches the plan.
          </h2>
          <p>
            Both start only when the worker chooses to describe the moment.
            KaamSaathi never listens in the background.
          </p>
        </header>
        <div className="demo-pair">
          <article
            className="demo-choice taskconfirm-choice"
            data-motion-reveal
          >
            <figure className="demo-choice-media">
              <Image
                src={customerAgreementImage}
                alt="A fictional worker and customer reviewing the same job update on their phones"
                width={1536}
                height={1024}
                sizes="(max-width: 760px) 100vw, 50vw"
              />
            </figure>
            <div className="demo-choice-top">
              <span className="status-badge live-status">Live demo</span>
              <span aria-hidden="true">काम बदला</span>
            </div>
            <h3>TaskConfirm</h3>
            <p className="demo-hi" lang="hi">
              ग्राहक ने नया काम माँगा है। पहले बुकिंग और नियम जाँचें।
            </p>
            <p>
              A customer asks for extra work. Check what was booked, show the
              approved price and time, get agreement, and keep the update
              receipt.
            </p>
            <ol>
              <li>Describe what changed</li>
              <li>See the approved rule</li>
              <li>Agree and record the outcome</li>
            </ol>
            <Link className="button button-teal" href="/demo">
              Try TaskConfirm
            </Link>
          </article>

          <article className="demo-choice replay-choice" data-motion-reveal>
            <figure className="demo-choice-media">
              <Image
                src={riderReplayImage}
                alt="A fictional rider safely stopped away from traffic before using voice replay"
                width={1536}
                height={1024}
                sizes="(max-width: 760px) 100vw, 50vw"
              />
            </figure>
            <div className="demo-choice-top">
              <span className="status-badge preview-status">Demo preview</span>
              <span aria-hidden="true">फिर से अभ्यास</span>
            </div>
            <h3>Ride Replay</h3>
            <p className="demo-hi" lang="hi">
              सुरक्षित जगह रुकने के बाद मुश्किल बातचीत का अभ्यास करें।
            </p>
            <p>
              Preview a post-ride practice flow: retell a difficult moment after
              confirming you are safely stopped, hear a changed phrase, and try
              one bounded response.
            </p>
            <ol>
              <li>Confirm you are safely stopped</li>
              <li>Retell—never record the passenger</li>
              <li>Practise one changed situation</li>
            </ol>
            <p className="preview-note">
              Interactive public demo arrives after its mobile, privacy,
              persistence and end-to-end checks pass.
            </p>
          </article>
        </div>
      </section>

      <section className="future-packs" aria-labelledby="future-title">
        <header className="future-packs-header">
          <div>
            <p className="eyebrow">Coming soon</p>
            <h2 id="future-title">
              More difficult moments, each with a bounded path.
            </h2>
            <p>
              Select a preview to see the planned problem, checks and outcome.
              These flows are not available yet.
            </p>
          </div>
          <figure id="future-packs-visual">
            <Image
              src={workerStatesImage}
              alt="Illustrated worker moments: asking, checking together, learning, and receiving a recorded outcome"
              width={1536}
              height={1024}
              sizes="(max-width: 760px) 100vw, 42vw"
            />
          </figure>
        </header>
        <div className="future-grid">
          {futurePacks.map((pack) => (
            <details key={pack.name} className="future-card" data-motion-reveal>
              <summary>
                <span>
                  <small>Coming soon</small>
                  <strong>{pack.name}</strong>
                  <em lang="hi">{pack.hi}</em>
                </span>
                <b aria-hidden="true">+</b>
              </summary>
              <div>
                <h3>Frontline problem</h3>
                <p>{pack.problem}</p>
                <h3>Planned bounded flow</h3>
                <p>{pack.flow}</p>
                <h3>Intended outcome</h3>
                <p>{pack.outcome}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section
        className="kaam-assurance"
        aria-labelledby="assurance-title"
        data-motion-reveal
      >
        <div>
          <p className="eyebrow">Your work. Your voice.</p>
          <h2 id="assurance-title">
            Help with the job—not a hidden score about you.
          </h2>
        </div>
        <ul>
          <li>No background or continuous recording</li>
          <li>
            No automatic changes to ratings, suspension, pay or job allocation
          </li>
          <li>
            Unsafe, unclear or high-impact cases go to a person for review
          </li>
          <li>Practice results stay private unless you choose to share them</li>
        </ul>
      </section>
      <footer className="demo-note">
        KaamSaathi uses fictional Sahaay Home Services demonstration data. It is
        not affiliated with a delivery, ride or home-services platform.
      </footer>
      <PublicPageMotion rootSelector="[data-kaam-motion-root]" />
    </main>
  );
}
