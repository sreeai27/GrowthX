"use server";

import { redirect } from "next/navigation";

import { hashDemoToken } from "../../domain/demo-session";
import { getDemoSessionGateway } from "../../services/providers/demo-session-gateway";
import {
  createBrowserCredential,
  readBrowserCredential,
  sessionStartInput,
  storeBrowserCredential,
} from "./session";

export async function startDemoAction() {
  const credential = createBrowserCredential();
  const started = await getDemoSessionGateway().start(
    sessionStartInput(credential, new Date()),
  );
  await storeBrowserCredential(credential);
  redirect(`/worker/bookings/${started.bookingKey}`);
}

export async function restartDemoAction() {
  const current = await readBrowserCredential();
  if (!current) redirect("/demo");

  const replacement = createBrowserCredential();
  const input = sessionStartInput(replacement, new Date());
  const restarted = await getDemoSessionGateway().restart({
    currentPublicRunId: current.publicRunId,
    currentTokenHash: hashDemoToken(current.privateToken),
    replacementPublicRunId: input.publicRunId,
    replacementTokenHash: input.browserTokenHash,
    now: input.now,
    resumeExpiresAt: input.resumeExpiresAt,
  });
  if (!restarted) redirect("/demo");
  await storeBrowserCredential(replacement);
  redirect(`/worker/bookings/${restarted.bookingKey}`);
}
