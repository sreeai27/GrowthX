import type { PrivateResultCheckpointView } from "../../../../services/providers/private-demo-result";
import {
  dismissPrivateResultAction,
  retryPrivateResultAction,
  sendPrivateResultAction,
} from "./private-result-actions";

export function PrivateResultCheckpoint({
  incidentKey,
  stage,
  checkpoint,
}: {
  incidentKey: string;
  stage: "DECISION" | "COMPLETION";
  checkpoint: PrivateResultCheckpointView;
}) {
  if (checkpoint.state === "DISMISSED") return null;
  if (checkpoint.state === "CAPTURED") {
    const failed = checkpoint.deliveryStatus === "DELIVERY_FAILED";
    const waitingForResult = checkpoint.deliveryStatus === null;
    return (
      <aside className="private-result-checkpoint" aria-labelledby="private-result-status">
        <span className="proof-node" aria-hidden="true" />
        <div>
          <p className="eyebrow">Private result · निजी परिणाम</p>
          <h2 id="private-result-status">
            {failed
              ? "We could not send it yet"
              : waitingForResult
                ? "Contact saved for your final result"
                : "Your result is on its way"}
          </h2>
          <p lang="hi">
            {failed
              ? "अभी भेज नहीं पाए"
              : waitingForResult
                ? "अंतिम परिणाम के लिए संपर्क सुरक्षित है"
                : "आपका परिणाम भेजा जा रहा है"}
          </p>
          <p>
            {checkpoint.maskedDisplay} · {waitingForResult
              ? "We will send the private link when the final result is ready."
              : "Contact is unverified and is not an account."}
          </p>
          {waitingForResult && stage === "COMPLETION" ? (
            <form action={retryPrivateResultAction}>
              <input name="incidentKey" type="hidden" value={incidentKey} />
              <input name="stage" type="hidden" value={stage} />
              <button className="button button-teal">Send my result · परिणाम भेजें</button>
            </form>
          ) : null}
          {failed ? (
            <form action={retryPrivateResultAction}>
              <input name="incidentKey" type="hidden" value={incidentKey} />
              <input name="stage" type="hidden" value={stage} />
              <button className="button button-teal">Try again · फिर कोशिश करें</button>
            </form>
          ) : null}
        </div>
      </aside>
    );
  }

  return (
    <aside className="private-result-checkpoint" aria-labelledby={`keep-result-${stage}`}>
      <span className="proof-node" aria-hidden="true" />
      <div>
        <p className="eyebrow">Optional · वैकल्पिक</p>
        <h2 id={`keep-result-${stage}`}>
          {stage === "COMPLETION" ? "Send me this result" : "Keep your result"}
        </h2>
        <p lang="hi">अपना निजी परिणाम भेजें</p>
        <p>
          Add your email or phone and we&apos;ll send you a private copy of this result. You can separately choose one account invite.
        </p>
        <form action={sendPrivateResultAction} className="private-result-form">
          <input name="incidentKey" type="hidden" value={incidentKey} />
          <input name="stage" type="hidden" value={stage} />
          <label>
            Email or Indian mobile · ईमेल या भारतीय मोबाइल
            <input
              autoComplete="email"
              inputMode="email"
              maxLength={320}
              name="contact"
              placeholder="name@example.com or +91 98765 43210"
              required
            />
          </label>
          <label className="private-result-consent">
            <input name="invitationConsent" type="checkbox" value="yes" />
            <span>Send me one account invitation when accounts are ready · खाता तैयार होने पर एक निमंत्रण भेजें</span>
          </label>
          <p className="private-result-privacy">
            Unverified contact · पहचान सत्यापित नहीं · Link: 7 days · Contact: 30 days
          </p>
          <button className="button button-teal">Send my result · परिणाम भेजें</button>
        </form>
        <form action={dismissPrivateResultAction}>
          <input name="incidentKey" type="hidden" value={incidentKey} />
          <input name="stage" type="hidden" value={stage} />
          <button className="text-link link-button" type="submit">Not now · अभी नहीं</button>
        </form>
      </div>
    </aside>
  );
}
