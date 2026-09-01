"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { z } from "zod";

import { readBrowserCredential } from "../../demo/session";
import { hashDemoToken } from "../../../domain/demo-session";
import { getIncidentGateway } from "../../../services/providers/incident-gateway";

async function requireAccess() {
  const credential = await readBrowserCredential();
  if (!credential) redirect("/demo");
  return {
    publicRunId: credential.publicRunId,
    browserTokenHash: hashDemoToken(credential.privateToken),
  };
}

const incidentKeySchema = z.string().regex(/^inc_[A-Za-z0-9_-]{8,}$/);
const typedInputSchema = z.object({
  incidentKey: incidentKeySchema,
  modality: z.literal("TEXT"),
  text: z.string().trim().min(3).max(1_000),
});
const presetInputSchema = z.object({
  incidentKey: incidentKeySchema,
  modality: z.literal("PRESET"),
  presetKey: z.enum([
    "BALCONY_DEEP_CLEAN",
    "BOOKING_MISMATCH",
    "SAFETY_CONCERN",
  ]),
});

export async function startTaskConfirmAction() {
  const access = await requireAccess();
  const incidentKey = `inc_${randomUUID()}`;
  await getIncidentGateway().start({ ...access, incidentKey });
  redirect(`/worker/incidents/${incidentKey}/capture`);
}

export async function captureRequestAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const input =
    raw.modality === "PRESET"
      ? presetInputSchema.parse(raw)
      : typedInputSchema.parse(raw);
  const access = await requireAccess();
  await getIncidentGateway().capture({
    ...access,
    incidentKey: input.incidentKey,
    input:
      input.modality === "TEXT"
        ? { modality: "TEXT", text: input.text }
        : { modality: "PRESET", presetKey: input.presetKey },
  });
  redirect(`/worker/incidents/${input.incidentKey}/transcript`);
}

export async function confirmTranscriptAction(formData: FormData) {
  const input = z
    .object({
      incidentKey: incidentKeySchema,
      confirmedText: z.string().trim().min(3).max(1_000),
    })
    .parse(Object.fromEntries(formData));
  const access = await requireAccess();
  await getIncidentGateway().confirmTranscript({ ...access, ...input });
  await getIncidentGateway().prepareCandidates({
    ...access,
    incidentKey: input.incidentKey,
  });
  redirect(`/worker/incidents/${input.incidentKey}/interpretation`);
}

export async function retryInputAction(formData: FormData) {
  const { incidentKey } = z
    .object({ incidentKey: incidentKeySchema })
    .parse(Object.fromEntries(formData));
  const access = await requireAccess();
  await getIncidentGateway().retryInput({ ...access, incidentKey });
  redirect(`/worker/incidents/${incidentKey}/capture`);
}

export async function prepareCandidatesAction(formData: FormData) {
  const { incidentKey } = z
    .object({ incidentKey: incidentKeySchema })
    .parse(Object.fromEntries(formData));
  const access = await requireAccess();
  await getIncidentGateway().prepareCandidates({ ...access, incidentKey });
  redirect(`/worker/incidents/${incidentKey}/interpretation`);
}

export async function confirmTaskAction(formData: FormData) {
  const input = z
    .object({
      incidentKey: incidentKeySchema,
      selectedTaskId: z.string().min(1),
    })
    .parse(Object.fromEntries(formData));
  const access = await requireAccess();
  await getIncidentGateway().confirmTask({ ...access, ...input });
  await getIncidentGateway().resolveDecision({
    ...access,
    incidentKey: input.incidentKey,
  });
  redirect(`/worker/incidents/${input.incidentKey}/decision`);
}

export async function retryPolicyDecisionAction(formData: FormData) {
  const { incidentKey } = z
    .object({ incidentKey: incidentKeySchema })
    .parse(Object.fromEntries(formData));
  const access = await requireAccess();
  await getIncidentGateway().resolveDecision({ ...access, incidentKey });
  redirect(`/worker/incidents/${incidentKey}/decision`);
}

export async function reviseTranscriptAction(formData: FormData) {
  const { incidentKey } = z
    .object({ incidentKey: incidentKeySchema })
    .parse(Object.fromEntries(formData));
  const access = await requireAccess();
  await getIncidentGateway().reviseTranscript({ ...access, incidentKey });
  redirect(`/worker/incidents/${incidentKey}/transcript`);
}

export async function requestTaskReviewAction(formData: FormData) {
  const { incidentKey } = z
    .object({ incidentKey: incidentKeySchema })
    .parse(Object.fromEntries(formData));
  const access = await requireAccess();
  await getIncidentGateway().requestTaskReview({ ...access, incidentKey });
  redirect(`/worker/incidents/${incidentKey}/interpretation`);
}

export async function getIncidentForWorker(incidentKey: string) {
  const parsedKey = incidentKeySchema.safeParse(incidentKey);
  if (!parsedKey.success) return null;
  const access = await requireAccess();
  return getIncidentGateway().get({ ...access, incidentKey: parsedKey.data });
}

export async function getPolicyDecisionForWorker(incidentKey: string) {
  const parsedKey = incidentKeySchema.safeParse(incidentKey);
  if (!parsedKey.success) return null;
  const access = await requireAccess();
  return getIncidentGateway().getDecision({
    ...access,
    incidentKey: parsedKey.data,
  });
}
