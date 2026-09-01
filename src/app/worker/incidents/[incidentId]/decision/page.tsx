import { redirect } from "next/navigation";

import type { WorkerPolicyDecisionView } from "../../../../../services/providers/worker-policy-decision";
import { getPolicyDecisionForWorker } from "../../actions";

const outcomeCopy = {
  INCLUDED_CONTINUE: {
    eyebrow: "Included in booking · बुकिंग में शामिल",
    title: "Continue the booked work",
    hindi: "बुक किया गया काम जारी रखें",
  },
  ADD_ON_APPROVAL_REQUIRED: {
    eyebrow: "Add-on decision · अतिरिक्त काम का फैसला",
    title: "Customer approval needed",
    hindi: "ग्राहक की मंज़ूरी ज़रूरी है",
  },
  TRADE_OFF_REQUIRED: {
    eyebrow: "Task trade-off · काम में बदलाव",
    title: "Ask the customer to choose",
    hindi: "ग्राहक से एक काम चुनने को कहें",
  },
  NOT_SUPPORTED: {
    eyebrow: "Outside this service · इस सेवा से बाहर",
    title: "This task is not supported",
    hindi: "यह काम इस सेवा में उपलब्ध नहीं है",
  },
  SAFETY_ESCALATION: {
    eyebrow: "Safety stop · सुरक्षा के लिए रुकें",
    title: "Stop the affected work",
    hindi: "प्रभावित काम रोक दें",
  },
} as const;

const actionCopy = {
  CONTINUE_BOOKED_WORK: "Continue booked work · बुक किया काम जारी रखें",
  REPORT_POLICY_ERROR: "Report a policy error · नीति की गलती बताएं",
  REQUEST_CUSTOMER_APPROVAL:
    "Send for customer approval · ग्राहक की मंज़ूरी लें",
  CONTINUE_ORIGINAL_BOOKING:
    "Continue original booking · मूल बुकिंग जारी रखें",
  REQUEST_CUSTOMER_TRADE_OFF:
    "Ask customer to choose · ग्राहक से चुनने को कहें",
  REQUEST_HUMAN_REVIEW: "Request review · समीक्षा का अनुरोध करें",
  STOP_AFFECTED_WORK: "Stop affected work · प्रभावित काम रोकें",
  CONTACT_SUPERVISOR: "Contact supervisor · सुपरवाइज़र से संपर्क करें",
} as const;

