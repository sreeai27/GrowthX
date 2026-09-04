"use client";

import { useActionState } from "react";
import { revealStudioContact, type RevealState } from "./actions";

const initialState: RevealState = { error: null, value: null };

export function RevealForm({ contactId }: { contactId: string }) {
  const [state, action, pending] = useActionState(revealStudioContact, initialState);
  return <form action={action} className="studio-form studio-reveal"><input name="contactId" type="hidden" value={contactId} /><label htmlFor="reason">Permitted reason</label><select id="reason" name="reason" defaultValue="" required><option value="" disabled>Choose a reason</option><option value="RESULT_DELIVERY">Deliver requested result</option><option value="ACCOUNT_INVITATION">Send consented account invitation</option></select><button className="button button-navy" disabled={pending} type="submit">{pending ? "Recording access…" : "Reveal and record access"}</button>{state.error && <p className="studio-alert" role="alert">{state.error}</p>}{state.value && <output className="studio-revealed" aria-live="polite"><span>Revealed contact</span><strong>{state.value}</strong><small>An immutable access event has been recorded.</small></output>}</form>;
}
