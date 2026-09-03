import { redirect } from "next/navigation";

import {
  confirmTranscriptAction,
  getIncidentForWorker,
  retryInputAction,
} from "../../actions";

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const incident = await getIncidentForWorker(incidentId);
  if (!incident) redirect("/demo");
  if (incident.status === "DRAFT")
    redirect(`/worker/incidents/${incidentId}/capture`);
  if (incident.status !== "TRANSCRIPT_READY")
    redirect(`/worker/incidents/${incidentId}/interpretation`);

  return (
    <main className="incident-shell">
      <header className="incident-topbar">
        <span className="demo-badge">DEMO</span>
        <span className="incident-step">2 / 3 · CONFIRM</span>
      </header>
      <section className="incident-panel transcript-focus">
        <p className="eyebrow">Words before guidance · सलाह से पहले शब्द</p>
        <h1>Is this what you said?</h1>
        <p className="hindi-copy" lang="hi">
          क्या आपने यही कहा?
        </p>
        <p className="quality-state">
          Input quality: {incident.inputQualityState === "RETRY_RECOMMENDED" ? "please review carefully" : "usable"} · इनपुट जाँचें
        </p>
        {incident.detectedLanguages.length ? (
          <p className="transcript-language">
            Detected language: {incident.detectedLanguages.join(", ")} · Provider: {incident.transcriptProvider} / {incident.transcriptModel}
          </p>
        ) : null}
        <p className="incident-assurance">
          Confirmation is required before task matching. · काम मिलाने से पहले
          पुष्टि ज़रूरी है।
        </p>

        <form className="incident-form" action={confirmTranscriptAction}>
          <input type="hidden" name="incidentKey" value={incidentId} />
          <label htmlFor="confirmed-wording">
            Confirmed wording · पक्के शब्द
          </label>
          <textarea
            id="confirmed-wording"
            name="confirmedText"
            rows={6}
            minLength={3}
            maxLength={1000}
            required
            defaultValue={incident.confirmedText ?? incident.originalText ?? ""}
          />
          <button className="button button-teal" type="submit">
            Yes, continue · हाँ, आगे बढ़ें
          </button>
        </form>
        <form action={retryInputAction}>
          <input type="hidden" name="incidentKey" value={incidentId} />
          <button className="secondary-button" type="submit">
            Record again · फिर से रिकॉर्ड करें
          </button>
        </form>
      </section>
    </main>
  );
}
