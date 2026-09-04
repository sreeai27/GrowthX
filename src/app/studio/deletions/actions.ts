"use server";

import { redirect } from "next/navigation";
import { requireStudioActor } from "../auth/current-actor";
import { createFixtureStudioContactGateway } from "../contacts/studio-contact-gateway";

export async function reviewDeletion(data: FormData) {
  const actor = await requireStudioActor();
  try {
    await createFixtureStudioContactGateway().reviewDeletion({ ...actor, requestId: String(data.get("requestId") ?? "") });
  } catch (error) {
    const code = error instanceof Error ? error.message : "REVIEW_DENIED";
    redirect(`/studio/deletions?error=${code === "DISTINCT_REVIEWER_REQUIRED" ? "distinct-reviewer" : "access-denied"}`);
  }
  redirect("/studio/deletions?reviewed=1");
}