const decisionOwnerCopy = {
  INCLUDED_CONTINUE: { english: "Worker", hindi: "काम करने वाला" },
  ADD_ON_APPROVAL_REQUIRED: { english: "Customer", hindi: "ग्राहक" },
  TRADE_OFF_REQUIRED: { english: "Customer", hindi: "ग्राहक" },
  NOT_SUPPORTED: { english: "Supervisor", hindi: "सुपरवाइज़र" },
  SAFETY_ESCALATION: { english: "Supervisor", hindi: "सुपरवाइज़र" },
} as const;

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function DecisionPageContent({ decision }: { decision: WorkerPolicyDecisionView }) {
  const state = decision.outcome.decisionState;
  const copy = state
    ? outcomeCopy[state]
    : {
        eyebrow: "Needs review · समीक्षा ज़रूरी",
        title: "We cannot verify this safely",
        hindi: "हम इसे सुरक्षित रूप से सत्यापित नहीं कर सकते",
      };
  const authority = decision.authority;
  const decisionOwner = state
    ? decisionOwnerCopy[state]
    : { english: "Supervisor", hindi: "सुपरवाइज़र" };

  return (
    <main className="incident-shell decision-shell">
      <header className="incident-topbar">
        <span className="demo-badge">FICTIONAL DEMO</span>
        <span className="incident-step">4 / 4 · DECISION</span>
      </header>

      <article className="decision-panel">
        <header className="decision-outcome">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="hindi-copy" lang="hi">{copy.hindi}</p>
          <span className="support-state">{decision.outcome.supportState}</span>
          <p>Task confirmed · काम पक्का हुआ</p>
        </header>

        <ol className="decision-workline" aria-label="How this decision was reached">
          <li>
            <span className="workline-number">1</span>
            <section>
              <p className="decision-label">Original booking · मूल बुकिंग</p>
              <h2>{decision.booking.serviceName}</h2>
              <p>
                {decision.booking.remainingDurationMinutes} minutes remaining ·{" "}
                {decision.booking.remainingDurationMinutes} मिनट बाकी
              </p>
              <ul className="booking-task-list">
                {decision.booking.includedTasks.map((task) => (
                  <li key={task.taskId}>{task.displayName}</li>
                ))}
              </ul>
            </section>
          </li>
          <li>
            <span className="workline-number">2</span>
            <section>
              <p className="decision-label">Confirmed request · पक्का अनुरोध</p>
              <h2>{decision.selectedTask.displayName}</h2>
            </section>
          </li>
          <li>
            <span className="workline-number">3</span>
            <section>
              <p className="decision-label">Approved impact · स्वीकृत असर</p>
              <div className="impact-row">
                {decision.outcome.durationDeltaMinutes !== undefined ? (
                  <strong>{decision.outcome.durationDeltaMinutes} minutes</strong>
                ) : null}
                {decision.outcome.priceDeltaMinor !== undefined && decision.outcome.currency ? (
                  <strong>{money(decision.outcome.priceDeltaMinor, decision.outcome.currency)}</strong>
                ) : null}
              </div>
              {decision.outcome.durationDeltaMinutes !== undefined ? (
                <p lang="hi">{decision.outcome.durationDeltaMinutes} मिनट</p>
              ) : null}
              <p>
                These values come from the approved fictional demo policy, not from AI. ·
                ये मान स्वीकृत काल्पनिक डेमो नीति से आते हैं, AI से नहीं।
              </p>
            </section>
          </li>
          <li className="proof-step">
            <span className="workline-number">4</span>
            <section>
              <p className="decision-label">Who decides next · अगला फैसला कौन करेगा</p>
              <h2>{decisionOwner.english}</h2>
              <p lang="hi">{decisionOwner.hindi}</p>
            </section>
          </li>
          <li className="proof-step">
            <span className="workline-number proof-number">5</span>
            <section>
              <p className="decision-label">Decision authority · फैसले का आधार</p>
              {authority ? (
                <section className="source-proof" aria-label="Policy source" role="group">
                  <div className="source-authority">
                    <p className="demo-policy-label">
                      Fictional Sahaay policy data · Fictional demo data · काल्पनिक सहाय नीति डेटा
                    </p>
                    <h2>{authority.title}</h2>
                    <dl className="source-meta">
                      <div><dt>Version · संस्करण</dt><dd>{authority.version}</dd></div>
                      <div><dt>Effective · प्रभावी</dt><dd>{authority.effectiveFrom.slice(0, 10)}</dd></div>
                    </dl>
                  </div>
                  <details>
                    <summary>View source passage · नीति का अंश देखें</summary>
                    <div className="source-proof-body">
                      {authority.passage ? (
                      <blockquote>
                        <strong>{authority.passage.heading}</strong>
                        <p>{authority.passage.text}</p>
                      </blockquote>
                      ) : null}
                      <p className="demo-policy-notice">{authority.notice}</p>
                    </div>
                  </details>
                </section>
              ) : (
                <p>
                  No active, matching source could support this decision. ·
                  कोई सक्रिय और मेल खाता स्रोत इस फैसले का समर्थन नहीं करता।
                </p>
              )}
            </section>
          </li>
        </ol>

        <section className="decision-actions" aria-labelledby="next-step-heading">
          <p className="eyebrow">Safe next step · सुरक्षित अगला कदम</p>
          <h2 id="next-step-heading">Choose only from allowed actions</h2>
          <p lang="hi">केवल अनुमत कार्रवाई चुनें</p>
          {decision.outcome.allowedActions.map((action, index) => (
            <div className="future-action" key={action}>
              <button
                className={index === 0 ? "button button-teal" : "secondary-button"}
                disabled
                type="button"
              >
                {actionCopy[action]}
              </button>
              <small>Available next · अगले चरण में उपलब्ध</small>
            </div>
          ))}
        </section>
      </article>
    </main>
  );
}

export default async function DecisionPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const decision = await getPolicyDecisionForWorker(incidentId);
  if (!decision) redirect(`/worker/incidents/${incidentId}/interpretation`);
  return <DecisionPageContent decision={decision} />;
}
