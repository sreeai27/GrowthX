import { ConvexError, v } from "convex/values";

import { internalMutation, mutation } from "./_generated/server";
import { appendIncidentTrace, requireIncidentAccess } from "./incidentSupport";
import { DEMO_TENANT_ID } from "./fixtures";

const accessArgs = {
  publicRunId: v.string(),
  browserTokenHash: v.string(),
  incidentKey: v.string(),
};

export const createUploadUrl = mutation({
  args: accessArgs,
  handler: async (context, args) => {
    const { incident } = await requireIncidentAccess(context, args);
    if (incident.status !== "DRAFT")
      throw new ConvexError("Voice capture is not available in this incident state.");
    return context.storage.generateUploadUrl();
  },
});

export const persistTranscript = mutation({
  args: {
    ...accessArgs,
    storageId: v.id("_storage"),
    mimeType: v.string(),
    byteLength: v.number(),
    durationMs: v.number(),
    expiresAt: v.string(),
    transcript: v.object({
      transcript: v.string(),
      detectedLanguage: v.string(),
      languageLabel: v.string(),
      quality: v.union(v.literal("USABLE"), v.literal("RETRY_RECOMMENDED")),
      provider: v.string(),
      model: v.string(),
    }),
  },
  handler: async (context, args) => {
    const { incident, run, nowIso } = await requireIncidentAccess(context, args);
    if (incident.status !== "DRAFT")
      throw new ConvexError("Voice capture is not available in this incident state.");
    if (!args.transcript.transcript.trim())
      throw new ConvexError("Speech provider returned no transcript.");
    const mediaInputId = await context.db.insert("mediaInputs", {
      tenantId: DEMO_TENANT_ID,
      incidentId: incident._id,
      modality: "VOICE",
      capturePurpose: "CUSTOMER_REQUESTED_CHANGE",
      consentBasis: "WORKER_INITIATED_REPORT",
      qualityState: args.transcript.quality,
      rawAudioStorageId: args.storageId,
      rawAudioMimeType: args.mimeType,
      rawAudioByteLength: args.byteLength,
      rawAudioDurationMs: args.durationMs,
      rawAudioExpiresAt: args.expiresAt,
      createdAt: nowIso,
    });
    await context.db.insert("transcripts", {
      tenantId: DEMO_TENANT_ID,
      incidentId: incident._id,
      mediaInputId,
      provider: args.transcript.provider,
      providerModel: args.transcript.model,
      mode: "VOICE",
      detectedLanguages: [args.transcript.detectedLanguage],
      rawTranscript: args.transcript.transcript.trim(),
      inputQualityState: args.transcript.quality,
      createdAt: nowIso,
    });
    await context.db.patch(incident._id, { status: "TRANSCRIPT_READY", updatedAt: nowIso });
    await appendIncidentTrace(context, {
      incident,
      runId: run._id,
      stage: "voice_transcribed",
      actor: "SYSTEM",
      inputSummary: `Worker voice · ${args.durationMs}ms · ${args.mimeType}`,
      outputSummary: `${args.transcript.languageLabel} · ${args.transcript.quality} · ${args.transcript.provider}/${args.transcript.model}`,
      nowIso,
    });
    return { status: "TRANSCRIPT_READY" as const };
  },
});

export const deleteExpiredRawAudio = internalMutation({
  args: { now: v.string() },
  handler: async (context, { now }) => {
    const media = await context.db.query("mediaInputs").collect();
    const expired = media.filter(
      (item) => item.rawAudioStorageId && item.rawAudioExpiresAt && item.rawAudioExpiresAt <= now,
    );
    for (const item of expired) {
      await context.storage.delete(item.rawAudioStorageId!);
      await context.db.patch(item._id, {
        rawAudioStorageId: undefined,
        rawAudioDeletedAt: now,
      });
    }
    return { deleted: expired.length };
  },
});

export const deleteExpiredRawAudioScheduled = internalMutation({
  args: {},
  handler: async (context) => {
    const now = new Date().toISOString();
    const media = await context.db.query("mediaInputs").collect();
    const expired = media.filter(
      (item) => item.rawAudioStorageId && item.rawAudioExpiresAt && item.rawAudioExpiresAt <= now,
    );
    for (const item of expired) {
      await context.storage.delete(item.rawAudioStorageId!);
      await context.db.patch(item._id, { rawAudioStorageId: undefined, rawAudioDeletedAt: now });
    }
    return { deleted: expired.length };
  },
});
