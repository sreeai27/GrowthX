import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { getCompletionForWorker, submitCompletionAction } from "../../actions";
import { PrivateResultCheckpoint } from "../private-result-checkpoint";
import { getPrivateResultCheckpoint } from "../private-result-actions";

const stateCopy = {
  VERIFIED: [
    "Verified",
    "सत्यापित",
    "The customer acknowledged the completed agreement.",
  ],
  DISPUTED: [
    "Disputed — review opened",
    "विवाद — जाँच शुरू",
    "A human reviewer must resolve the customer’s issue.",
  ],
  REVIEW_REQUIRED: [
    "Review required",
    "जाँच ज़रूरी है",
    "A blocker was recorded. A human reviewer must decide the next step.",
  ],
  CANNOT_VERIFY: [
    "Cannot verify yet",
    "अभी सत्यापित नहीं",
    "The stored evidence is not enough to verify completion.",
  ],
} as const;

export default async function WorkerCompletionPage({
  params,
  searchParams,
}: {
  params: Promise<{ incidentId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  noStore();
  const { incidentId } = await params;
  const { error } = await searchParams;
  const view = await getCompletionForWorker(incidentId);
  if (!view) redirect("/demo");
  if (view.kind === "INVALID")
    redirect(`/worker/incidents/${incidentId}/status`);
  const recorded = view.kind === "SUBMITTED" || view.kind === "RECORDED";
  const terminal = recorded && view.kind === "RECORDED";
  const checkpoint = terminal
    ? await getPrivateResultCheckpoint(incidentId, "COMPLETION")
    : null;
  const copy = recorded ? stateCopy[view.verification.state] : null;
  return (
    <main className="incident-shell completion-shell">
      <header className="incident-topbar">
        <span className="demo-badge">FICTIONAL DEMO</span>
        <span className="incident-step">COMPLETION</span>
      </header>
      <article className="completion-card">
        {error ? (
          <p className="completion-error" role="alert">
            The agreement changed or the submission was invalid. Review the
            current agreement and try again. · सहमति की जानकारी फिर देखें।
          </p>
        ) : null}
        <p className="eyebrow">Final agreement · अंतिम सहमति</p>
        <h1>
          {copy?.[0] ??
            (view.kind === "NOT_READY"
              ? "Waiting for completed work"
              : "Record completed work")}
        </h1>
        <p className="hindi-copy" lang="hi">
          {copy?.[1] ??
            (view.kind === "NOT_READY"
              ? "पूरा काम दर्ज होने का इंतज़ार"
              : "पूरा काम दर्ज करें")}
        </p>
        {copy ? <p>{copy[2]}</p> : null}
        <p className="source-version">
          Booking version {view.agreement.bookingVersion}
        </p>
        {view.kind === "READY" ? (
          <form action={submitCompletionAction} className="completion-form">
            <input type="hidden" name="incidentKey" value={incidentId} />
            <input
              type="hidden"
              name="bookingVersion"
              value={view.agreement.bookingVersion}
            />
            <fieldset>
              <legend>Mark every agreed task · हर सहमत काम दर्ज करें</legend>
              {view.agreement.tasks.map((task) => (
                <div className="completion-task" key={task.taskId}>
                  <input type="hidden" name="taskId" value={task.taskId} />
                  <h2>{task.displayName}</h2>
                  <label>
                    <input
                      required
                      type="radio"
                      name={`state.${task.taskId}`}
                      value="COMPLETE"
                    />{" "}
                    Complete · पूरा
                  </label>
                  <label>
                    <input
                      required
                      type="radio"
                      name={`state.${task.taskId}`}
                      value="BLOCKED"
                    />{" "}
                    Blocked · रुकावट
                  </label>
                </div>
              ))}
            </fieldset>
            <label className="completion-note">
              Optional note · वैकल्पिक नोट
              <textarea name="note" maxLength={500} rows={4} />
            </label>
            <button className="button button-teal">
              Submit completion · पूरा काम भेजें
            </button>
          </form>
        ) : (
          <ul className="completion-summary">
            {view.agreement.tasks.map((task) => {
              const state = recorded
                ? view.summary.taskStates.find(
                    (item) => item.taskId === task.taskId,
                  )?.state
                : null;
              return (
                <li key={task.taskId}>
                  <span>{task.displayName}</span>
                  {state ? <strong>{state}</strong> : null}
                </li>
              );
            })}
          </ul>
        )}
        {recorded ? (
          <section className="receipt-proof">
            <span className="proof-node" aria-hidden="true" />
            <div>
              <p className="decision-label">
                Verification record · सत्यापन रिकॉर्ड
              </p>
              <h2>{view.verification.criteriaVersion}</h2>
              <p>
                {new Date(view.verification.updatedAt).toLocaleString("en-IN")}
              </p>
              <p className="source-version">
                Reviewer required:{" "}
                {view.verification.reviewerRequired ? "Yes" : "No"}
              </p>
            </div>
          </section>
        ) : null}
        {recorded && view.agreement.receipt ? (
          <p className="source-version">
            Connector receipt evidence:{" "}
            {view.agreement.receipt.externalActionId}
          </p>
        ) : null}
        {terminal && view.verification.state === "VERIFIED" ? (
          <a className="button button-replay" href={`/worker/incidents/${incidentId}/replay`}>
            Practise a changed situation · बदली हुई स्थिति का अभ्यास करें
          </a>
        ) : null}
        {checkpoint ? (
          <PrivateResultCheckpoint
            checkpoint={checkpoint}
            incidentKey={incidentId}
            stage="COMPLETION"
          />
        ) : null}
      </article>
    </main>
  );
}
