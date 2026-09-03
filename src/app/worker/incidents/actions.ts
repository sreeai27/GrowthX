"use server";

import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { readBrowserCredential } from "../../demo/session";
import { hashCompletionToken, hashDemoToken } from "../../../domain/demo-session";
import { getIncidentGateway } from "../../../services/providers/incident-gateway";
import { getCustomerConfirmationGateway } from "../../../services/providers/customer-confirmation";
import { CompletionSubmissionConflictError, getCompletionVerificationGateway } from "../../../services/providers/completion-verification";
import { env } from "../../../config/env";
import { classifyIncidentAudioQuality, incidentAudioUploadSchema } from "../../../domain/incident-audio";
import { getSpeechProvider, SpeechProviderError } from "../../../services/providers/speech-provider";
import {
  createOpenAiTaskMappingProvider,
  createReviewedTaskMappingProvider,
} from "../../../services/providers/task-mapping-provider";
import { demoBooking, demoTasks } from "../../../../convex/fixtures";

async function requireAccess() {
  const credential = await readBrowserCredential();
  if (!credential) redirect("/demo");
  return {
    publicRunId: credential.publicRunId,
    browserTokenHash: hashDemoToken(credential.privateToken),
  };
}

const incidentKeySchema = z.string().regex(/^inc_[A-Za-z0-9_-]{8,}$/);
const confirmationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
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

async function mapConfirmedReport(confirmedReport: string) {
  const mapper = env.features.openAiMapping
    ? createOpenAiTaskMappingProvider({
        apiKey:
          env.server.openAiApiKey ??
          (() => {
            throw new Error("OPENAI_API_KEY is required when OpenAI mapping is enabled.");
          })(),
        model: env.models.interpreter,
      })
    : createReviewedTaskMappingProvider();
  return mapper.mapReport({
    confirmedReport,
    booking: {
      serviceName: demoBooking.serviceName,
      includedTaskIds: demoBooking.includedTaskIds,
    },
    catalogueSource: {
      sourceId: "task-catalog",
      sourceVersion: demoBooking.catalogVersion,
    },
    catalogue: demoTasks.map(({ taskId, displayName, riskTier }) => ({
      taskId,
      displayName,
      riskTier,
    })),
  });
}

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

