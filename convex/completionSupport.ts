import { ConvexError } from "convex/values";
import type { DataModelFromSchemaDefinition, DocumentByName, GenericMutationCtx } from "convex/server";

import { completionSummaryInputSchema, computeVerification, customerCompletionResponseSchema, resolveCustomerCompletionResponse, validateWorkerCompletion } from "../src/domain/completion-verification";
import { transitionIncident } from "../src/domain/incident-state";
import { appendIncidentTrace, findIncidentAccess, requireIncidentAccess } from "./incidentSupport";
import type schema from "./schema";

const CRITERIA_VERSION = "taskconfirm-verification-v1" as const;
type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type Context = GenericMutationCtx<DataModel>;
type Doc<Name extends keyof DataModel> = DocumentByName<DataModel, Name>;
type WorkerArgs = { publicRunId: string; browserTokenHash: string; incidentKey: string };

async function summaryForIncident(context: Context, tenantId: string, incidentId: Doc<"incidents">["_id"]) {
  return context.db.query("completionSummaries").withIndex("by_tenant_incident", (q) => q.eq("tenantId", tenantId).eq("incidentId", incidentId)).unique();
}

async function confirmationByToken(context: Context, tokenHash: string) {
  return context.db.query("confirmationRequests").withIndex("by_completion_token_hash", (q) => q.eq("completionTokenHash", tokenHash)).unique();
}

async function relations(context: Context, incident: Doc<"incidents">) {
  const booking = await context.db.query("bookings").withIndex("by_tenant_booking_key", (q) => q.eq("tenantId", incident.tenantId).eq("bookingKey", incident.bookingKey)).unique();
  if (!booking) return null;
  const [confirmation, catalog] = await Promise.all([
    context.db.query("confirmationRequests").withIndex("by_tenant_incident", (q) => q.eq("tenantId", incident.tenantId).eq("incidentId", incident._id)).unique(),
    context.db.query("taskCatalog").withIndex("by_tenant_catalog", (q) => q.eq("tenantId", incident.tenantId).eq("catalogVersion", booking.catalogVersion)).collect(),
  ]);
  if (!confirmation || confirmation.tenantId !== incident.tenantId || confirmation.incidentId !== incident._id) return null;
  const executions = await context.db.query("actionExecutions").withIndex("by_tenant_incident", (q) => q.eq("tenantId", incident.tenantId).eq("incidentId", incident._id)).collect();
  const execution = executions.find((item) => item.confirmationRequestId === confirmation._id);
  const tasks = booking.includedTaskIds.map((taskId) => {
    const item = catalog.find((candidate) => candidate.tenantId === incident.tenantId && candidate.catalogVersion === booking.catalogVersion && candidate.taskId === taskId);
    if (!item) throw new ConvexError("Final agreement task catalogue is unavailable.");
    return { taskId, displayName: item.displayName };
  });
  const receiptRequired = confirmation.commercialResponse === "APPROVE";
  const finalTaskIds = tasks.map((task) => task.taskId);
  const approvedTaskIds = confirmation.requestSnapshot.resultingTasks.map((task) => task.taskId);
  const receiptMatches = !receiptRequired || Boolean(
    execution?.status === "SUCCEEDED"
      && execution.receipt
      && execution.resultingBookingVersion === booking.version
      && execution.receipt.resultingBookingVersion === booking.version
      && JSON.stringify(finalTaskIds) === JSON.stringify(approvedTaskIds),
  );
  return { booking, confirmation, execution, tasks, receiptRequired, receiptMatches };
}

function agreement(rel: NonNullable<Awaited<ReturnType<typeof relations>>>, frozenTasks = rel.tasks, frozenVersion = rel.booking.version) {
  return { bookingKey: rel.booking.bookingKey, serviceName: rel.booking.serviceName, bookingVersion: frozenVersion, tasks: frozenTasks, receipt: rel.receiptRequired && rel.execution?.receipt ? { connector: rel.execution.receipt.connector, externalActionId: rel.execution.receipt.externalActionId, resultingBookingVersion: rel.execution.receipt.resultingBookingVersion, executedAt: rel.execution.receipt.executedAt } : null };
}

function publicView(rel: NonNullable<Awaited<ReturnType<typeof relations>>>, summary: Doc<"completionSummaries"> | null) {
  if (!summary) return { kind: "READY" as const, agreement: agreement(rel), summary: null, verification: null };
  const verification = { state: summary.verificationState, reviewerRequired: summary.reviewerRequired, criteriaVersion: CRITERIA_VERSION, bookingVersion: summary.bookingVersion, updatedAt: summary.updatedAt };
  return { kind: summary.customerResponse ? "RECORDED" as const : "SUBMITTED" as const, agreement: agreement(rel, summary.agreedTasks, summary.bookingVersion), summary: { taskStates: summary.workerTaskStates, note: summary.workerNote ?? null, submittedAt: summary.submittedAt, customerResponse: summary.customerResponse ?? null, customerNote: summary.customerNote ?? null, respondedAt: summary.respondedAt ?? null }, verification };
}

