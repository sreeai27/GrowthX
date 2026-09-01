import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getActiveDemoRun } from "../../../demo/session";
import { startTaskConfirmAction } from "../../incidents/actions";

const hindiBookingCopy: Record<string, string> = {
  "Essential Home Cleaning": "ज़रूरी घर की सफ़ाई",
  "Kitchen surface cleaning": "रसोई की सतह की सफ़ाई",
  "One standard bathroom": "एक सामान्य बाथरूम",
  "Standard floor cleaning": "सामान्य फ़र्श की सफ़ाई",
};

export default async function BookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  if (bookingId !== "DEMO-4821") notFound();
  const activeRun = await getActiveDemoRun();
  if (!activeRun || activeRun.bookingKey !== bookingId) redirect("/demo");
  const { booking } = activeRun;

  return (
    <main className="booking-shell">
      <nav className="topbar">
        <Link className="wordmark worker-mark" href="/kaam-saathi">
          KaamSaathi <span lang="hi">कामसाथी</span>
        </Link>
        <span className="demo-badge">DEMO</span>
      </nav>
      <section className="booking-card">
        <p className="eyebrow">
          Active booking · चालू बुकिंग · Fictional demo data
        </p>
        <h1>
          {booking.serviceName} · {hindiBookingCopy[booking.serviceName]}
        </h1>
        <dl className="booking-facts">
          <div>
            <dt>Worker · वर्कर</dt>
            <dd>{booking.workerName}</dd>
          </div>
          <div>
            <dt>Booking · बुकिंग</dt>
            <dd>DEMO-4821</dd>
          </div>
          <div>
            <dt>Status · स्थिति</dt>
            <dd>
              {booking.status === "IN_PROGRESS"
                ? "In progress · काम जारी है"
                : booking.status}
            </dd>
          </div>
          <div>
            <dt>Duration · समय</dt>
            <dd>
              {booking.scheduledDurationMinutes} minutes ·{" "}
              {booking.scheduledDurationMinutes} मिनट
            </dd>
          </div>
        </dl>
        <h2>Included tasks · शामिल काम</h2>
        <ul>
          {booking.includedTasks.map((task) => (
            <li key={task}>
              {task} · {hindiBookingCopy[task]}
            </li>
          ))}
        </ul>
        <p className="hindi-copy" lang="hi">
          यह डेमो बुकिंग 24 घंटे तक इसी ब्राउज़र में जारी रहेगी।
        </p>
        <form action={startTaskConfirmAction}>
          <button className="button button-teal" type="submit">
            Report a customer-requested change · ग्राहक का नया अनुरोध बताएँ
          </button>
        </form>
        <Link className="text-link" href="/demo">
          Back to demo choices · डेमो विकल्पों पर वापस जाएँ
        </Link>
      </section>
    </main>
  );
}
