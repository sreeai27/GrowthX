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
