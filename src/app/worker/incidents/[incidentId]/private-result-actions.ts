"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { hashDemoToken } from "../../../../domain/demo-session";
import { getPrivateDemoResultGateway } from "../../../../services/providers/private-demo-result";
import { readBrowserCredential } from "../../../demo/session";

const incidentKeySchema = z.string().regex(/^inc_[A-Za-z0-9_-]{8,}$/);
const stageSchema = z.enum(["DECISION", "COMPLETION"]);

function routeFor(incidentKey: string, stage: z.infer<typeof stageSchema>) {
  return `/worker/incidents/${incidentKey}/${stage === "DECISION" ? "decision" : "completion"}`;
}

async function requireResultAccess() {
  const credential = await readBrowserCredential();
  if (!credential) redirect("/demo");
  return {
    publicRunId: credential.publicRunId,
    browserTokenHash: hashDemoToken(credential.privateToken),
  };
}

export async function getPrivateResultCheckpoint(
  incidentKey: string,
  stage: "DECISION" | "COMPLETION",
) {
  const parsedKey = incidentKeySchema.safeParse(incidentKey);
  if (!parsedKey.success) return null;
  const access = await requireResultAccess();
  return getPrivateDemoResultGateway().getCheckpoint(
    access,
    parsedKey.data,
    stage,
  );
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) throw new Error("Private result delivery requires a request host.");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export async function sendPrivateResultAction(formData: FormData) {
  const input = z.object({
    incidentKey: incidentKeySchema,
    stage: stageSchema,
    contact: z.string().trim().min(3).max(320),
    invitationConsent: z.string().optional(),
  }).parse(Object.fromEntries(formData));
  const access = await requireResultAccess();
  const destination = routeFor(input.incidentKey, input.stage);
  try {
    await getPrivateDemoResultGateway().captureAndSend(access, input.incidentKey, {
      contact: input.contact,
      invitationConsent: input.invitationConsent === "yes",
      origin: await requestOrigin(),
      stage: input.stage,
    });
    redirect(`${destination}?resultDelivery=sent`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(`${destination}?resultDelivery=failed`);
  }
}

export async function retryPrivateResultAction(formData: FormData) {
  const input = z.object({ incidentKey: incidentKeySchema, stage: stageSchema })
    .parse(Object.fromEntries(formData));
  const access = await requireResultAccess();
  const destination = routeFor(input.incidentKey, input.stage);
  try {
    await getPrivateDemoResultGateway().retryDelivery(
      access,
      input.incidentKey,
      await requestOrigin(),
    );
    redirect(`${destination}?resultDelivery=sent`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw error;
    redirect(`${destination}?resultDelivery=failed`);
  }
}

export async function dismissPrivateResultAction(formData: FormData) {
  const input = z.object({ incidentKey: incidentKeySchema, stage: stageSchema })
    .parse(Object.fromEntries(formData));
  const access = await requireResultAccess();
  await getPrivateDemoResultGateway().dismissCheckpoint(
    access,
    input.incidentKey,
    input.stage,
  );
  redirect(routeFor(input.incidentKey, input.stage));
}
