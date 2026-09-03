import { ConvexError, v } from "convex/values";

import { canAccessDemoRun } from "../src/domain/demo-session-policy";
import {
  mapReviewedTaskCandidates,
  normaliseWorkerText,
  resolveReviewedPreset,
} from "../src/domain/incident-input";
import { mutation, query } from "./_generated/server";
import { DEMO_TENANT_ID } from "./fixtures";
import { transitionIncident } from "../src/domain/incident-state";
import {
  appendIncidentTrace,
  findIncidentAccess,
  INCIDENT_FLOW_VERSION,
  requireIncidentAccess,
} from "./incidentSupport";

const FLOW_VERSION = INCIDENT_FLOW_VERSION;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RUN_ID_PATTERN = /^run_[A-Za-z0-9_-]{8,}$/;
const INCIDENT_KEY_PATTERN = /^inc_[A-Za-z0-9_-]{8,}$/;

export const startTaskConfirm = mutation({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
    incidentKey: v.string(),
  },
  handler: async (context, args) => {
    if (
      !RUN_ID_PATTERN.test(args.publicRunId) ||
      !HASH_PATTERN.test(args.browserTokenHash) ||
      !INCIDENT_KEY_PATTERN.test(args.incidentKey)
    ) {
      throw new ConvexError("Invalid incident request.");
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const run = await context.db
      .query("demoRuns")
      .withIndex("by_tenant_public_run", (query) =>
        query.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((query) => query.eq(query.field("publicRunId"), args.publicRunId))
      .unique();
    if (!canAccessDemoRun(run, args.browserTokenHash, now))
      throw new ConvexError("This demo session is unavailable.");

    const booking = await context.db
      .query("bookings")
      .withIndex("by_tenant_booking_key", (query) =>
        query.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((query) => query.eq(query.field("bookingKey"), run.bookingKey))
      .unique();
    if (!booking) throw new ConvexError("Demo booking is unavailable.");

    const duplicate = await context.db
      .query("incidents")
      .withIndex("by_tenant_incident_key", (query) =>
        query.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((query) => query.eq(query.field("incidentKey"), args.incidentKey))
      .unique();
    if (duplicate) throw new ConvexError("Incident ID is unavailable.");

    const incidentId = await context.db.insert("incidents", {
      incidentKey: args.incidentKey,
      tenantId: DEMO_TENANT_ID,
      demoRunId: run._id,
      scenarioPack: "TASK_CONFIRM",
      bookingKey: booking.bookingKey,
      bookingVersion: booking.version,
      workerPublicUserId: booking.workerPublicUserId,
      status: "DRAFT",
      riskTier: 0,
      supportState: "PENDING",
      flowVersion: FLOW_VERSION,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    await appendIncidentTrace(context, {
      incident: { _id: incidentId, bookingVersion: booking.version },
      runId: run._id,
      stage: "incident_started",
      actor: "WORKER",
      inputSummary: "Active demo booking selected.",
      outputSummary: "TaskConfirm incident created without changing booking.",
      sourceIds: [booking.catalogVersion],
      nowIso,
    });
    return {
      incidentKey: args.incidentKey,
      bookingKey: booking.bookingKey,
      status: "DRAFT" as const,
    };
  },
});

export const captureRequest = mutation({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
    incidentKey: v.string(),
    input: v.union(
      v.object({ modality: v.literal("TEXT"), text: v.string() }),
      v.object({ modality: v.literal("PRESET"), presetKey: v.string() }),
    ),
  },
  handler: async (context, args) => {
    const { run, incident, nowIso } = await requireIncidentAccess(
      context,
      args,
    );
    const captured = transitionIncident(
      incident.status,
      { type: "CAPTURE_INPUT" },
      {},
    );
    const ready = transitionIncident(
      captured.nextStatus,
      { type: "PREPARE_TRANSCRIPT" },
      {},
    );
    const rawText =
      args.input.modality === "TEXT"
        ? args.input.text
        : resolveReviewedPreset(args.input.presetKey);
    if (!rawText) throw new ConvexError("Unknown reviewed preset.");
    const text = normaliseWorkerText(rawText);
    if (text.length < 3 || text.length > 1_000)
      throw new ConvexError("Enter a request between 3 and 1000 characters.");

    const mediaInputId = await context.db.insert("mediaInputs", {
      tenantId: DEMO_TENANT_ID,
      incidentId: incident._id,
      modality: args.input.modality,
      capturePurpose: "CUSTOMER_REQUESTED_CHANGE",
      consentBasis: "WORKER_INITIATED_REPORT",
      qualityState: "USABLE",
      createdAt: nowIso,
    });
    await context.db.insert("transcripts", {
      tenantId: DEMO_TENANT_ID,
      incidentId: incident._id,
      mediaInputId,
      provider: "TYPED_OR_REVIEWED_PRESET",
      providerModel: "deterministic-input-v1",
      mode: args.input.modality,
      detectedLanguages: [],
      rawTranscript: text,
      inputQualityState: "USABLE",
      createdAt: nowIso,
    });
    await context.db.patch(incident._id, {
      status: ready.nextStatus,
      updatedAt: nowIso,
    });
    await appendIncidentTrace(context, {
      incident,
      runId: run._id,
      stage: captured.auditEvent,
      actor: "WORKER",
      inputSummary:
        args.input.modality === "TEXT"
          ? "Worker supplied a typed request."
          : "Worker selected a reviewed request preset.",
      outputSummary: "Request wording stored for confirmation.",
      nowIso,
    });
    await appendIncidentTrace(context, {
      incident,
      runId: run._id,
      stage: ready.auditEvent,
      actor: "SYSTEM",
      inputSummary: "Typed input processed deterministically.",
      outputSummary: "Transcript is ready for worker confirmation.",
      nowIso,
    });
    return { status: "TRANSCRIPT_READY" as const };
  },
});

export const retryInput = mutation({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
    incidentKey: v.string(),
  },
  handler: async (context, args) => {
    const { run, incident, nowIso } = await requireIncidentAccess(
      context,
      args,
    );
    const transition = transitionIncident(
      incident.status,
      { type: "RETRY_INPUT" },
      {},
    );
    await context.db.patch(incident._id, {
      status: transition.nextStatus,
      updatedAt: nowIso,
    });
    await appendIncidentTrace(context, {
      incident,
      runId: run._id,
      stage: transition.auditEvent,
      actor: "WORKER",
      inputSummary: "Worker chose to retry request capture.",
      outputSummary: "Incident returned to request capture.",
      nowIso,
    });
    return { status: "DRAFT" as const };
  },
});

export const confirmTranscript = mutation({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
    incidentKey: v.string(),
    confirmedText: v.string(),
  },
  handler: async (context, args) => {
    const { run, incident, nowIso } = await requireIncidentAccess(
      context,
      args,
    );
    const transition = transitionIncident(
      incident.status,
      { type: "CONFIRM_TRANSCRIPT" },
      {},
    );
    const transcripts = await context.db
      .query("transcripts")
      .withIndex("by_tenant_incident", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) => filter.eq(filter.field("incidentId"), incident._id))
      .collect();
    const transcript = transcripts.at(-1);
    if (!transcript) throw new ConvexError("Transcript is unavailable.");
    const confirmedText = normaliseWorkerText(args.confirmedText);
    if (confirmedText.length < 3 || confirmedText.length > 1_000)
      throw new ConvexError("Confirm between 3 and 1000 characters.");

    await context.db.insert("transcriptConfirmations", {
      tenantId: DEMO_TENANT_ID,
      incidentId: incident._id,
      transcriptId: transcript._id,
      confirmedBy: incident.workerPublicUserId,
      originalText: transcript.rawTranscript,
      confirmedText,
      wasEdited: confirmedText !== transcript.rawTranscript,
      editSummary:
        confirmedText === transcript.rawTranscript
          ? "No edit."
          : "Worker edited the captured wording before confirmation.",
      confirmedAt: nowIso,
    });
    await context.db.patch(incident._id, {
      status: transition.nextStatus,
      updatedAt: nowIso,
    });
    await appendIncidentTrace(context, {
      incident,
      runId: run._id,
      stage: transition.auditEvent,
      actor: "WORKER",
      inputSummary: "Worker reviewed the captured wording.",
      outputSummary:
        confirmedText === transcript.rawTranscript
          ? "Original wording confirmed."
          : "Edited wording confirmed; original retained.",
      nowIso,
    });
    return { status: "TRANSCRIPT_CONFIRMED" as const };
  },
});

export const getWorkerIncident = query({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
    incidentKey: v.string(),
  },
  handler: async (context, args) => {
    const access = await findIncidentAccess(context, args);
    if (!access) return null;
    const { incident } = access;
    const transcripts = await context.db
      .query("transcripts")
      .withIndex("by_tenant_incident", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) => filter.eq(filter.field("incidentId"), incident._id))
      .collect();
    const transcript = transcripts.at(-1);
    const confirmations = await context.db
      .query("transcriptConfirmations")
      .withIndex("by_tenant_incident", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) => filter.eq(filter.field("incidentId"), incident._id))
      .collect();
    const confirmation = confirmations.at(-1);
    const interpretations = await context.db
      .query("exceptionInterpretations")
      .withIndex("by_tenant_incident", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) => filter.eq(filter.field("incidentId"), incident._id))
      .collect();
    const interpretation = interpretations.at(-1);
    const taskConfirmation = await context.db
      .query("taskConfirmations")
      .withIndex("by_tenant_incident", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) => filter.eq(filter.field("incidentId"), incident._id))
      .unique();
    const review = await context.db
      .query("humanReviews")
      .withIndex("by_tenant_incident", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) => filter.eq(filter.field("incidentId"), incident._id))
      .unique();
    return {
      incidentKey: incident.incidentKey,
      bookingKey: incident.bookingKey,
      status: incident.status,
      originalText: transcript?.rawTranscript ?? null,
      confirmedText: confirmation?.confirmedText ?? null,
      wasEdited: confirmation?.wasEdited ?? null,
      candidates: interpretation?.candidateTasks ?? [],
      selectedTaskId: taskConfirmation?.selectedTaskId ?? null,
      reviewReason: review?.reasonCode ?? null,
      detectedLanguages: transcript?.detectedLanguages ?? [],
      inputQualityState: transcript?.inputQualityState ?? null,
      transcriptProvider: transcript?.provider ?? null,
      transcriptModel: transcript?.providerModel ?? null,
    };
  },
});

