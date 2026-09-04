/* eslint-disable @typescript-eslint/no-explicit-any -- The repository's generated-compatible Convex shim has no DataModel/MutationCtx types until deployment codegen. Runtime inputs and persisted fields remain validator-bound. */
import { v } from "convex/values";

import { evaluateReplayAttempt, createReviewedReplay, replayAnswerSchema } from "../src/domain/replay";
import { mutation } from "./_generated/server";
import { findIncidentAccess, requireIncidentAccess } from "./incidentSupport";

const accessArgs = { publicRunId: v.string(), browserTokenHash: v.string(), incidentKey: v.string() };

async function addReplayTrace(context: any, incident: any, stage: string, outputSummary: string, sourceIds: string[]) {
  const steps = await context.db.query("traceSteps").withIndex("by_tenant_incident_sequence", (q: any) => q.eq("tenantId", incident.tenantId)).filter((q: any) => q.eq(q.field("incidentId"), incident._id)).collect();
  const now = new Date().toISOString();
  await context.db.insert("traceSteps", { tenantId: incident.tenantId, incidentId: incident._id, runId: incident.demoRunId, sequence: steps.reduce((highest: number, step: any) => Math.max(highest, step.sequence), 0) + 1, stage, actor: "WORKER", status: "COMPLETED", inputSummary: "Private replay interaction", outputSummary, sourceIds, flowVersion: incident.flowVersion, startedAt: now, completedAt: now, metadata: { bookingVersion: incident.bookingVersion } });
}

async function view(context: any, incident: any) {
  const replay = await context.db.query("replays").withIndex("by_tenant_incident", (q: any) => q.eq("tenantId", incident.tenantId)).filter((q: any) => q.eq(q.field("incidentId"), incident._id)).unique();
  if (!replay) return { kind: "AVAILABLE" as const };
  const attempts = await context.db.query("replayAttempts").withIndex("by_tenant_replay", (q: any) => q.eq("tenantId", incident.tenantId)).filter((q: any) => q.eq(q.field("replayId"), replay._id)).collect();
  const capability = await context.db.query("capabilityEvents").withIndex("by_tenant_incident", (q: any) => q.eq("tenantId", incident.tenantId)).filter((q: any) => q.eq(q.field("incidentId"), incident._id)).unique();
  return { kind: "REPLAY" as const, replay: { id: replay._id, stimulusText: attempts.length ? replay.retryStimulusText : replay.stimulusText, reviewedAudioPath: replay.reviewedAudioPath, sourceId: replay.sourceId, sourceVersion: replay.sourceVersion, rubricVersion: replay.rubricVersion }, attempts: attempts.map((attempt: any) => ({ attemptNumber: attempt.attemptNumber, result: attempt.result, correction: attempt.correction ?? null })), capability: capability ? { result: capability.result, assistanceLevel: capability.assistanceLevel, privateByDefault: capability.privateByDefault, challenged: capability.challenged, sourceId: capability.sourceId, sourceVersion: capability.sourceVersion, rubricVersion: capability.rubricVersion, flowVersion: capability.flowVersion, generatorModelId: capability.generatorModelId, promptVersion: capability.promptVersion, evaluatorModelId: capability.evaluatorModelId, evaluatorVersion: capability.evaluatorVersion, createdAt: capability.createdAt } : null };
}

export const get = mutation({ args: accessArgs, handler: async (context, args) => {
  const access = await findIncidentAccess(context, args);
  if (!access || access.incident.status !== "VERIFIED") return null;
  return view(context, access.incident);
} });

export const generate = mutation({ args: accessArgs, handler: async (context, args) => {
  const { incident } = await requireIncidentAccess(context, args);
  if (incident.status !== "VERIFIED") throw new Error("Replay requires a verified incident.");
  const existing = await context.db.query("replays").withIndex("by_tenant_incident", q => q.eq("tenantId", incident.tenantId)).filter(q => q.eq(q.field("incidentId"), incident._id)).unique();
  if (!existing) {
    const replay = createReviewedReplay(), now = new Date().toISOString();
    await context.db.insert("replays", { tenantId: incident.tenantId, incidentId: incident._id, capabilityKey: replay.capabilityKey, sourceId: replay.source.id, sourceVersion: replay.source.version, rubricVersion: replay.rubric.version, flowVersion: incident.flowVersion, generatorModelId: replay.generator.modelId, promptVersion: replay.generator.promptVersion, stimulusText: replay.stimulusText, retryStimulusText: replay.retryStimulusText, reviewedAudioPath: replay.reviewedAudioPath, createdAt: now });
    await addReplayTrace(context, incident, "replay_started", "Changed reviewed practice created", [replay.source.id]);
  }
  return view(context, incident);
} });

