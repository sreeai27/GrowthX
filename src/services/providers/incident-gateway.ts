import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { Value } from "convex/values";
import { z } from "zod";

import { env } from "../../config/env";
import {
  transitionIncident,
  type IncidentStatus,
} from "../../domain/incident-state";
import {
  mapReviewedTaskCandidates,
  normaliseWorkerText,
  resolveReviewedPreset,
} from "../../domain/incident-input";
import { getDemoSessionGateway } from "./demo-session-gateway";

const candidateSchema = z.object({
  taskId: z.string(),
  displayName: z.string(),
  matchReason: z.string(),
});
export const workerIncidentViewSchema = z.object({
  incidentKey: z.string(),
  bookingKey: z.literal("DEMO-4821"),
  status: z.enum([
    "DRAFT",
    "INPUT_CAPTURED",
    "TRANSCRIPT_READY",
    "TRANSCRIPT_CONFIRMED",
    "TASK_CONFIRMATION_REQUIRED",
    "TASK_CONFIRMED",
    "AWAITING_HUMAN_REVIEW",
  ]),
  originalText: z.string().nullable(),
  confirmedText: z.string().nullable(),
  wasEdited: z.boolean().nullable(),
  candidates: z.array(candidateSchema),
  selectedTaskId: z.string().nullable(),
  reviewReason: z.string().nullable(),
});
export type WorkerIncidentView = z.infer<typeof workerIncidentViewSchema>;
const startedSchema = z.object({
  incidentKey: z.string(),
  bookingKey: z.literal("DEMO-4821"),
  status: z.literal("DRAFT"),
});
const transcriptReadySchema = z.object({ status: z.literal("TRANSCRIPT_READY") });
const draftSchema = z.object({ status: z.literal("DRAFT") });
const transcriptConfirmedSchema = z.object({ status: z.literal("TRANSCRIPT_CONFIRMED") });
const candidatesResultSchema = z.object({
  status: workerIncidentViewSchema.shape.status,
  candidates: z.array(candidateSchema.pick({ taskId: true, displayName: true })),
});
const reviewResultSchema = z.object({ status: z.literal("AWAITING_HUMAN_REVIEW") });
const taskConfirmedSchema = z.object({
  status: z.literal("TASK_CONFIRMED"),
  selectedTaskId: z.string(),
});

interface Access extends Record<string, Value> {
  publicRunId: string;
  browserTokenHash: string;
}
interface IncidentAccess extends Access {
  incidentKey: string;
}
type CaptureInput =
  | { modality: "TEXT"; text: string }
  | { modality: "PRESET"; presetKey: string };

export interface IncidentGateway {
  start(
    input: Access & { incidentKey: string },
  ): Promise<{ incidentKey: string; bookingKey: string; status: "DRAFT" }>;
  capture(
    input: IncidentAccess & { input: CaptureInput },
  ): Promise<{ status: "TRANSCRIPT_READY" }>;
  retryInput(input: IncidentAccess): Promise<{ status: "DRAFT" }>;
  confirmTranscript(
    input: IncidentAccess & { confirmedText: string },
  ): Promise<{ status: "TRANSCRIPT_CONFIRMED" }>;
  prepareCandidates(
    input: IncidentAccess,
  ): Promise<{
    status: IncidentStatus;
    candidates: Array<{ taskId: string; displayName: string }>;
  }>;
  reviseTranscript(
    input: IncidentAccess,
  ): Promise<{ status: "TRANSCRIPT_READY" }>;
  requestTaskReview(
    input: IncidentAccess,
  ): Promise<{ status: "AWAITING_HUMAN_REVIEW" }>;
  confirmTask(
    input: IncidentAccess & { selectedTaskId: string },
  ): Promise<{ status: "TASK_CONFIRMED"; selectedTaskId: string }>;
  get(input: IncidentAccess): Promise<WorkerIncidentView | null>;
}

const startRef = makeFunctionReference<
  "mutation",
  Access & { incidentKey: string },
  { incidentKey: string; bookingKey: string; status: "DRAFT" }
>("incidents:startTaskConfirm");
const captureRef = makeFunctionReference<
  "mutation",
  IncidentAccess & { input: CaptureInput },
  { status: "TRANSCRIPT_READY" }
>("incidents:captureRequest");
const retryInputRef = makeFunctionReference<
  "mutation",
  IncidentAccess,
  { status: "DRAFT" }
>("incidents:retryInput");
const confirmTranscriptRef = makeFunctionReference<
  "mutation",
  IncidentAccess & { confirmedText: string },
  { status: "TRANSCRIPT_CONFIRMED" }
>("incidents:confirmTranscript");
const prepareRef = makeFunctionReference<
  "mutation",
  IncidentAccess,
  {
    status: IncidentStatus;
    candidates: Array<{ taskId: string; displayName: string }>;
  }