export const prepareTaskCandidates = mutation({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
    incidentKey: v.string(),
  },
  handler: async (context, args) => {
    const { run, incident, nowIso } = await requireIncidentAccess(
      context,
      args,
    );
    const confirmations = await context.db
      .query("transcriptConfirmations")
      .withIndex("by_tenant_incident", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) => filter.eq(filter.field("incidentId"), incident._id))
      .collect();
    const confirmation = confirmations.at(-1);
    if (!confirmation) throw new ConvexError("Confirmed wording is required.");
    const catalogue = await context.db
      .query("taskCatalog")
      .withIndex("by_tenant_task", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .collect();
    const mapped = mapReviewedTaskCandidates(
      confirmation.confirmedText,
      catalogue,
    );
    const candidates = mapped.candidates.map(
      ({ taskId, displayName, matchReason }) => ({
        taskId,
        displayName,
        matchReason,
      }),
    );
    const { requiresReview } = mapped;
    const transition = transitionIncident(
      incident.status,
      { type: requiresReview ? "ABSTAIN_TO_REVIEW" : "OFFER_CANDIDATES" },
      {},
    );
    const interpretationId = await context.db.insert(
      "exceptionInterpretations",
      {
        tenantId: DEMO_TENANT_ID,
        incidentId: incident._id,
        confirmedTranscriptId: confirmation._id,
        flowVersion: FLOW_VERSION,
        promptVersion: "reviewed-term-mapper-v1",
        modelId: "deterministic-reviewed-mapper-v1",
        reportedRequest: confirmation.confirmedText,
        summary: requiresReview
          ? "No safe bounded task selection is available."
          : "Worker confirmation is required for the bounded task candidate.",
        candidateTasks: candidates,
        shouldAbstain: requiresReview,
        abstentionReason: requiresReview
          ? candidates.length === 0
            ? "NO_CATALOGUE_MATCH"
            : "HIGH_RISK_TASK"
          : undefined,
        createdAt: nowIso,
      },
    );
    if (requiresReview) {
      await context.db.insert("humanReviews", {
        tenantId: DEMO_TENANT_ID,
        incidentId: incident._id,
        reviewType: "TASK_MAPPING",
        status: "OPEN",
        reasonCode:
          candidates.length === 0 ? "NO_CATALOGUE_MATCH" : "HIGH_RISK_TASK",
        contextSnapshot: { confirmedText: confirmation.confirmedText },
        createdAt: nowIso,
      });
    }
    await context.db.patch(incident._id, {
      status: transition.nextStatus,
      supportState: requiresReview ? "ESCALATED" : "PENDING",
      updatedAt: nowIso,
    });
    await appendIncidentTrace(context, {
      incident,
      runId: run._id,
      stage: transition.auditEvent,
      actor: "SYSTEM",
      inputSummary:
        "Confirmed wording compared with the active task catalogue.",
      outputSummary: requiresReview
        ? "Mapping abstained and review opened."
        : `${candidates.length} bounded candidate offered.`,
      sourceIds: ["task-catalog-v1"],
      nowIso,
    });
    void interpretationId;
    return {
      status: transition.nextStatus,
      candidates: candidates.map(({ taskId, displayName }) => ({
        taskId,
        displayName,
      })),
    };
  },
});

