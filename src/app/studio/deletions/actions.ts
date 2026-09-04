"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStudioActor } from "../auth/current-actor";
import { getStudioContactGateway } from "../contacts/studio-contact-gateway";

const reviewDeletionInput = z.object({
  requestId: z.string().trim().min(1),
  decision: z.enum(["APPROVE", "REFUSE", "UNCERTAIN"]),
  reason: z.string().trim().min(1),
});

const executeDeletionInput = z.object({ requestId: z.string().trim().min(1) });

export async function reviewDeletion(data: FormData) {
  const actor = await requireStudioActor();
  try {
    const input = reviewDeletionInput.parse(Object.fromEntries(data));
    await getStudioContactGateway().reviewDeletion({ ...actor, ...input });
  } catch (error) {
    const code = error instanceof Error ? error.message : "REVIEW_DENIED";
    redirect(`/studio/deletions?error=${code === "DISTINCT_REVIEWER_REQUIRED" ? "distinct-reviewer" : "access-denied"}`);
  }
  redirect("/studio/deletions?reviewed=1");
}

export async function confirmAndExecuteDeletion(data: FormData) {
  const actor = await requireStudioActor();
  try {
    const { requestId } = executeDeletionInput.parse(Object.fromEntries(data));
    const gateway = getStudioContactGateway();
    await gateway.confirmDeletion({ ...actor, requestId });
    await gateway.executeDeletion({ ...actor, requestId });
  } catch { redirect("/studio/deletions?error=access-denied"); }
  redirect("/studio/deletions?deleted=1");
}
