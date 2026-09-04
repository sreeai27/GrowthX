"use server";

import { requireStudioActor } from "../auth/current-actor";
import { createFixtureStudioContactGateway, type RevealReason } from "./studio-contact-gateway";

export type RevealState = { error: string | null; value: string | null };

export async function revealStudioContact(_state: RevealState, data: FormData): Promise<RevealState> {
  const actor = await requireStudioActor();
  const reason = String(data.get("reason") ?? "") as RevealReason | "";
  try {
    const value = await createFixtureStudioContactGateway().revealContact({ ...actor, contactId: String(data.get("contactId") ?? ""), reason });
    return { error: null, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : "REVEAL_DENIED";
    return { error: message === "REASON_REQUIRED" ? "Choose a permitted reason before revealing." : "This contact cannot be revealed by your account.", value: null };
  }
}