>("incidents:prepareTaskCandidates");
const reviseRef = makeFunctionReference<
  "mutation",
  IncidentAccess,
  { status: "TRANSCRIPT_READY" }
>("incidents:reviseTranscript");
const reviewRef = makeFunctionReference<
  "mutation",
  IncidentAccess,
  { status: "AWAITING_HUMAN_REVIEW" }
>("incidents:requestTaskReview");
const confirmTaskRef = makeFunctionReference<
  "mutation",
  IncidentAccess & { selectedTaskId: string },
  { status: "TASK_CONFIRMED"; selectedTaskId: string }
>("incidents:confirmTask");
const getRef = makeFunctionReference<
  "query",
  IncidentAccess,
  WorkerIncidentView | null
>("incidents:getWorkerIncident");

function convexGateway(url: string): IncidentGateway {
  const client = new ConvexHttpClient(url);
  return {
    async start(input) {
      return startedSchema.parse(await client.mutation(startRef, input));
    },
    async capture(input) {
      return transcriptReadySchema.parse(await client.mutation(captureRef, input));
    },
    async retryInput(input) {
      return draftSchema.parse(await client.mutation(retryInputRef, input));
    },
    async confirmTranscript(input) {
      return transcriptConfirmedSchema.parse(
        await client.mutation(confirmTranscriptRef, input),
      );
    },
    async prepareCandidates(input) {
      return candidatesResultSchema.parse(await client.mutation(prepareRef, input));
    },
    async reviseTranscript(input) {
      return transcriptReadySchema.parse(await client.mutation(reviseRef, input));
    },
    async requestTaskReview(input) {
      return reviewResultSchema.parse(await client.mutation(reviewRef, input));
    },
    async confirmTask(input) {
      return taskConfirmedSchema.parse(await client.mutation(confirmTaskRef, input));
    },
    async get(input) {
      const value = await client.query(getRef, input);
      return value === null ? null : workerIncidentViewSchema.parse(value);
    },
  };
}

const fixtureIncidentSchema = workerIncidentViewSchema.extend({
  publicRunId: z.string(),
});
const fixtureSchema = z.object({ incidents: z.array(fixtureIncidentSchema) });
type FixtureStore = z.infer<typeof fixtureSchema>;
const fixtureCatalogue = [
  { taskId: "balcony_deep_cleaning", displayName: "Balcony deep cleaning", riskTier: 1, active: true },
  { taskId: "inside_cabinet_cleaning", displayName: "Inside-cabinet cleaning", riskTier: 1, active: true },
  { taskId: "wardrobe_assembly", displayName: "Wardrobe assembly", riskTier: 2, active: true },
  { taskId: "exposed_live_wire_response", displayName: "Exposed live wire near work area", riskTier: 3, active: true },
  { taskId: "bathroom_cleaning_standard_1", displayName: "One standard bathroom", riskTier: 1, active: true },
  { taskId: "floor_cleaning_standard", displayName: "Standard floor cleaning", riskTier: 1, active: true },
  { taskId: "kitchen_surface_cleaning", displayName: "Kitchen surface cleaning", riskTier: 1, active: true },
] as const;

