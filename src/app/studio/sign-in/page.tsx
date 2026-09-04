import Link from "next/link";
import { signInStudio } from "../auth/actions";

export default async function StudioSignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="studio-shell studio-auth"><p className="eyebrow">Hunar Studio · Protected</p><section className="studio-auth-card"><p className="studio-kicker">Individual access</p><h1>Open your operations session</h1><p>Use the one-time link sent to your allowlisted work address. Links expire after 15 minutes; this session closes after eight hours.</p>{error && <p className="studio-alert" role="alert">This link is expired, invalid, or Studio access is not configured.</p>}<form action={signInStudio} className="studio-form"><label htmlFor="oneTimeToken">One-time access token</label><input id="oneTimeToken" name="oneTimeToken" type="password" autoComplete="one-time-code" required /><button className="button button-navy" type="submit">Open Studio</button></form><p className="studio-fineprint">Shared credentials are not supported. हर सदस्य अपने नाम से साइन इन करता है।</p></section><Link className="text-link" href="/hunar-os">Back to Hunar OS</Link></main>;
}
