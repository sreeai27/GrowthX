import { redirect } from "next/navigation";

import {
  confirmTaskAction,
  getIncidentForWorker,
  prepareCandidatesAction,
  requestTaskReviewAction,
  retryPolicyDecisionAction,
  reviseTranscriptAction,
} from "../../actions";

export default async function InterpretationPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const incident = await getIncidentForWorker(incidentId);
  if (!incident) redirect("/demo");
  if (incident.status === "DRAFT")
    redirect(`/worker/incidents/${incidentId}/capture`);
  if (incident.status === "TRANSCRIPT_READY")
    redirect(`/worker/incidents/${incidentId}/transcript`);
  if (incident.status === "DECISION_READY")
    redirect(`/worker/incidents/${incidentId}/decision`);

  return (
    <main className="incident-shell">
      <header className="incident-topbar">
        <span className="demo-badge">DEMO</span>
        <span className="incident-step">3 / 3 · SELECT</span>
      </header>
      <section className="incident-panel">
        <p className="eyebrow">Bounded catalogue match · सीमित सूची</p>
        <h1>We understood this request</h1>
        <p className="hindi-copy" lang="hi">
          हमने यह अनुरोध समझा
        </p>

        <div className="confirmed-words">
          <span>Confirmed words · पक्के शब्द</span>
          <p>{incident.confirmedText}</p>
        </div>

        {incident.status === "TRANSCRIPT_CONFIRMED" ? (
          <div className="review-card" role="status">
            <strong>Your words are saved.</strong>
            <p lang="hi">आपके शब्द सुरक्षित हैं।</p>
            <p>Task matching did not finish. You can safely try it again.</p>
            <form action={prepareCandidatesAction}>
              <input type="hidden" name="incidentKey" value={incidentId} />
              <button className="button button-teal" type="submit">
                Find catalogue tasks · सूची में काम खोजें
              </button>
            </form>
          </div>
        ) : incident.status === "AWAITING_HUMAN_REVIEW" ? (
          <div className="review-card" role="status">
            <strong>We could not safely match this task.</strong>
            <p lang="hi">
              हम इस काम को सुरक्षित रूप से सूची में नहीं मिला पाए।
            </p>
            <p>The original booking has not changed. A review is required.</p>
          </div>
        ) : incident.status === "TASK_CONFIRMED" ? (
          <div className="confirmed-task-card" role="status">
            <span className="proof-node" aria-hidden="true" />
            <div>
              <strong>Task confirmed · काम की पुष्टि हो गई</strong>
              <p>
                {
                  incident.candidates.find(
                    (task) => task.taskId === incident.selectedTaskId,
                  )?.displayName
                }
              </p>
              <p>
                No policy decision has been made yet. · नीति का फैसला अभी नहीं
                हुआ है।
              </p>
              <form action={retryPolicyDecisionAction}>
                <input type="hidden" name="incidentKey" value={incidentId} />
                <button className="button button-teal" type="submit">
                  Find the policy decision · नीति का फैसला खोजें
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="candidate-stack">
            {incident.candidates.map((candidate) => (
              <article className="candidate-card" key={candidate.taskId}>
                <div>
                  <h2>{candidate.displayName}</h2>
                  <p>{candidate.matchReason}</p>
                </div>
                <form action={confirmTaskAction}>
                  <input type="hidden" name="incidentKey" value={incidentId} />
                  <input
                    type="hidden"
                    name="selectedTaskId"
                    value={candidate.taskId}
                  />
                  <button className="button button-teal" type="submit">
                    Select this · इसे चुनें
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}

        {incident.status === "TASK_CONFIRMATION_REQUIRED" ? (
          <form action={reviseTranscriptAction}>
            <input type="hidden" name="incidentKey" value={incidentId} />
            <button className="text-link link-button" type="submit">
              Edit what I said · मेरे शब्द बदलें
            </button>
          </form>
        ) : null}
        {incident.status === "TASK_CONFIRMATION_REQUIRED" ? (
          <form action={requestTaskReviewAction}>
            <input type="hidden" name="incidentKey" value={incidentId} />
            <button className="secondary-button" type="submit">
              Cannot find the task · काम सूची में नहीं है
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