export const submitAttempt = mutation({ args: { ...accessArgs, answer: v.string() }, handler: async (context, args) => {
  const { incident } = await requireIncidentAccess(context, args);
  if (incident.status !== "VERIFIED") throw new Error("Replay requires a verified incident.");
  const replayDoc = await context.db.query("replays").withIndex("by_tenant_incident", q => q.eq("tenantId", incident.tenantId)).filter(q => q.eq(q.field("incidentId"), incident._id)).unique();
  if (!replayDoc) throw new Error("Replay is unavailable.");
  const attempts = await context.db.query("replayAttempts").withIndex("by_tenant_replay", q => q.eq("tenantId", incident.tenantId)).filter(q => q.eq(q.field("replayId"), replayDoc._id)).collect();
  if (attempts.length >= 2) return view(context, incident);
  const answer = replayAnswerSchema.parse(args.answer), evaluation = evaluateReplayAttempt(createReviewedReplay(), answer), attemptNumber = attempts.length + 1, now = new Date().toISOString();
  const final = evaluation.result === "DEMONSTRATED" || attemptNumber === 2;
  await context.db.insert("replayAttempts", { tenantId: incident.tenantId, incidentId: incident._id, replayId: replayDoc._id, attemptNumber, answer, result: evaluation.result, ...(evaluation.correction ? { correction: evaluation.correction } : {}), evaluatorModelId: "deterministic-rubric-v1", evaluatorVersion: "taskconfirm-replay-evaluator-v1", createdAt: now });
  await addReplayTrace(context, incident, attemptNumber === 1 ? "replay_attempt_submitted" : "replay_retry_completed", evaluation.result, [replayDoc.sourceId]);
  if (final) {
    const existing = await context.db.query("capabilityEvents").withIndex("by_tenant_incident", q => q.eq("tenantId", incident.tenantId)).filter(q => q.eq(q.field("incidentId"), incident._id)).unique();
    if (!existing) { await context.db.insert("capabilityEvents", { tenantId: incident.tenantId, workerPublicUserId: incident.workerPublicUserId, incidentId: incident._id, replayId: replayDoc._id, capabilityKey: replayDoc.capabilityKey, result: evaluation.result === "DEMONSTRATED" ? "DEMONSTRATED" : "NOT_YET_DEMONSTRATED", assistanceLevel: attemptNumber === 1 ? "NONE" : "ONE_RETRY", sourceId: replayDoc.sourceId, sourceVersion: replayDoc.sourceVersion, rubricVersion: replayDoc.rubricVersion, flowVersion: replayDoc.flowVersion, generatorModelId: replayDoc.generatorModelId, promptVersion: replayDoc.promptVersion, evaluatorModelId: "deterministic-rubric-v1", evaluatorVersion: "taskconfirm-replay-evaluator-v1", privateByDefault: true, challenged: false, createdAt: now }); await addReplayTrace(context, incident, "capability_recorded", evaluation.result, [replayDoc.sourceId]); }
  }
  return view(context, incident);
} });

export const challenge = mutation({ args: accessArgs, handler: async (context, args) => {
  const { incident } = await requireIncidentAccess(context, args);
  const event = await context.db.query("capabilityEvents").withIndex("by_tenant_incident", q => q.eq("tenantId", incident.tenantId)).filter(q => q.eq(q.field("incidentId"), incident._id)).unique();
  if (!event) throw new Error("Capability event is unavailable.");
  await context.db.patch(event._id, { challenged: true });
  await context.db.insert("humanReviews", { tenantId: incident.tenantId, incidentId: incident._id, reviewType: "CAPABILITY_CHALLENGE", status: "OPEN", reasonCode: "WORKER_CHALLENGED_CAPABILITY_RESULT", contextSnapshot: { confirmedText: "Capability result challenged by worker", bookingVersion: incident.bookingVersion, taskIds: [] }, createdAt: new Date().toISOString() });
  await addReplayTrace(context, incident, "human_review_created", "Worker challenged private capability result", [event.sourceId]);
  return view(context, incident);
} });
