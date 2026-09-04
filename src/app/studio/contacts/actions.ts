"use server";

import { z } from "zod";
import { contactRevealPurposeSchema } from "../../../domain/studio-access";
import { requireStudioActor } from "../auth/current-actor";
import { getStudioContactGateway } from "./studio-contact-gateway";

const revealContactInput = z.object({
  contactId: z.string().trim().min(1),
  reason: contactRevealPurposeSchema,
});

export type RevealState = { error: string | null; value: string | null };

export async function revealStudioContact(_state: RevealState, data: FormData): Promise<RevealState> {
  const actor = await requireStudioActor();
  try {
    const input = revealContactInput.parse(Object.fromEntries(data));
    const value = await getStudioContactGateway().revealContact({ ...actor, ...input });
    return { error: null, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : "REVEAL_DENIED";
    return { error: message === "REASON_REQUIRED" ? "Choose a permitted reason before revealing." : "This contact cannot be revealed by your account.", value: null };
  }
}
