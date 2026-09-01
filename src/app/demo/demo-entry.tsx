import Link from "next/link";

interface ActiveDemoRun {
  readonly publicRunId: string;
  readonly bookingKey: string;
}

interface DemoEntryProps {
  readonly activeRun: ActiveDemoRun | null;
  readonly startAction: () => void | Promise<void>;
  readonly restartAction: () => void | Promise<void>;
}

export function DemoEntry({
  activeRun,
  startAction,
  restartAction,
}: DemoEntryProps) {
  return (
    <main className="demo-entry">
      <nav className="topbar" aria-label="Audience">
        <Link className="wordmark worker-mark" href="/kaam-saathi">
          KaamSaathi <span lang="hi">कामसाथी</span>
        </Link>
        <Link className="audience-switch" href="/hunar-os">
          For operators · <span lang="hi">ऑपरेटर के लिए</span>{" "}
          <span aria-hidden="true">↗</span>
        </Link>
      </nav>

      <section className="demo-intro">
        <div>
          <span className="demo-badge">DEMO</span>
          <p className="eyebrow">Guided TaskConfirm demo · निर्देशित डेमो</p>
          <h1>
            You will play Asha, a home-service specialist.
            <span className="hindi-copy" lang="hi">
              {" "}
              आप आशा की भूमिका निभाएँगे।
            </span>
          </h1>
          <p className="lede">
            A second tab or phone will play the customer. The booking,
            catalogue, prices and policy are fictional demonstration data.
          </p>
          <p className="hindi-copy" lang="hi">
            आप आशा की भूमिका निभाएँगे। यह बुकिंग और सभी कीमतें केवल डेमो के लिए
            हैं।
          </p>
        </div>

        <aside className="demo-device-card" aria-label="Demo instructions">
          <span className="moment-label">
            No account needed · खाता ज़रूरी नहीं
          </span>
          <strong>
            Your private attempt stays in this browser for 24 hours. · आपका निजी
            डेमो इस ब्राउज़र में 24 घंटे रहेगा।
          </strong>
          <p>
            We do not use contact details to restore the demo. · हम डेमो वापस
            लाने के लिए संपर्क जानकारी का उपयोग नहीं करते।
          </p>
          <label htmlFor="demo-input-fallback">
            If the microphone does not work · अगर माइक्रोफ़ोन न चले
          </label>
          <select id="demo-input-fallback" defaultValue="type">
            <option value="type">
              Type the worker’s report · रिपोर्ट टाइप करें
            </option>
            <option value="preset">
              Use a preset example · तैयार उदाहरण चुनें
            </option>
          </select>
          <button className="text-link" type="button" disabled>
            Open trace after the run · रन के बाद ट्रेस खोलें
          </button>

          {activeRun ? (
            <div className="demo-actions">
              <Link
                className="button button-teal"
                href={`/worker/bookings/${activeRun.bookingKey}`}
              >
                Continue your demo · डेमो जारी रखें
              </Link>
              <form action={restartAction}>
                <button className="secondary-button" type="submit">
                  Start a new demo · नया डेमो शुरू करें
                </button>
              </form>
            </div>
          ) : (
            <form action={startAction}>
              <button className="button button-teal" type="submit">
                Start as worker · वर्कर के रूप में शुरू करें
              </button>
            </form>
          )}
        </aside>
      </section>
    </main>
  );
}
