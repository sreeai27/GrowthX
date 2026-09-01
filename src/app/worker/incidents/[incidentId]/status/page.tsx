import { redirect } from "next/navigation";

import { getCustomerConfirmationForWorker } from "../../actions";
import { CopyConfirmationLink } from "./copy-confirmation-link";

const workerOutcome = {
  PENDING: {
    title: "Waiting for the customer",
    hindi: "ग्राहक के जवाब का इंतज़ार है",
    body: "No work has been authorised yet.",
  },
  APPROVED: {
    title: "Customer approved",
    hindi: "ग्राहक ने मंज़ूरी दी",
    body: "Approval is recorded. No action has been executed yet.",
  },
  DECLINED: {
    title: "Customer declined",
    hindi: "ग्राहक ने मना किया",
    body: "Continue only with the original booking.",
  },
  REQUEST_MISMATCH: {
    title: "Request does not match",
    hindi: "अनुरोध मेल नहीं खाता",
    body: "Pause this change and speak with the customer.",
  },
  EXPIRED: {
    title: "Customer link expired",
    hindi: "ग्राहक लिंक की अवधि समाप्त हुई",
    body: "This link can no longer record a decision.",
  },
  STALE: {
    title: "Decision changed",
    hindi: "फैसले की जानकारी बदल गई",
    body: "Return to the decision before asking the customer again.",
  },
  REVOKED: {
    title: "Customer link closed",
    hindi: "ग्राहक लिंक बंद है",
    body: "This link can no longer record a decision.",
  },
} as const;

export default async function WorkerConfirmationStatusPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const result = await getCustomerConfirmationForWorker(incidentId);
  if (!result) redirect(`/worker/incidents/${incidentId}/decision`);
  const copy =
    result.confirmation.status === "PENDING" && result.confirmation.requestConfirmed
      ? {
          title: "Request confirmed",
          hindi: "अनुरोध की पुष्टि हुई",
          body: "The customer confirmed the request. Their approval is still needed.",
        }
      : workerOutcome[result.confirmation.status];
  const customerHref = result.rawToken ? `/confirm/${result.rawToken}` : null;
  const execution = result.confirmation.execution;
  const receipt = execution?.status === "SUCCEEDED" ? execution.receipt : null;

  if (receipt) {
    const snapshot = result.confirmation.snapshot;
    const price = new Intl.NumberFormat("en-IN", { style: "currency", currency: snapshot.currency, maximumFractionDigits: 0 }).format(snapshot.priceDeltaMinor / 100);
    return <main className="incident-shell confirmation-shell"><header className="incident-topbar"><span className="demo-badge">FICTIONAL DEMO</span><span className="incident-step">REVISED AGREEMENT</span></header><article className="confirmation-outcome revised-agreement"><p className="eyebrow">Shared result · साझा नतीजा</p><h1>Booking updated</h1><p className="hindi-copy" lang="hi">बुकिंग अपडेट हो गई</p><ul className="revised-task-list">{snapshot.resultingTasks.map((task) => <li key={task.taskId}>{task.displayName}</li>)}</ul><p className="revised-impact">+{snapshot.durationDeltaMinutes} minutes · {price}</p><section className="receipt-proof" aria-label="Demonstration connector receipt"><span className="proof-node" aria-hidden="true"/><div><p className="decision-label">Demonstration connector · डेमो कनेक्टर</p><h2>{receipt.externalActionId}</h2><p>{new Date(receipt.executedAt).toLocaleString("en-IN")}</p><p className="source-version">Booking version {receipt.previousBookingVersion} → {receipt.resultingBookingVersion}</p></div></section></article></main>;
  }

  if (execution?.status === "PENDING" || execution?.status === "RETRYABLE_FAILED" || execution?.status === "PERMANENT_FAILED" || execution?.status === "RECONCILIATION_REQUIRED") {
    const retryable = execution.status === "RETRYABLE_FAILED";
    const reconciliation = execution.status === "RECONCILIATION_REQUIRED";
    return <main className="incident-shell confirmation-shell"><article className="confirmation-outcome terminal-failure"><p className="eyebrow">Action status · कार्रवाई की स्थिति</p><h1>{reconciliation ? "Connector result needs reconciliation" : execution.status === "PENDING" ? "Booking update in progress" : retryable ? "Booking update needs another try" : "Booking was not changed"}</h1><p lang="hi">{reconciliation ? "कनेक्टर नतीजे की जाँच ज़रूरी है" : "बुकिंग में बदलाव अभी दर्ज नहीं हुआ"}</p><p>{reconciliation ? "The connector reported success while the booking record changed. Do not repeat the action or promise either booking version; escalate to support." : retryable ? "Ask the customer to retry from the same secure link." : execution.status === "PENDING" ? "Refresh to check the stored connector result." : "Continue with the original booking and contact support."}</p></article></main>;
  }

  return (
    <main className="incident-shell confirmation-shell">
      <header className="incident-topbar">
        <span className="demo-badge">FICTIONAL DEMO</span>
        <span className="incident-step">CUSTOMER DECISION</span>
      </header>
      <article className="confirmation-outcome">
        <p className="eyebrow">Recorded status · दर्ज स्थिति</p>
        <h1>{copy.title}</h1>
        <p className="hindi-copy" lang="hi">{copy.hindi}</p>
        <p>{copy.body}</p>
        <span className={`confirmation-state state-${result.confirmation.status.toLowerCase()}`}>
          {result.confirmation.status}
        </span>
      </article>
      {customerHref && result.confirmation.status === "PENDING" ? (
        <section className="confirmation-link-card" aria-labelledby="share-heading">
          <p className="eyebrow">One secure link · एक सुरक्षित लिंक</p>
          <h2 id="share-heading">Share this with the customer</h2>
          <p lang="hi">यह लिंक ग्राहक के साथ साझा करें</p>
          <a className="button button-teal" href={customerHref} target="_blank">
            Open customer link · ग्राहक लिंक खोलें
          </a>
          <CopyConfirmationLink href={customerHref} />
          <p className="confirmation-expiry">
            Expires {new Date(result.confirmation.expiresAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })} · 30 minutes only
          </p>
        </section>
      ) : null}
      {result.confirmation.status === "DECLINED" ? (
        <a className="button button-secondary" href="/worker/booking">
          Continue original booking · मूल बुकिंग जारी रखें
        </a>
      ) : null}
    </main>
  );
}