export const reviseTranscript = mutation({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
    incidentKey: v.string(),
  },
  handler: async (context, args) => {
    const { run, incident, nowIso } = await requireIncidentAccess(
      context,
      args,
    );
    const transition = transitionIncident(
      incident.status,
      { type: "REVISE_TRANSCRIPT" },
      {},
    );
    await context.db.patch(incident._id, {
      status: transition.nextStatus,
      updatedAt: nowIso,
    });
    await appendIncidentTrace(context, {
      incident,
      runId: run._id,
      stage: transition.auditEvent,
      actor: "WORKER",
      inputSummary: "Worker chose to revise confirmed wording.",
      outputSummary: "Incident returned to transcript confirmation.",
      nowIso,
    });
    return { status: "TRANSCRIPT_READY" as const };
  },
});

export const requestTaskReview = mutation({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
    incidentKey: v.string(),
  },
  handler: async (context, args) => {
    const { run, incident, nowIso } = await requireIncidentAccess(
      context,
      args,
    );
    const transition = transitionIncident(
      incident.status,
      { type: "REQUEST_TASK_REVIEW" },
      {},
    );
    const confirmations = await context.db
      .query("transcriptConfirmations")
      .withIndex("by_tenant_incident", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) => filter.eq(filter.field("incidentId"), incident._id))
      .collect();
    const confirmedText = confirmations.at(-1)?.confirmedText;
    if (!confirmedText) throw new ConvexError("Confirmed wording is required.");
    await context.db.insert("humanReviews", {
      tenantId: DEMO_TENANT_ID,
      incidentId: incident._id,
      reviewType: "TASK_MAPPING",
      status: "OPEN",
      reasonCode: "WORKER_REJECTED_CANDIDATES",
      contextSnapshot: { confirmedText },
      createdAt: nowIso,
    });
    await context.db.patch(incident._id, {
      status: transition.nextStatus,
      supportState: "ESCALATED",
      updatedAt: nowIso,
    });
    await appendIncidentTrace(context, {
      incident,
      runId: run._id,
      stage: transition.auditEvent,
      actor: "WORKER",
      inputSummary: "Worker rejected all offered task candidates.",
      outputSummary: "Task mapping review opened without selecting a task.",
      sourceIds: ["task-catalog-v1"],
      nowIso,
    });
    return { status: "AWAITING_HUMAN_REVIEW" as const };
  },
});

