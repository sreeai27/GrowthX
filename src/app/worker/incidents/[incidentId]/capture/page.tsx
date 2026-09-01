import { redirect } from "next/navigation";

import { captureRequestAction, getIncidentForWorker } from "../../actions";

const presets = [
  {
    key: "BALCONY_DEEP_CLEAN",
    title: "Customer asked for balcony deep cleaning",
    hindi: "ग्राहक ने बालकनी की गहरी सफ़ाई माँगी",
  },
  {
    key: "BOOKING_MISMATCH",
    title: "Customer says the booking is different",
    hindi: "ग्राहक कहता है कि बुकिंग अलग है",
  },
  {
    key: "SAFETY_CONCERN",
    title: "There is a safety concern",
    hindi: "काम की जगह पर सुरक्षा की चिंता है",
  },
] as const;

export default async function CapturePage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  const incident = await getIncidentForWorker(incidentId);
  if (!incident) redirect("/demo");
  if (incident.status !== "DRAFT")
    redirect(`/worker/incidents/${incidentId}/transcript`);

  return (
    <main className="incident-shell">
      <header className="incident-topbar">
        <span className="demo-badge">DEMO</span>
        <span className="incident-step">1 / 3 · REPORT</span>
      </header>
      <section className="incident-panel">
        <p className="eyebrow">Customer-requested change · ग्राहक का अनुरोध</p>
        <h1>What did the customer ask for?</h1>
        <p className="hindi-copy" lang="hi">
          ग्राहक ने क्या नया काम करने को कहा?
        </p>
        <p className="incident-assurance">
          The booking will not change yet. · अभी बुकिंग में कोई बदलाव नहीं होगा।
        </p>

        <form className="incident-form" action={captureRequestAction}>
          <input type="hidden" name="incidentKey" value={incidentId} />
          <input type="hidden" name="modality" value="TEXT" />
          <label htmlFor="customer-request">
            Customer request · ग्राहक का अनुरोध
          </label>
          <textarea
            id="customer-request"
            name="text"
            rows={5}
            minLength={3}
            maxLength={1000}
            required
            placeholder="Example: Balcony ko deep clean karna hai"
          />
          <button className="button button-teal" type="submit">
            Review request · अनुरोध जाँचें
          </button>
        </form>

        <div className="preset-stack">
          <h2>Or choose a reviewed example · या तैयार उदाहरण चुनें</h2>
          {presets.map((preset) => (
            <form action={captureRequestAction} key={preset.key}>
              <input type="hidden" name="incidentKey" value={incidentId} />
              <input type="hidden" name="modality" value="PRESET" />
              <input type="hidden" name="presetKey" value={preset.key} />
              <button className="preset-card" type="submit">
                <strong>{preset.title}</strong>
                <span lang="hi">{preset.hindi}</span>
              </button>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