function sameSummary(existing: Doc<"completionSummaries">, input: { bookingVersion: number; taskStates: readonly { taskId: string; state: "COMPLETE" | "BLOCKED" }[]; note?: string }) {
  return existing.bookingVersion === input.bookingVersion
    && existing.workerTaskStates.length === input.taskStates.length
    && existing.workerTaskStates.every((stored, index) => stored.taskId === input.taskStates[index]?.taskId && stored.state === input.taskStates[index]?.state)
    && (existing.workerNote ?? undefined) === input.note;
}

async function addEvent(context: Context, incident: Doc<"incidents">, summaryId: Doc<"completionSummaries">["_id"], rel: NonNullable<Awaited<ReturnType<typeof relations>>>, actor: "WORKER" | "CUSTOMER" | "SYSTEM", state: "CANNOT_VERIFY" | "VERIFIED" | "DISPUTED" | "REVIEW_REQUIRED", reviewerRequired: boolean, customerResponse?: "ACKNOWLEDGE" | "RAISE_ISSUE") {
  await context.db.insert("verificationEvents", { tenantId: incident.tenantId, incidentId: incident._id, completionSummaryId: summaryId, criteriaVersion: CRITERIA_VERSION, actor, bookingVersion: rel.booking.version, evidence: { agreedTaskIds: rel.tasks.map((task) => task.taskId), workerTaskStates: (await context.db.get(summaryId))!.workerTaskStates, receiptRequired: rel.receiptRequired, receiptMatches: rel.receiptMatches, ...(customerResponse ? { customerResponse } : {}) }, ...(rel.receiptRequired && rel.execution ? { actionExecutionId: rel.execution._id } : {}), state, reviewerRequired, createdAt: new Date().toISOString() });
}

export async function getHandler(context: Context, args: WorkerArgs) {
  const access = await findIncidentAccess(context, args);
  if (!access) return null;
  const rel = await relations(context, access.incident);
  if (!rel) return null;
  return publicView(rel, await summaryForIncident(context, access.incident.tenantId, access.incident._id));
}

export async function submitWorkerSummaryHandler(context: Context, args: WorkerArgs & { input: unknown }) {
  const access = await requireIncidentAccess(context, args);
  const input = completionSummaryInputSchema.parse(args.input);
  const rel = await relations(context, access.incident);
  if (!rel) throw new ConvexError("Final agreement is unavailable.");
  const validation = validateWorkerCompletion({ finalBookingVersion: rel.booking.version, submittedBookingVersion: input.bookingVersion, agreedTaskIds: rel.tasks.map((task) => task.taskId), workerTaskStates: input.taskStates });
  if (!validation.valid) throw new ConvexError(validation.reason === "STALE_BOOKING_VERSION" ? "Completion uses a stale booking version. Refresh the final agreement." : "Completion task list must exactly match the final agreement.");
  const existing = await summaryForIncident(context, access.incident.tenantId, access.incident._id);
  if (existing) {
    if (!sameSummary(existing, input)) throw new ConvexError("Completion summary conflicts with the stored summary.");
    return publicView(rel, existing);
  }
  if (access.incident.status !== "COMPLETION_PENDING") throw new ConvexError("Incident is not ready for completion.");
  const now = new Date().toISOString();
  const hasBlocker = input.taskStates.some((task) => task.state === "BLOCKED");
  const initial = { state: hasBlocker ? "REVIEW_REQUIRED" as const : "CANNOT_VERIFY" as const, reviewerRequired: hasBlocker || !rel.receiptMatches };
  const summaryId = await context.db.insert("completionSummaries", { tenantId: access.incident.tenantId, incidentId: access.incident._id, bookingVersion: rel.booking.version, agreedTasks: rel.tasks, workerTaskStates: input.taskStates, ...(input.note ? { workerNote: input.note } : {}), submittedBy: access.incident.workerPublicUserId, submittedAt: now, verificationState: initial.state, reviewerRequired: initial.reviewerRequired, updatedAt: now });
  const submitted = transitionIncident(access.incident.status, { type: "SUBMIT_COMPLETION" }, {});
  let nextStatus = submitted.nextStatus;
  if (hasBlocker || !rel.receiptMatches) nextStatus = transitionIncident(submitted.nextStatus, { type: "REQUIRE_COMPLETION_REVIEW" }, {}).nextStatus;
  await context.db.patch(access.incident._id, { status: nextStatus, updatedAt: now });
  if (hasBlocker) await context.db.insert("humanReviews", { tenantId: access.incident.tenantId, incidentId: access.incident._id, reviewType: "COMPLETION_BLOCKER", status: "OPEN", reasonCode: "WORKER_REPORTED_BLOCKER", contextSnapshot: { confirmedText: input.note ?? "Worker reported a blocker.", bookingVersion: rel.booking.version, taskIds: input.taskStates.filter((task) => task.state === "BLOCKED").map((task) => task.taskId) }, createdAt: now });
  await addEvent(context, access.incident, summaryId, rel, "WORKER", initial.state, initial.reviewerRequired);
  await appendIncidentTrace(context, { incident: access.incident, runId: access.run._id, stage: "completion_submitted", actor: "WORKER", inputSummary: "Worker submitted structured states for every final-agreement task.", outputSummary: `Completion verification is ${initial.state}.`, nowIso: now });
  return publicView(rel, await context.db.get(summaryId));
}

