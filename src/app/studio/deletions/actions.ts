"use server";

import { redirect } from "next/navigation";
import { requireStudioActor } from "../auth/current-actor";
import { getStudioContactGateway } from "../contacts/studio-contact-gateway";

export async function reviewDeletion(data: FormData) {
  const actor = await requireStudioActor();
  try {
    const decision = String(data.get("decision") ?? "") as "APPROVE" | "REFUSE" | "UNCERTAIN";
    const reason = String(data.get("reason") ?? "").trim();
    if (!reason || !["APPROVE", "REFUSE", "UNCERTAIN"].includes(decision)) throw new Error("REVIEW_DENIED");
    await getStudioContactGateway().reviewDeletion({ ...actor, requestId: String(data.get("requestId") ?? ""), decision, reason });
  } catch (error) {
    const code = error instanceof Error ? error.message : "REVIEW_DENIED";
    redirect(`/studio/deletions?error=${code === "DISTINCT_REVIEWER_REQUIRED" ? "distinct-reviewer" : "access-denied"}`);
  }
  redirect("/studio/deletions?reviewed=1");
}

export async function confirmAndExecuteDeletion(data: FormData) {
  const actor = await requireStudioActor();
  const requestId = String(data.get("requestId") ?? "");
  try {
    const gateway = getStudioContactGateway();
    await gateway.confirmDeletion({ ...actor, requestId });
    await gateway.executeDeletion({ ...actor, requestId });
  } catch { redirect("/studio/deletions?error=access-denied"); }
  redirect("/studio/deletions?deleted=1");
}
