import Image from "next/image";
import Link from "next/link";

import { LandingSmoothScroll } from "../landing-smooth-scroll";
import { PublicPageMotion } from "../motion/public-page-motion";

const connectedEvidenceImage = "/landing/hunar-connected-evidence.png";
const teamImage = "/landing/hunar-frontline-team.png";
const operatorReviewImage = "/landing/hunar-operator-review.png";
const operatingBoundariesImage = "/landing/hunar-operating-boundaries.png";
const resolutionSystemImage = "/landing/hunar-resolution-system.png";

type ProductStage = {
  name: string;
  status: string;
  tone: "available" | "preview" | "future";
  title: string;
  body: string;
  proof: string;
  preview?: boolean;
  href?: string;
};

const productFlow: readonly ProductStage[] = [
  {
    name: "KaamSaathi",
    status: "Available",
    tone: "available",
    title: "Give workers a clear next step",
    body: "A worker reports what changed. KaamSaathi checks the booking and approved rules, then brings in the customer or supervisor when their decision is needed.",
    proof: "Worker-initiated · no ambient recording",
  },
  {
    name: "Hunar Studio",
    status: "Available · protected",
    tone: "available",
    title: "Keep every rule under operator control",
    body: "Your team controls the approved sources, review queues and release checks. The public site shows a non-interactive preview; team access stays protected.",
    proof: "Source taskconfirm-scope-policy · v1.0.0",
    preview: true,
  },
  {
    name: "Hunar Trace",
    status: "Available · read-only",
    tone: "available",
    title: "Show why every action happened",
    body: "Review the rule used, the approval given, the action taken and its receipt—without exposing private prompts or contact data.",
    proof: "Curated fictional evidence",
    href: "/trace",
  },
  {
    name: "Hunar Connect + Graph",
    status: "Platform preview",
    tone: "preview",
    title: "Carry actions and outcomes through the platform",
    body: "Connect defines bounded action interfaces. Graph links incidents, sources, receipts and recurrence signals. Their responsibilities work today; standalone public interfaces do not.",
    proof: "No public worker graph",
  },
  {
    name: "Hunar Passport + Network",
    status: "Coming soon",
    tone: "future",
    title: "Extend evidence only with worker control",
    body: "Portable practice evidence and opportunity matching remain future directions—not credentials or a live marketplace. Sharing would require explicit worker consent.",
    proof: "Future surface · not yet built",
  },
];

const trustRules = [
  "Worker initiated",
  "Source visible",
  "No always-on recording",
  "No automated punishment",
  "Human review for consequential decisions",
];

