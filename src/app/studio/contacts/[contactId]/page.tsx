import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudioActor } from "../../auth/current-actor";
import { RevealForm } from "../reveal-form";
import { getStudioContactGateway } from "../studio-contact-gateway";
export const dynamic = "force-dynamic";

export default async function StudioContactPage({ params }: { params: Promise<{ contactId: string }> }) {
  const actor = await requireStudioActor();
  const { contactId } = await params;
  const contact = await getStudioContactGateway().getContact(actor, contactId);
  if (!contact) notFound();
  return <main className="studio-shell studio-detail"><Link className="text-link" href="/studio/contacts">← Masked contact ledger</Link><header><p className="eyebrow">Protected contact · {contact.channel}</p><h1>{contact.maskedDisplay}</h1><p>The contact remains masked until an authorised administrator states why access is needed.</p></header><section className="studio-proof"><div><span>Result retention</span><strong>30 days</strong></div><div><span>Invitation consent</span><strong>{contact.invitationConsent ? "Recorded separately" : "Not granted"}</strong></div></section>{actor.role === "PLATFORM_ADMIN" ? <section className="studio-action-panel"><p className="studio-kicker">Privileged action</p><h2>Reveal for one permitted purpose</h2><p>Your name, reason, contact ID and time are added to the immutable access record.</p><RevealForm contactId={contact.contactId} /></section> : <aside className="studio-locked" aria-label="Contact reveal unavailable"><strong>Contact reveal is not available to operators.</strong><p>Use the masked value for routine result-delivery checks. Ask a platform administrator only when full contact is required.</p></aside>}</main>;
}
