import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { Value } from "convex/values";
import { z } from "zod";

import { env } from "../../config/env";
import {
  completionSummaryInputSchema,
  computeVerification,
  customerCompletionResponseSchema,
  resolveCustomerCompletionResponse,
  validateWorkerCompletion,
} from "../../domain/completion-verification";
import { transitionIncident } from "../../domain/incident-state";

const taskSchema = z.object({ taskId: z.string().min(1), displayName: z.string().min(1) }).strict();
const receiptSchema = z.object({
  connector: z.string().min(1), externalActionId: z.string().min(1),
  resultingBookingVersion: z.number().int().positive(), executedAt: z.string().datetime(),
}).strict();
const agreementSchema = z.object({
  bookingKey: z.string().min(1), serviceName: z.string().min(1),
  bookingVersion: z.number().int().positive(), tasks: z.array(taskSchema).min(1),
  receipt: receiptSchema.nullable(),
}).strict();
const summarySchema = z.object({
  taskStates: z.array(z.object({ taskId: z.string().min(1), state: z.enum(["COMPLETE", "BLOCKED"]) }).strict()).min(1),
  note: z.string().max(500).nullable(), submittedAt: z.string().datetime(),
  customerResponse: z.enum(["ACKNOWLEDGE", "RAISE_ISSUE"]).nullable(),
  customerNote: z.string().max(500).nullable(), respondedAt: z.string().datetime().nullable(),
}).strict();
const verificationSchema = z.object({
  state: z.enum(["VERIFIED", "DISPUTED", "REVIEW_REQUIRED", "CANNOT_VERIFY"]),
  reviewerRequired: z.boolean(), criteriaVersion: z.literal("taskconfirm-verification-v1"),
  bookingVersion: z.number().int().positive(), updatedAt: z.string().datetime(),
}).strict();

export const completionViewSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("INVALID") }).strict(),
  z.object({ kind: z.literal("NOT_READY"), agreement: agreementSchema }).strict(),
  z.object({ kind: z.literal("READY"), agreement: agreementSchema, summary: z.null(), verification: z.null() }).strict(),
  z.object({ kind: z.enum(["SUBMITTED", "RECORDED"]), agreement: agreementSchema, summary: summarySchema, verification: verificationSchema }).strict(),
]);
export type CompletionView = z.infer<typeof completionViewSchema>;
export function projectCompletionView(value: unknown): CompletionView { return completionViewSchema.parse(value); }

export interface CompletionWorkerAccess extends Record<string, Value> {
  readonly publicRunId: string;
  readonly browserTokenHash: string;
  readonly incidentKey: string;
}
export interface CompletionVerificationGateway {
  getForWorker(access: CompletionWorkerAccess): Promise<CompletionView | null>;
  submitWorkerSummary(access: CompletionWorkerAccess, input: z.input<typeof completionSummaryInputSchema>): Promise<CompletionView>;
  getForCustomer(tokenHash: string): Promise<CompletionView>;
  respondAsCustomer(tokenHash: string, response: z.input<typeof customerCompletionResponseSchema>): Promise<CompletionView>;
}

export type CompletionSubmissionConflictReason =
  | "STALE_BOOKING_VERSION"
  | "TASK_SET_MISMATCH"
  | "NOT_READY"
  | "ALREADY_RECORDED";

export class CompletionSubmissionConflictError extends Error {
  constructor(readonly reason: CompletionSubmissionConflictReason, message: string) {
    super(message);
    this.name = "CompletionSubmissionConflictError";
  }
}

function mapCompletionSubmissionError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("stale booking version")) throw new CompletionSubmissionConflictError("STALE_BOOKING_VERSION", message);
  if (message.includes("task list must exactly match")) throw new CompletionSubmissionConflictError("TASK_SET_MISMATCH", message);
  if (message.includes("not ready for completion")) throw new CompletionSubmissionConflictError("NOT_READY", message);
  if (message.includes("conflicts with the stored summary")) throw new CompletionSubmissionConflictError("ALREADY_RECORDED", message);
  throw error;
}

const getRef = makeFunctionReference<"mutation", CompletionWorkerAccess, unknown>("completion:get");
const submitRef = makeFunctionReference<"mutation", CompletionWorkerAccess & { input: unknown }, unknown>("completion:submitWorkerSummary");
const customerRef = makeFunctionReference<"mutation", { tokenHash: string }, unknown>("completion:getForCustomer");
const respondRef = makeFunctionReference<"mutation", { tokenHash: string; input: unknown }, unknown>("completion:respondAsCustomer");