export default function HunarOsPage() {
  return (
    <main
      className="site-shell operator-shell hunar-landing"
      data-hunar-motion-root
    >
      <LandingSmoothScroll />
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

      <section
        className="hunar-hero"
        aria-labelledby="hunar-title"
        data-motion-hero
      >
        <div className="landing-hero-copy">
          <p className="eyebrow">
            Exception resolution for frontline operations
          </p>
          <h1 id="hunar-title">
            Resolve frontline exceptions before they become support calls.
          </h1>
          <p className="lede">
            Hunar OS turns a worker’s messy report into a rule-backed next step.
            It gets the right approval, carries out or verifies the action, and
            keeps a clear record of what happened.
          </p>
          <div className="actions">
            <Link className="button button-navy" href="/kaam-saathi">
              See TaskConfirm in action
            </Link>
            <Link className="text-link" href="/trace">
              Inspect a decision
            </Link>
          </div>
        </div>

        <figure className="landing-hero-visual hunar-hero-visual">
          <Image
            className="landing-hero-photo"
            src={teamImage}
            alt="A fictional group of frontline workers and an operator walking together after a shift"
            width={1536}
            height={1024}
            priority
            sizes="(max-width: 760px) 100vw, 55vw"
          />
          <aside
            className="proof-console"
            aria-label="Example resolution proof"
            data-motion-proof
          >
            <p className="console-label">Fictional run · TaskConfirm</p>
            <div className="console-input">
              <span>Messy input</span>
              <p>“Customer balcony bhi deep clean karne bol rahe hain.”</p>
            </div>
            <div className="console-decision">
              <span className="proof-node" aria-hidden="true" />
              <div>
                <strong>Customer approval needed</strong>
                <p>Catalogue rule · +25 min · ₹299</p>
              </div>
            </div>
            <dl>
              <div>
                <dt>Action</dt>
                <dd>Authorised</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>Receipt stored</dd>
              </div>
            </dl>
          </aside>
        </figure>
      </section>

      <p className="proof-strip" aria-label="Resolution sequence">
        Messy input <span>→</span> approved policy <span>→</span> authorised
        action
        <span>→</span> evidence <span>→</span> outcome <span>→</span> replay
      </p>

      <section className="system-story" aria-labelledby="system-story-title">
        <header className="section-intro">
          <p className="eyebrow">From report to recorded outcome</p>
          <h2 id="system-story-title">
            One connected path through the exception.
          </h2>
          <p>
            Each part of Hunar OS moves the case forward. What works now, what
            is in preview and what is planned are marked plainly.
          </p>
        </header>
        <figure
          className="landing-story-banner hunar-system-banner"
          data-motion-reveal
        >
          <Image
            src={resolutionSystemImage}
            alt="Illustrated sequence from a work report to a checked and recorded outcome"
            width={1536}
            height={1024}
            sizes="(max-width: 760px) 100vw, 72rem"
          />
          <figcaption>
            One workline connects the report, the people who decide, the active
            source, and the final receipt.
          </figcaption>
        </figure>
        <ol className="platform-workline">
          {productFlow.map((item, index) => (
            <li
              key={item.name}
              className={`workline-stage stage-${item.tone}`}
              data-motion-reveal
            >
              <span className="stage-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <article>
                <div className="stage-heading">
                  <p>{item.name}</p>
                  <span>{item.status}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                {item.preview ? (
                  <div
                    className="studio-preview"
                    aria-label="Non-interactive Hunar Studio preview"
                  >
                    <span>Approved source</span>
                    <strong>TaskConfirm scope policy</strong>
                    <code>ACTIVE · v1.0.0</code>
                    <span>Review state</span>
                    <strong>Evidence ready</strong>
                  </div>
                ) : null}
                {item.href ? (
                  <Link className="stage-link" href={item.href}>
                    Open curated Public Trace <span aria-hidden="true">→</span>
                  </Link>
                ) : null}
                <small>{item.proof}</small>
              </article>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="operator-in-practice"
        aria-labelledby="operator-practice-title"
        data-motion-reveal
      >
        <figure>
          <Image
            src={operatorReviewImage}
            alt="A fictional frontline worker and operations lead reviewing a source together"
            width={1536}
            height={1024}
            sizes="(max-width: 760px) 100vw, 54vw"
          />
        </figure>
        <div>
          <p className="eyebrow">Operator control stays visible</p>
          <h2 id="operator-practice-title">
            The rule owner can see exactly what supported the decision.
          </h2>
          <p>
            Approved sources, their versions, human approvals, connector
            receipts, and verification outcomes stay linked in one inspectable
            record.
          </p>
          <Link className="text-link" href="/trace">
            Inspect a fictional record <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section
        className="interpret-resolve-learn"
        aria-label="How Hunar OS works"
        data-motion-reveal
      >
        <figure className="hunar-evidence-atlas">
          <Image
            src={connectedEvidenceImage}
            alt="Illustrated evidence tools for reporting, checking, approval, and replay"
            width={1536}
            height={1024}
            sizes="(max-width: 760px) 100vw, 78rem"
          />
        </figure>
        <article>
          <span>Understand</span>
          <h2>Turn a messy report into a clear case.</h2>
          <p>
            Match the worker’s words and job context to an approved task—or say
            when there is not enough support.
          </p>
        </article>
        <article>
          <span>Resolve</span>
          <h2>Apply the rule. Ask the right person.</h2>
          <p>
            Approved policy—not the AI—sets price, time, permission and required
            approval.
          </p>
        </article>
        <article>
          <span>Improve</span>
          <h2>Keep the proof. Practise what changed.</h2>
          <p>
            Connect the final outcome to its evidence, then create one private
            practice scenario.
          </p>
        </article>
      </section>

      <section
        className="trust-block trust-block-visual"
        aria-labelledby="trust-title"
        data-motion-reveal
      >
        <div>
          <p className="eyebrow">Operating boundaries</p>
          <h2 id="trust-title">
            Trust comes from what the system refuses to do.
          </h2>
          <ul>
            {trustRules.map((rule) => (
              <li key={rule}>
                <span aria-hidden="true">✓</span>
                {rule}
              </li>
            ))}
          </ul>
        </div>
        <figure>
          <Image
            src={operatingBoundariesImage}
            alt="Illustrated bounded workflow showing reports, approvals, offline recovery, and stored receipts"
            width={1536}
            height={1024}
            sizes="(max-width: 760px) 100vw, 50vw"
          />
        </figure>
      </section>

      <section
        className="landing-cta"
        aria-labelledby="landing-cta-title"
        data-motion-reveal
      >
        <p className="eyebrow">See the complete loop</p>
        <h2 id="landing-cta-title">
          Watch a work change become an agreed, recorded outcome.
        </h2>
        <div className="actions">
          <Link className="button button-navy" href="/kaam-saathi">
            See TaskConfirm in action
          </Link>
          <Link className="text-link" href="/trace">
            Inspect a decision
          </Link>
        </div>
      </section>
      <footer className="demo-note">
        Built with fictional Sahaay Home Services demonstration data. No named
        platform affiliation is implied.
      </footer>
      <PublicPageMotion rootSelector="[data-hunar-motion-root]" />
    </main>
  );
}
