import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";

import { getPrivateDemoResultGateway } from "../../../services/providers/private-demo-result";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

const terminalCopy = {
  INVALID: ["This result link is not valid", "यह परिणाम लिंक मान्य नहीं है"],
  EXPIRED: ["This result link has expired", "इस परिणाम लिंक की अवधि समाप्त हो गई"],
  REVOKED: ["This result link is no longer available", "यह परिणाम लिंक अब उपलब्ध नहीं है"],
} as const;

export default async function PrivateResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  noStore();
  const { token } = await params;
  const view = await getPrivateDemoResultGateway().getByResultToken(token);
  if (view.kind !== "ACTIVE") {
    const [title, hindi] = terminalCopy[view.kind];
    return (
      <main className="private-result-shell">
        <article className="private-result-card">
          <p className="eyebrow">Private demo result · निजी डेमो परिणाम</p>
          <h1>{title}</h1>
          <p className="hindi-copy" lang="hi">{hindi}</p>
          <p>Return to KaamSaathi to run a new fictional demonstration.</p>
        </article>
      </main>
    );
  }

  const { snapshot } = view;
  return (
    <main className="private-result-shell">
      <header className="customer-brand">
        <span>HUNAR OS · KAAMSAATHI</span>
        <small>PRIVATE · READ ONLY · FICTIONAL DEMO</small>
      </header>
      <article className="private-result-card">
        <header>
          <p className="eyebrow">One governed result · एक सत्यापित परिणाम</p>
          <h1>Your private demo result</h1>
          <p className="hindi-copy" lang="hi">आपका निजी डेमो परिणाम</p>
          <p className="source-version">
            Available until {new Date(view.expiresAt).toLocaleString("en-IN")}
          </p>
        </header>

        <ol className="private-result-workline" aria-label="Private result summary">
          <li>
            <span>1</span>
            <section>
              <p className="decision-label">Confirmed request · पक्का अनुरोध</p>
              <h2>{snapshot.requestSummary}</h2>
            </section>
          </li>
          <li>
            <span>2</span>
            <section>
              <p className="decision-label">Policy outcome · नीति का परिणाम</p>
              <h2>{snapshot.policyOutcome.decisionState.replaceAll("_", " ")}</h2>
              <p>{snapshot.policyOutcome.sourceKey}</p>
              <p className="source-version">Version {snapshot.policyOutcome.sourceVersion}</p>
            </section>
          </li>
          <li>
            <span>3</span>
            <section>
              <p className="decision-label">Customer decision · ग्राहक का फैसला</p>
              <h2>{snapshot.customerDecision}</h2>
            </section>
          </li>
          <li className="proof-step">
            <span className="proof-node">4</span>
            <section>
              <p className="decision-label">Final receipt · अंतिम रसीद</p>
              <h2>{snapshot.finalReceipt.externalActionId}</h2>
              <p>{snapshot.finalReceipt.connector}</p>
              <p className="source-version">
                {snapshot.finalReceipt.status} · {new Date(snapshot.finalReceipt.executedAt).toLocaleString("en-IN")}
              </p>
            </section>
          </li>
        </ol>

        <aside className={`private-result-delivery delivery-${view.status.toLowerCase()}`}>
          <strong>
            {view.status === "DELIVERED"
              ? "Sent privately"
              : view.status === "DELIVERY_FAILED"
                ? "Delivery needs another try"
                : "Delivery in progress"}
          </strong>
          <span>{view.maskedDisplay}</span>
        </aside>
        <p className="private-result-privacy">
          This page excludes the raw transcript and internal Hunar Trace data. · इस पेज में कच्चा ट्रांसक्रिप्ट और आंतरिक ट्रेस नहीं है।
        </p>
      </article>
    </main>
  );
}