export function createConvexCompletionVerificationGateway(url: string): CompletionVerificationGateway {
  const client = new ConvexHttpClient(url);
  return {
    async getForWorker(access) { const value = await client.mutation(getRef, access); return value === null ? null : projectCompletionView(value); },
    async submitWorkerSummary(access, input) {
      try { return projectCompletionView(await client.mutation(submitRef, { ...access, input: completionSummaryInputSchema.parse(input) })); }
      catch (error) { return mapCompletionSubmissionError(error); }
    },
    async getForCustomer(tokenHash) { return projectCompletionView(await client.mutation(customerRef, { tokenHash: tokenHashSchema.parse(tokenHash) })); },
    async respondAsCustomer(tokenHash, response) { return projectCompletionView(await client.mutation(respondRef, { tokenHash: tokenHashSchema.parse(tokenHash), input: customerCompletionResponseSchema.parse(response) })); },
  };
}

const tokenHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const auditEventSchema = z.object({
  stage: z.enum(["completion_submitted", "verification_completed"]),
  actor: z.enum(["WORKER", "CUSTOMER"]),
  state: z.enum(["VERIFIED", "DISPUTED", "REVIEW_REQUIRED", "CANNOT_VERIFY"]),
  criteriaVersion: z.literal("taskconfirm-verification-v1"),
  bookingVersion: z.number().int().positive(),
  evidence: z.object({ agreedTaskIds: z.array(z.string()), workerTaskStates: z.array(z.object({ taskId: z.string(), state: z.enum(["COMPLETE", "BLOCKED"]) }).strict()), receiptRequired: z.boolean(), receiptMatches: z.boolean(), customerResponse: z.enum(["ACKNOWLEDGE", "RAISE_ISSUE"]).optional() }).strict(),
  actionExecutionId: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
}).strict();
const reviewRecordSchema = z.object({ type: z.enum(["COMPLETION_BLOCKER", "COMPLETION_DISPUTE"]), status: z.literal("OPEN"), reasonCode: z.string().min(1), taskIds: z.array(z.string()), note: z.string(), createdAt: z.string().datetime() }).strict();
const storedSummarySchema = z.object({
  publicRunId: z.string().min(1), incidentKey: z.string().min(1), tokenHash: tokenHashSchema,
  agreement: agreementSchema, summary: summarySchema, verification: verificationSchema,
  receiptRequired: z.boolean(), receiptMatches: z.boolean(),
  actionExecutionId: z.string().min(1).nullable(),
  events: z.array(auditEventSchema),
  humanReviews: z.array(reviewRecordSchema),
}).strict();
const completionStoreSchema = z.object({ summaries: z.array(storedSummarySchema) }).strict();
type CompletionStore = z.infer<typeof completionStoreSchema>;
const runStoreSchema = z.object({ runs: z.array(z.object({ publicRunId: z.string(), browserTokenHash: z.string(), status: z.enum(["ACTIVE", "ABANDONED"]), resumeExpiresAt: z.string().datetime() }).passthrough()) }).passthrough();
const incidentStoreSchema = z.object({ incidents: z.array(z.object({ publicRunId: z.string(), incidentKey: z.string(), status: z.string(), policyDecision: z.object({ booking: z.object({ bookingKey: z.string(), serviceName: z.string(), bookingVersion: z.number(), includedTasks: z.array(taskSchema) }).passthrough() }).passthrough().nullable().optional() }).passthrough()) }).strict();
const confirmationStoreSchema = z.object({
  requests: z.array(z.object({
    publicRunId: z.string(),
    incidentKey: z.string(),
    tokenHash: tokenHashSchema,
    completionTokenHash: tokenHashSchema,
    commercialResponse: z.enum(["APPROVE", "DECLINE"]).nullable(),
    snapshot: z.object({ resultingTasks: z.array(taskSchema) }).passthrough(),
  }).passthrough()),
  executions: z.array(z.object({ tokenHash: tokenHashSchema, status: z.string(), receipt: z.object({ actionExecutionId: z.string().min(1).optional(), connector: z.string(), externalActionId: z.string(), resultingBookingVersion: z.number(), executedAt: z.string() }).passthrough().nullable() }).passthrough()).optional().default([]),
}).passthrough();
const fixtureLocks = new Map<string, Promise<CompletionView>>();