function fixtureGateway(path: string): IncidentGateway {
  const absolutePath = resolve(`${path}.incidents`);
  async function read(): Promise<FixtureStore> {
    try {
      return fixtureSchema.parse(
        JSON.parse(await readFile(absolutePath, "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { incidents: [] };
      throw error;
    }
  }
  async function write(store: FixtureStore) {
    await mkdir(dirname(absolutePath), { recursive: true });
    const temporary = `${absolutePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(store), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, absolutePath);
  }
  async function isActive(input: Access) {
    const active = await getDemoSessionGateway().resume({
      publicRunId: input.publicRunId,
      browserTokenHash: input.browserTokenHash,
      now: new Date().toISOString(),
    });
    return Boolean(active);
  }
  async function owned(store: FixtureStore, input: IncidentAccess) {
    if (!(await isActive(input))) return undefined;
    return store.incidents.find(
      (incident) =>
        incident.incidentKey === input.incidentKey &&
        incident.publicRunId === input.publicRunId,
    );
  }
  return {
    async start(input) {
      if (!(await isActive(input)))
        throw new Error("This demo session is unavailable.");
      const store = await read();
      if (
        store.incidents.some(
          (incident) => incident.incidentKey === input.incidentKey,
        )
      )
        throw new Error("Incident ID is unavailable.");
      store.incidents.push({
        publicRunId: input.publicRunId,
        incidentKey: input.incidentKey,
        bookingKey: "DEMO-4821",
        status: "DRAFT",
        originalText: null,
        confirmedText: null,
        wasEdited: null,
        candidates: [],
        selectedTaskId: null,
        reviewReason: null,
      });
      await write(store);
      return {
        incidentKey: input.incidentKey,
        bookingKey: "DEMO-4821",
        status: "DRAFT",
      };
    },
    async capture(input) {
      const store = await read();
      const incident = await owned(store, input);
      if (!incident) throw new Error("Incident is unavailable.");
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
      const text =
        input.input.modality === "TEXT"
          ? normaliseWorkerText(input.input.text)
          : resolveReviewedPreset(input.input.presetKey);
      if (!text) throw new Error("Unknown reviewed preset.");
      incident.originalText = text;
      incident.status = ready.nextStatus;
      await write(store);
      return { status: "TRANSCRIPT_READY" };
    },
    async retryInput(input) {
      const store = await read();
      const incident = await owned(store, input);
      if (!incident) throw new Error("Incident is unavailable.");
      const transition = transitionIncident(
        incident.status,
        { type: "RETRY_INPUT" },
        {},
      );
      incident.status = transition.nextStatus;
      incident.originalText = null;
      incident.confirmedText = null;
      incident.wasEdited = null;
      incident.candidates = [];
      incident.reviewReason = null;
      await write(store);
      return { status: "DRAFT" };
    },
    async confirmTranscript(input) {
      const store = await read();
      const incident = await owned(store, input);
      if (!incident?.originalText) throw new Error("Incident is unavailable.");
      const transition = transitionIncident(
        incident.status,
        { type: "CONFIRM_TRANSCRIPT" },
        {},
      );
      const confirmed = normaliseWorkerText(input.confirmedText);
      incident.confirmedText = confirmed;
      incident.wasEdited = confirmed !== incident.originalText;
      incident.status = transition.nextStatus;
      await write(store);
      return { status: "TRANSCRIPT_CONFIRMED" };
    },
    async prepareCandidates(input) {
      const store = await read();
      const incident = await owned(store, input);
      if (!incident?.confirmedText) throw new Error("Incident is unavailable.");
      const mapped = mapReviewedTaskCandidates(
        incident.confirmedText,
        fixtureCatalogue,
      );
      const candidates = mapped.candidates.map(
        ({ taskId, displayName, matchReason }) => ({
          taskId,
          displayName,
          matchReason,
        }),
      );
      const transition = transitionIncident(
        incident.status,
        { type: mapped.requiresReview ? "ABSTAIN_TO_REVIEW" : "OFFER_CANDIDATES" },
        {},
      );
      incident.candidates = candidates;
      incident.reviewReason = mapped.requiresReview
        ? candidates.length
          ? "HIGH_RISK_TASK"
          : "NO_CATALOGUE_MATCH"
        : null;
      incident.status = transition.nextStatus;
      await write(store);
      return {
        status: transition.nextStatus,
        candidates: candidates.map(({ taskId, displayName }) => ({
          taskId,
          displayName,
        })),
      };
    },
    async reviseTranscript(input) {
      const store = await read();
      const incident = await owned(store, input);
      if (!incident) throw new Error("Incident is unavailable.");
      const transition = transitionIncident(
        incident.status,
        { type: "REVISE_TRANSCRIPT" },
        {},
      );
      incident.status = transition.nextStatus;
      await write(store);
      return { status: "TRANSCRIPT_READY" };
    },
    async requestTaskReview(input) {
      const store = await read();
      const incident = await owned(store, input);
      if (!incident) throw new Error("Incident is unavailable.");
      const transition = transitionIncident(
        incident.status,
        { type: "REQUEST_TASK_REVIEW" },
        {},
      );
      incident.status = transition.nextStatus;
      incident.reviewReason = "WORKER_REJECTED_CANDIDATES";
      await write(store);
      return { status: "AWAITING_HUMAN_REVIEW" };
    },
    async confirmTask(input) {
      const store = await read();
      const incident = await owned(store, input);
      if (
        !incident ||
        !incident.candidates.some(
          (task) => task.taskId === input.selectedTaskId,
        )
      )
        throw new Error("Selected task was not offered for this request.");
      const transition = transitionIncident(
        incident.status,
        { type: "CONFIRM_TASK" },
        { hasConfirmedTranscript: Boolean(incident.confirmedText) },
      );
      incident.selectedTaskId = input.selectedTaskId;
      incident.status = transition.nextStatus;
      await write(store);
      return { status: "TASK_CONFIRMED", selectedTaskId: input.selectedTaskId };
    },
    async get(input) {
      const incident = await owned(await read(), input);
      return incident ? workerIncidentViewSchema.parse(incident) : null;
    },
  };
}

export function getIncidentGateway(): IncidentGateway {
  if (env.features.fixtureMode)
    return fixtureGateway(env.fixtureStorePath ?? ".demo-fixture/runs.json");
  if (!env.public?.convexUrl)
    throw new Error("Incidents require NEXT_PUBLIC_CONVEX_URL.");
  return convexGateway(env.public.convexUrl);
}