export async function captureVoiceAction(formData: FormData) {
  const incidentKey = incidentKeySchema.parse(formData.get("incidentKey"));
  const file = formData.get("audio");
  const durationMs = z.coerce.number().int().positive().parse(formData.get("durationMs"));
  if (!(file instanceof File))
    redirect(`/worker/incidents/${incidentKey}/capture?voiceError=upload`);
  const metadata = incidentAudioUploadSchema.safeParse({
    mimeType: file.type,
    byteLength: file.size,
    durationMs,
  });
  if (!metadata.success)
    redirect(`/worker/incidents/${incidentKey}/capture?voiceError=unusable`);
  const localQuality = classifyIncidentAudioQuality({
    durationMs: metadata.data.durationMs,
    speechDetected: file.size > 0,
    clippingDetected: false,
  });
  if (localQuality === "UNUSABLE")
    redirect(`/worker/incidents/${incidentKey}/capture?voiceError=unusable`);
  const fixtureCase = z.enum(["HINDI_CODEMIX", "MARATHI", "SILENCE", "PROVIDER_FAILURE"])
    .catch("HINDI_CODEMIX")
    .parse(formData.get("fixtureCase"));
  try {
    const audio = new Uint8Array(await file.arrayBuffer());
    const providerTranscript = await getSpeechProvider(fixtureCase).transcribe({
      audio,
      ...metadata.data,
      languageHint: "unknown",
    });
    const transcript = {
      ...providerTranscript,
      quality: localQuality === "RETRY_RECOMMENDED" ? localQuality : providerTranscript.quality,
    } as const;
    const access = await requireAccess();
    await getIncidentGateway().captureVoice({
      ...access,
      incidentKey,
      audio,
      ...metadata.data,
      transcript,
    });
  } catch (error) {
    const code = error instanceof SpeechProviderError ? error.code : "PROVIDER_FAILED";
    const recovery = code === "UNUSABLE_AUDIO" ? "unusable" : code === "TIMEOUT" ? "timeout" : "provider";
    redirect(`/worker/incidents/${incidentKey}/capture?voiceError=${recovery}`);
  }
  redirect(`/worker/incidents/${incidentKey}/transcript`);
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
  const mapping = await mapConfirmedReport(input.confirmedText);
  await getIncidentGateway().prepareCandidates({
    ...access,
    incidentKey: input.incidentKey,
    mapping,
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
  const incident = await getIncidentGateway().get({ ...access, incidentKey });
  if (!incident?.confirmedText) throw new Error("Confirmed wording is required.");
  const mapping = await mapConfirmedReport(incident.confirmedText);
  await getIncidentGateway().prepareCandidates({ ...access, incidentKey, mapping });
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

function confirmationCookieName(incidentKey: string) {
  return `hunar_confirmation_${createHmac("sha256", "cookie-name")
    .update(incidentKey)
    .digest("hex")
    .slice(0, 16)}`;
}

function confirmationCookieSignature(payload: string) {
  const secret = env.server.demoSessionCookieSecret;
  if (!secret || secret.length < 32) {
    throw new Error(
      "DEMO_SESSION_COOKIE_SECRET must contain at least 32 characters.",
    );
  }
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

async function storeConfirmationToken(
  incidentKey: string,
  publicRunId: string,
  rawToken: string,
) {
  const payload = `${incidentKey}.${publicRunId}.${rawToken}`;
  const cookieStore = await cookies();
  cookieStore.set(
    confirmationCookieName(incidentKey),
    `${payload}.${confirmationCookieSignature(payload)}`,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: `/worker/incidents/${incidentKey}`,
      maxAge: 30 * 60,
    },
  );
}

async function readConfirmationToken(
  incidentKey: string,
  publicRunId: string,
): Promise<string | null> {
  const value = (await cookies()).get(
    confirmationCookieName(incidentKey),
  )?.value;
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [storedIncidentKey, storedRunId, rawToken, signature] = parts;
  if (
    storedIncidentKey !== incidentKey ||
    storedRunId !== publicRunId ||
    !rawToken ||
    !signature ||
    !confirmationTokenSchema.safeParse(rawToken).success
  ) {
    return null;
  }
  const payload = `${storedIncidentKey}.${storedRunId}.${rawToken}`;
  const supplied = Buffer.from(signature, "base64url");
  const expected = Buffer.from(
    confirmationCookieSignature(payload),
    "base64url",
  );
  return supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
    ? rawToken
    : null;
}

export async function createCustomerConfirmationAction(formData: FormData) {
  const { incidentKey } = z
    .object({ incidentKey: incidentKeySchema })
    .parse(Object.fromEntries(formData));
  const access = await requireAccess();
  const gateway = getCustomerConfirmationGateway();
  const existing = await gateway.getWorkerConfirmation({
    ...access,
    incidentKey,
  });
  const existingToken = await readConfirmationToken(
    incidentKey,
    access.publicRunId,
  );
  if (existing && existingToken) {
    redirect(`/worker/incidents/${incidentKey}/status`);
  }

  const rawToken = randomBytes(32).toString("base64url");
  const result = await gateway.createConfirmation({
    ...access,
    incidentKey,
    tokenHash: hashDemoToken(rawToken),
    completionTokenHash: hashCompletionToken(rawToken),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (result.created) {
    await storeConfirmationToken(incidentKey, access.publicRunId, rawToken);
  }
  redirect(`/worker/incidents/${incidentKey}/status`);
}

export async function getCustomerConfirmationForWorker(incidentKey: string) {
  const parsedKey = incidentKeySchema.safeParse(incidentKey);
  if (!parsedKey.success) return null;
  const access = await requireAccess();
  const confirmation =
    await getCustomerConfirmationGateway().getWorkerConfirmation({
      ...access,
      incidentKey: parsedKey.data,
    });
  if (!confirmation) return null;
  const rawToken = await readConfirmationToken(
    parsedKey.data,
    access.publicRunId,
  );
  return {
    confirmation,
    rawToken,
  };
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

export async function getCompletionForWorker(incidentKey: string) {
  const parsedKey = incidentKeySchema.safeParse(incidentKey);
  if (!parsedKey.success) return null;
  const access = await requireAccess();
  return getCompletionVerificationGateway().getForWorker({
    ...access,
    incidentKey: parsedKey.data,
  });
}

export async function submitCompletionAction(formData: FormData) {
  const incidentKey = incidentKeySchema.parse(formData.get("incidentKey"));
  const access = await requireAccess();
  const parsed = z.object({
    bookingVersion: z.coerce.number().int().positive(),
    note: z.string().trim().max(500),
  }).safeParse({ bookingVersion: formData.get("bookingVersion"), note: formData.get("note") ?? "" });
  const taskIds = z.array(z.string().min(1)).min(1).safeParse(formData.getAll("taskId"));
  if (!parsed.success || !taskIds.success) redirect(`/worker/incidents/${incidentKey}/completion?error=agreement-changed`);
  const taskStates = taskIds.data.map((taskId) => ({ taskId, state: z.enum(["COMPLETE", "BLOCKED"]).safeParse(formData.get(`state.${taskId}`)) }));
  if (taskStates.some(({ state }) => !state.success)) redirect(`/worker/incidents/${incidentKey}/completion?error=agreement-changed`);
  try {
    await getCompletionVerificationGateway().submitWorkerSummary(
      { ...access, incidentKey },
      { bookingVersion: parsed.data.bookingVersion, taskStates: taskStates.map(({ taskId, state }) => ({ taskId, state: state.data! })), ...(parsed.data.note ? { note: parsed.data.note } : {}) },
    );
  } catch (error) {
    if (error instanceof CompletionSubmissionConflictError) redirect(`/worker/incidents/${incidentKey}/completion?error=agreement-changed`);
    throw error;
  }
  redirect(`/worker/incidents/${incidentKey}/completion`);
}