export function parseCompletionFixtureStore(value: unknown): CompletionStore {
  const container = z.object({ summaries: z.array(z.unknown()) }).strict().parse(value);
  const summaries: CompletionStore["summaries"] = [];
  for (const candidate of container.summaries) {
    const parsed = storedSummarySchema.safeParse(candidate);
    if (parsed.success) {
      summaries.push(parsed.data);
      continue;
    }
    const legacy = z.object({
      actionExecutionId: z.unknown().optional(),
      events: z.unknown().optional(),
      humanReviews: z.unknown().optional(),
    }).passthrough().safeParse(candidate);
    if (
      legacy.success &&
      legacy.data.actionExecutionId === undefined &&
      legacy.data.events === undefined &&
      legacy.data.humanReviews === undefined
    ) {
      // Pre-audit records cannot be trusted as verification evidence. Ignore them
      // so the worker must submit again against the current final agreement.
      continue;
    }
    throw parsed.error;
  }
  return completionStoreSchema.parse({ summaries });
}

export function createFixtureCompletionVerificationGateway(storePath: string): CompletionVerificationGateway {
  const base = resolve(storePath), completionPath = resolve(`${storePath}.completions`), incidentPath = resolve(`${storePath}.incidents`), confirmationPath = resolve(`${storePath}.confirmations`);
  async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, "utf8")); }
  async function readStore(): Promise<CompletionStore> { try { return parseCompletionFixtureStore(await readJson(completionPath)); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { summaries: [] }; throw error; } }
  async function atomicWrite(path: string, value: unknown) { await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`; await writeFile(temporary, JSON.stringify(value), { encoding: "utf8", mode: 0o600 }); await rename(temporary, path); }
  async function active(access: CompletionWorkerAccess) { const runs = runStoreSchema.parse(await readJson(base)); return runs.runs.some((run) => run.publicRunId === access.publicRunId && run.browserTokenHash === access.browserTokenHash && run.status === "ACTIVE" && Date.parse(run.resumeExpiresAt) > Date.now()); }
  async function relation(publicRunId: string, incidentKey: string) {
    const incidents = incidentStoreSchema.parse(await readJson(incidentPath));
    const confirmations = confirmationStoreSchema.parse(await readJson(confirmationPath));
    const incident = incidents.incidents.find((item) => item.publicRunId === publicRunId && item.incidentKey === incidentKey);
    const request = confirmations.requests.find((item) => item.publicRunId === publicRunId && item.incidentKey === incidentKey);
    const booking = incident?.policyDecision?.booking;
    if (!incident || !request || !booking) return null;
    const execution = confirmations.executions.find((item) => item.tokenHash === request.tokenHash);
    const receiptRequired = request.commercialResponse === "APPROVE";
    const finalTaskIds = booking.includedTasks.map((task) => task.taskId);
    const approvedTaskIds = request.snapshot.resultingTasks.map((task) => task.taskId);
    const receiptMatches = !receiptRequired || Boolean(
      execution?.status === "SUCCEEDED"
        && execution.receipt?.resultingBookingVersion === booking.bookingVersion
        && JSON.stringify(finalTaskIds) === JSON.stringify(approvedTaskIds),
    );
    const receipt = receiptRequired && execution?.receipt ? receiptSchema.parse({
      connector: execution.receipt.connector,
      externalActionId: execution.receipt.externalActionId,
      resultingBookingVersion: execution.receipt.resultingBookingVersion,
      executedAt: execution.receipt.executedAt,
    }) : null;
    return { incidents, incident, request, agreement: agreementSchema.parse({ bookingKey: booking.bookingKey, serviceName: booking.serviceName, bookingVersion: booking.bookingVersion, tasks: booking.includedTasks, receipt }), receiptRequired, receiptMatches, actionExecutionId: execution?.receipt?.actionExecutionId ?? execution?.receipt?.externalActionId ?? null };
  }
  function view(stored: CompletionStore["summaries"][number]): CompletionView { return projectCompletionView({ kind: stored.summary.customerResponse ? "RECORDED" : "SUBMITTED", agreement: stored.agreement, summary: stored.summary, verification: stored.verification }); }
  async function locked(key: string, work: () => Promise<CompletionView>) { const existing = fixtureLocks.get(key); if (existing) return existing; const pending = work(); fixtureLocks.set(key, pending); try { return await pending; } finally { if (fixtureLocks.get(key) === pending) fixtureLocks.delete(key); } }
  return {
    async getForWorker(access) { if (!(await active(access))) return null; const store = await readStore(); const stored = store.summaries.find((item) => item.publicRunId === access.publicRunId && item.incidentKey === access.incidentKey); if (stored) return view(stored); const rel = await relation(access.publicRunId, access.incidentKey); return rel ? projectCompletionView({ kind: "READY", agreement: rel.agreement, summary: null, verification: null }) : null; },
    async submitWorkerSummary(access, rawInput) { return locked(`${completionPath}:worker:${access.publicRunId}:${access.incidentKey}`, async () => {
      if (!(await active(access))) throw new Error("Incident is unavailable.");
      const input = completionSummaryInputSchema.parse(rawInput), store = await readStore();
      const existing = store.summaries.find((item) => item.publicRunId === access.publicRunId && item.incidentKey === access.incidentKey);
      if (existing) { const same = JSON.stringify({ bookingVersion: existing.agreement.bookingVersion, taskStates: existing.summary.taskStates, note: existing.summary.note ?? undefined }) === JSON.stringify(input); if (!same) throw new CompletionSubmissionConflictError("ALREADY_RECORDED", "Completion summary conflicts with the stored summary."); return view(existing); }
      const rel = await relation(access.publicRunId, access.incidentKey); if (!rel) throw new Error("Final agreement is unavailable.");
      const validation = validateWorkerCompletion({ finalBookingVersion: rel.agreement.bookingVersion, submittedBookingVersion: input.bookingVersion, agreedTaskIds: rel.agreement.tasks.map((task) => task.taskId), workerTaskStates: input.taskStates });
      if (!validation.valid) throw new CompletionSubmissionConflictError(validation.reason, validation.reason === "STALE_BOOKING_VERSION" ? "Completion uses a stale booking version." : "Completion task list must exactly match the final agreement.");
      if (rel.incident.status !== "COMPLETION_PENDING") throw new CompletionSubmissionConflictError("NOT_READY", "Incident is not ready for completion.");
      const now = new Date().toISOString(), blocker = input.taskStates.some((task) => task.state === "BLOCKED");
      const initialState = blocker ? "REVIEW_REQUIRED" as const : "CANNOT_VERIFY" as const;
      const evidence = { agreedTaskIds: rel.agreement.tasks.map((task) => task.taskId), workerTaskStates: input.taskStates, receiptRequired: rel.receiptRequired, receiptMatches: rel.receiptMatches };
      const stored = storedSummarySchema.parse({ publicRunId: access.publicRunId, incidentKey: access.incidentKey, tokenHash: rel.request.completionTokenHash, agreement: rel.agreement, summary: { taskStates: input.taskStates, note: input.note ?? null, submittedAt: now, customerResponse: null, customerNote: null, respondedAt: null }, verification: { state: initialState, reviewerRequired: blocker || !rel.receiptMatches, criteriaVersion: "taskconfirm-verification-v1", bookingVersion: rel.agreement.bookingVersion, updatedAt: now }, receiptRequired: rel.receiptRequired, receiptMatches: rel.receiptMatches, actionExecutionId: rel.actionExecutionId, events: [{ stage: "completion_submitted", actor: "WORKER", state: initialState, criteriaVersion: "taskconfirm-verification-v1", bookingVersion: rel.agreement.bookingVersion, evidence, actionExecutionId: rel.actionExecutionId, createdAt: now }], humanReviews: blocker ? [{ type: "COMPLETION_BLOCKER", status: "OPEN", reasonCode: "WORKER_REPORTED_BLOCKER", taskIds: input.taskStates.filter((task) => task.state === "BLOCKED").map((task) => task.taskId), note: input.note ?? "Worker reported a blocker.", createdAt: now }] : [] });
      store.summaries.push(stored); const submitted = transitionIncident("COMPLETION_PENDING", { type: "SUBMIT_COMPLETION" }, {}); rel.incident.status = blocker || !rel.receiptMatches ? transitionIncident(submitted.nextStatus, { type: "REQUIRE_COMPLETION_REVIEW" }, {}).nextStatus : submitted.nextStatus;
      await Promise.all([atomicWrite(completionPath, store), atomicWrite(incidentPath, rel.incidents)]); return view(stored);
    }); },
    async getForCustomer(rawHash) { const tokenHash = tokenHashSchema.parse(rawHash), store = await readStore(); const stored = store.summaries.find((item) => item.tokenHash === tokenHash); if (stored) return view(stored); const confirmations = confirmationStoreSchema.parse(await readJson(confirmationPath)); const request = confirmations.requests.find((item) => item.tokenHash === tokenHash); if (!request) return { kind: "INVALID" }; const rel = await relation(request.publicRunId, request.incidentKey); return rel ? projectCompletionView({ kind: "NOT_READY", agreement: rel.agreement }) : { kind: "INVALID" }; },
    async respondAsCustomer(rawHash, rawResponse) { const tokenHash = tokenHashSchema.parse(rawHash), input = customerCompletionResponseSchema.parse(rawResponse); return locked(`${completionPath}:customer:${tokenHash}`, async () => {
      const store = await readStore(), stored = store.summaries.find((item) => item.tokenHash === tokenHash); if (!stored) throw new Error("Worker completion summary is not available yet.");
      if (stored.summary.customerResponse) { resolveCustomerCompletionResponse(stored.summary.customerResponse, input.response); if ((stored.summary.customerNote ?? undefined) !== input.note) throw new Error("Customer completion response conflicts with the stored response."); return view(stored); }
      const rel = await relation(stored.publicRunId, stored.incidentKey); if (!rel || rel.agreement.bookingVersion !== stored.agreement.bookingVersion || JSON.stringify(rel.agreement.tasks.map((task) => task.taskId)) !== JSON.stringify(stored.agreement.tasks.map((task) => task.taskId))) throw new Error("Completion agreement is stale.");
      if (rel.incident.status !== "AWAITING_COMPLETION_RESPONSE") throw new Error("Completion is not awaiting a customer response.");
      const result = computeVerification({ agreedTaskIds: stored.agreement.tasks.map((task) => task.taskId), workerTaskStates: stored.summary.taskStates, receiptRequired: stored.receiptRequired, requiredReceiptMatches: stored.receiptMatches, customerResponse: input.response, unresolvedReview: false }); const now = new Date().toISOString();
      stored.summary.customerResponse = input.response; stored.summary.customerNote = input.note ?? null; stored.summary.respondedAt = now; stored.verification = { ...stored.verification, ...result, updatedAt: now }; rel.incident.status = transitionIncident("AWAITING_COMPLETION_RESPONSE", { type: input.response === "ACKNOWLEDGE" ? "CUSTOMER_ACKNOWLEDGES" : "CUSTOMER_RAISES_ISSUE" }, {}).nextStatus;
      stored.events.push({ stage: "verification_completed", actor: "CUSTOMER", state: result.state, criteriaVersion: "taskconfirm-verification-v1", bookingVersion: stored.agreement.bookingVersion, evidence: { agreedTaskIds: stored.agreement.tasks.map((task) => task.taskId), workerTaskStates: stored.summary.taskStates, receiptRequired: stored.receiptRequired, receiptMatches: stored.receiptMatches, customerResponse: input.response }, actionExecutionId: stored.actionExecutionId, createdAt: now });
      if (input.response === "RAISE_ISSUE") stored.humanReviews.push({ type: "COMPLETION_DISPUTE", status: "OPEN", reasonCode: "CUSTOMER_RAISED_COMPLETION_ISSUE", taskIds: stored.agreement.tasks.map((task) => task.taskId), note: input.note ?? "Customer raised a completion issue.", createdAt: now });
      await Promise.all([atomicWrite(completionPath, store), atomicWrite(incidentPath, rel.incidents)]); return view(stored);
    }); },
  };
}

export function getCompletionVerificationGateway(): CompletionVerificationGateway {
  if (env.features.fixtureMode) return createFixtureCompletionVerificationGateway(env.fixtureStorePath ?? ".demo-fixture/runs.json");
  if (!env.public?.convexUrl) throw new Error("Completion verification requires NEXT_PUBLIC_CONVEX_URL.");
  return createConvexCompletionVerificationGateway(env.public.convexUrl);
}
