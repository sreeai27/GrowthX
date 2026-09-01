import {
  confirmCustomerRequestAction,
  getCustomerConfirmation,
  respondToConfirmationAction,
} from "../actions";

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

const terminalCopy = {
  INVALID: ["This link is not valid", "यह लिंक मान्य नहीं है", "Ask the worker for the current link."],
  EXPIRED: ["This link has expired", "इस लिंक की अवधि समाप्त हो गई", "No decision was recorded."],
  STALE: ["The work details changed", "काम की जानकारी बदल गई", "Ask the worker to review the updated decision."],
  APPROVED: ["Change approved", "बदलाव मंज़ूर हुआ", "Your approval is recorded. The work has not been carried out yet."],
  DECLINED: ["Change declined", "बदलाव नामंज़ूर हुआ", "The original booking remains the safe plan."],
  REQUEST_MISMATCH: ["Request does not match", "अनुरोध मेल नहीं खाता", "The worker will need to check the request with you."],
} as const;

function Terminal({ state }: { state: keyof typeof terminalCopy }) {
  const [title, hindi, body] = terminalCopy[state];
  return (
    <main className="customer-confirm-shell">
      <header className="customer-brand"><span>SAHAAY · सहाय</span><small>FICTIONAL DEMO</small></header>
      <article className={`customer-terminal terminal-${state.toLowerCase()}`}>
        <p className="eyebrow">Customer confirmation · ग्राहक पुष्टि</p>
        <h1>{title}</h1>
        <p className="hindi-copy" lang="hi">{hindi}</p>
        <p>{body}</p>
      </article>
    </main>
  );
}

export default async function CustomerConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getCustomerConfirmation(token);
  if (view.kind === "INVALID" || view.kind === "EXPIRED" || view.kind === "STALE") {
    return <Terminal state={view.kind} />;
  }
  if (view.kind === "ALREADY_USED") return <Terminal state={view.status} />;

  const snapshot = view.snapshot;
  const price = money(snapshot.priceDeltaMinor, snapshot.currency);
  return (
    <main className="customer-confirm-shell">
      <header className="customer-brand">
        <span>SAHAAY · सहाय</span>
        <small>FICTIONAL DEMO · NO ACCOUNT NEEDED</small>
      </header>
      <article className="customer-confirm-card">
        <header className="customer-confirm-intro">
          <p className="eyebrow">One requested change · एक अनुरोधित बदलाव</p>
          <h1>{view.requestConfirmed ? "Approve this change" : "Is this your request?"}</h1>
          <p lang="hi">{view.requestConfirmed ? "इस बदलाव को मंज़ूरी दें" : "क्या यह आपका अनुरोध है?"}</p>
        </header>

        <ol className="confirmation-workline" aria-label="Work change details">
          <li><span>1</span><section><p className="decision-label">Original booking · मूल बुकिंग</p><h2>{snapshot.serviceName}</h2><ul>{snapshot.includedTasks.map((task) => <li key={task.taskId}>{task.displayName}</li>)}</ul></section></li>
          <li><span>2</span><section><p className="decision-label">Requested task · अनुरोधित काम</p><h2>{snapshot.taskDisplayName}</h2><p className="classification">{snapshot.decisionState.replaceAll("_", " ")}</p></section></li>
          <li><span>3</span><section><p className="decision-label">Resulting task list · इसके बाद काम</p><ul>{snapshot.resultingTasks.map((task) => <li key={task.taskId}>{task.displayName}</li>)}</ul></section></li>
          <li className="confirmation-proof-step"><span>4</span><section><p className="decision-label">Approved policy impact · नीति के अनुसार असर</p><div className="impact-row"><strong>{price}</strong><strong>{snapshot.durationDeltaMinutes} minutes</strong></div><p lang="hi">{snapshot.durationDeltaMinutes} मिनट · स्वीकृत नीति मूल्य</p></section></li>
        </ol>

        <section className="customer-source-proof" aria-label="Policy source">
          <p className="demo-policy-label">Fictional Sahaay policy · काल्पनिक सहाय नीति</p>
          <h2>{snapshot.sourceTitle}</h2>
          <p className="source-version">Version · संस्करण {snapshot.sourceVersion}</p>
        </section>

        {!view.requestConfirmed ? (
          <section className="customer-question" aria-labelledby="request-question">
            <h2 id="request-question">Did you ask for this change?</h2>
            <p lang="hi">क्या आपने इस बदलाव के लिए कहा था?</p>
            <form action={confirmCustomerRequestAction}>
              <input name="token" type="hidden" value={token} />
              <button className="button button-teal" name="answer" value="YES">Yes, this is my request · हाँ, यह मेरा अनुरोध है</button>
              <button className="secondary-button" name="answer" value="MISMATCH">No, this does not match · नहीं, यह मेल नहीं खाता</button>
            </form>
          </section>
        ) : (
          <section className="customer-question" aria-labelledby="approval-question">
            <h2 id="approval-question">Approve {price} and {snapshot.durationDeltaMinutes} extra minutes?</h2>
            <p lang="hi">क्या आप यह अतिरिक्त मूल्य और समय मंज़ूर करते हैं?</p>
            <form action={respondToConfirmationAction}>
              <input name="token" type="hidden" value={token} />
              <button className="button button-teal" name="response" value="APPROVE">Approve {price} · मंज़ूर करें</button>
              <button className="secondary-button" name="response" value="DECLINE">Decline change · बदलाव मना करें</button>
            </form>
          </section>
        )}
      </article>
    </main>
  );
}