export async function getForCustomerHandler(context: Context, args: { tokenHash: string }) {
  const confirmation = await confirmationByToken(context, args.tokenHash);
  if (!confirmation) return { kind: "INVALID" as const };
  const incident = await context.db.get(confirmation.incidentId);
  if (!incident || incident.tenantId !== confirmation.tenantId) return { kind: "INVALID" as const };
  const rel = await relations(context, incident);
  if (!rel) return { kind: "INVALID" as const };
  const summary = await summaryForIncident(context, incident.tenantId, incident._id);
  return summary ? publicView(rel, summary) : { kind: "NOT_READY" as const, agreement: agreement(rel) };
}

export async function respondAsCustomerHandler(context: Context, args: { tokenHash: string; input: unknown }) {
  const input = customerCompletionResponseSchema.parse(args.input);
  const confirmation = await confirmationByToken(context, args.tokenHash);
  if (!confirmation) throw new ConvexError("Customer completion link is invalid.");
  const incident = await context.db.get(confirmation.incidentId);
  if (!incident || incident.tenantId !== confirmation.tenantId) throw new ConvexError("Customer completion link is invalid.");
  const rel = await relations(context, incident);
  const summary = await summaryForIncident(context, incident.tenantId, incident._id);
  if (!rel || !summary) throw new ConvexError("Worker completion summary is not available yet.");
  const currentTaskIds = rel.tasks.map((task) => task.taskId);
  if (rel.booking.version !== summary.bookingVersion || JSON.stringify(currentTaskIds) !== JSON.stringify(summary.agreedTasks.map((task) => task.taskId))) {
    throw new ConvexError("Completion agreement is stale. Refresh the final agreement.");
  }
  let response: "ACKNOWLEDGE" | "RAISE_ISSUE";
  try { response = resolveCustomerCompletionResponse(summary.customerResponse, input.response); } catch (error) { throw new ConvexError((error as Error).message); }
  if (summary.customerResponse) {
    if ((summary.customerNote ?? undefined) !== input.note) throw new ConvexError("Customer completion response conflicts with the stored response.");
    return publicView(rel, summary);
  }
  if (incident.status !== "AWAITING_COMPLETION_RESPONSE") throw new ConvexError("Completion is not awaiting a customer response.");
  const result = computeVerification({ agreedTaskIds: summary.agreedTasks.map((task) => task.taskId), workerTaskStates: summary.workerTaskStates, receiptRequired: rel.receiptRequired, requiredReceiptMatches: rel.receiptMatches, customerResponse: response, unresolvedReview: false });
  const now = new Date().toISOString();
  const nextStatus = transitionIncident(incident.status, { type: response === "ACKNOWLEDGE" ? "CUSTOMER_ACKNOWLEDGES" : "CUSTOMER_RAISES_ISSUE" }, {}).nextStatus;
  await context.db.patch(summary._id, { customerResponse: response, ...(input.note ? { customerNote: input.note } : {}), respondedAt: now, verificationState: result.state, reviewerRequired: result.reviewerRequired, updatedAt: now });
  await context.db.patch(incident._id, { status: nextStatus, updatedAt: now });
  if (response === "RAISE_ISSUE") await context.db.insert("humanReviews", { tenantId: incident.tenantId, incidentId: incident._id, reviewType: "COMPLETION_DISPUTE", status: "OPEN", reasonCode: "CUSTOMER_RAISED_COMPLETION_ISSUE", contextSnapshot: { confirmedText: input.note ?? "Customer raised a completion issue.", bookingVersion: summary.bookingVersion, taskIds: summary.agreedTasks.map((task) => task.taskId) }, createdAt: now });
  await addEvent(context, incident, summary._id, rel, "CUSTOMER", result.state, result.reviewerRequired, response);
  await appendIncidentTrace(context, { incident, runId: incident.demoRunId, stage: "verification_completed", actor: "CUSTOMER", inputSummary: "Customer submitted a bounded completion response.", outputSummary: `Verification state is ${result.state}.`, nowIso: now });
  return { ...publicView(rel, await context.db.get(summary._id)), kind: "RECORDED" as const };
}