export const confirmTask = mutation({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
    incidentKey: v.string(),
    selectedTaskId: v.string(),
  },
  handler: async (context, args) => {
    const { run, incident, nowIso } = await requireIncidentAccess(
      context,
      args,
    );
    const interpretations = await context.db
      .query("exceptionInterpretations")
      .withIndex("by_tenant_incident", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) => filter.eq(filter.field("incidentId"), incident._id))
      .collect();
    const interpretation = interpretations.at(-1);
    const confirmations = await context.db
      .query("transcriptConfirmations")
      .withIndex("by_tenant_incident", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) => filter.eq(filter.field("incidentId"), incident._id))
      .collect();
    const confirmation = confirmations.at(-1);
    const activeTask = await context.db
      .query("taskCatalog")
      .withIndex("by_tenant_task", (range) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((filter) =>
        filter.eq(filter.field("taskId"), args.selectedTaskId),
      )
      .unique();
    if (
      !interpretation ||
      interpretation.shouldAbstain ||
      !activeTask?.active ||
      !interpretation.candidateTasks.some(
        (task: { taskId: string }) => task.taskId === args.selectedTaskId,
      )
    )
      throw new ConvexError("Selected task was not offered for this request.");
    const transition = transitionIncident(
      incident.status,
      { type: "CONFIRM_TASK" },
      { hasConfirmedTranscript: Boolean(confirmation) },
    );
    await context.db.insert("taskConfirmations", {
      tenantId: DEMO_TENANT_ID,
      incidentId: incident._id,
      interpretationId: interpretation._id,
      selectedTaskId: activeTask.taskId,
      confirmedByWorker: incident.workerPublicUserId,
      confirmedAt: nowIso,
    });
    await context.db.patch(incident._id, {
      status: transition.nextStatus,
      riskTier: activeTask.riskTier,
      updatedAt: nowIso,
    });
    await appendIncidentTrace(context, {
      incident,
      runId: run._id,
      stage: transition.auditEvent,
      actor: "WORKER",
      inputSummary: "Worker selected one offered catalogue task.",
      outputSummary: `Task ${activeTask.taskId} confirmed.`,
      sourceIds: [activeTask.catalogVersion],
      nowIso,
    });
    return {
      status: "TASK_CONFIRMED" as const,
      selectedTaskId: activeTask.taskId,
    };
  },
});
