import { ConvexError } from "convex/values";
import type { DataModelFromSchemaDefinition, DocumentByName, GenericMutationCtx } from "convex/server";

import { actionExecutionRequestSchema, actionReceiptSchema, buildActionExecutionRequest } from "../src/domain/action-execution";
import { transitionIncident } from "../src/domain/incident-state";
import { DEMO_TENANT_ID } from "./fixtures";
import { appendIncidentTrace } from "./incidentSupport";
import type schema from "./schema";

type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type Context = GenericMutationCtx<DataModel>;
type Doc<Name extends keyof DataModel> = DocumentByName<DataModel, Name>;

async function confirmationByHash(context: Context, tokenHash: string) {
  return context.db.query("confirmationRequests").withIndex("by_tenant_token_hash", (q) =>
    q.eq("tenantId", DEMO_TENANT_ID).eq("tokenHash", tokenHash),
  ).unique();
}

async function executionByKey(context: Context, tenantId: string, key: string) {
  return context.db.query("actionExecutions").withIndex("by_tenant_idempotency", (q) =>
    q.eq("tenantId", tenantId).eq("idempotencyKey", key),
  ).unique();
}

async function relations(context: Context, request: Doc<"confirmationRequests">) {
  const [incident, decision] = await Promise.all([
    context.db.get(request.incidentId), context.db.get(request.decisionId),
  ]);
  if (!incident || !decision || incident.tenantId !== request.tenantId || decision.tenantId !== request.tenantId || decision.incidentId !== incident._id) return null;
  const [booking, sources] = await Promise.all([
    context.db.query("bookings").withIndex("by_tenant_booking_key", (q) => q.eq("tenantId", request.tenantId).eq("bookingKey", incident.bookingKey)).unique(),
    context.db.query("policySources").withIndex("by_tenant_source_version", (q) => q.eq("tenantId", request.tenantId).eq("sourceKey", decision.sourceKey ?? "")).collect(),
  ]);
  const active = sources.filter((source) => source.status === "ACTIVE");
  return { incident, decision, booking, source: active.length === 1 ? active[0] : null };
}

function publicReceipt(receipt: NonNullable<Doc<"actionExecutions">["receipt"]>) {
  return {
    connector: receipt.connector,
    externalActionId: receipt.externalActionId,
    previousBookingVersion: receipt.previousBookingVersion,
    resultingBookingVersion: receipt.resultingBookingVersion,
    status: receipt.status,
    executedAt: receipt.executedAt,
  };
}

function publicProjection(execution: Doc<"actionExecutions">) {
  return {
    status: execution.status,
    attemptCount: execution.attemptCount,
    receipt: execution.receipt ? publicReceipt(execution.receipt) : null,
    error: execution.errorCode ? { code: execution.errorCode, message: execution.errorMessage ?? "Action could not be completed." } : null,
  };
}

export async function reserveHandler(context: Context, args: { tokenHash: string }) {
  const confirmation = await confirmationByHash(context, args.tokenHash);
  if (!confirmation) throw new ConvexError("Confirmation request is invalid.");
  const current = await relations(context, confirmation);
  const action = {
    type: "ADD_TASK" as const,
    taskId: confirmation.requestSnapshot.taskId,
    priceDeltaMinor: confirmation.requestSnapshot.priceDeltaMinor,
    durationDeltaMinutes: confirmation.requestSnapshot.durationDeltaMinutes,
  };
  const incidentExecutions = await context.db.query("actionExecutions")
    .withIndex("by_tenant_incident", (q) => q.eq("tenantId", confirmation.tenantId).eq("incidentId", confirmation.incidentId))
    .collect();
  const relatedExecution = incidentExecutions.find((candidate) => candidate.confirmationRequestId === confirmation._id);
  if (relatedExecution?.status === "RECONCILIATION_REQUIRED") {
    return { kind: "STORED" as const, execution: publicProjection(relatedExecution) };
  }
  const connectorReceipt = relatedExecution
    ? await context.db.query("mockConnectorReceipts")
      .withIndex("by_tenant_idempotency", (q) => q.eq("tenantId", confirmation.tenantId).eq("idempotencyKey", relatedExecution.idempotencyKey))
      .unique()
    : null;
  const authorityChanged = !current?.booking || !current.source ||
    confirmation.bookingVersion !== current.booking.version ||
    confirmation.decisionHash !== current.decision.decisionHash ||
    confirmation.sourceVersion !== current.source.version;
  if (relatedExecution && connectorReceipt && authorityChanged && current) {
    const now = new Date().toISOString();
    const reconciled = transitionIncident(current.incident.status, { type: "ACTION_REQUIRES_RECONCILIATION" }, {});
    await context.db.patch(relatedExecution._id, {
      status: "RECONCILIATION_REQUIRED",
      errorCode: "RECONCILIATION_REQUIRED",
      errorMessage: "The connector succeeded, but current booking authority changed before local finalization.",
      updatedAt: now,
    });
    await context.db.patch(current.incident._id, { status: reconciled.nextStatus, updatedAt: now });
    return { kind: "STORED" as const, execution: publicProjection({
      ...relatedExecution,
      status: "RECONCILIATION_REQUIRED",
      errorCode: "RECONCILIATION_REQUIRED",
      errorMessage: "The connector succeeded, but current booking authority changed before local finalization.",
    }) };
  }
  if (!current?.booking || !current.source) throw new ConvexError("Action authority is stale.");
  const retry = incidentExecutions.find((candidate) => candidate.confirmationRequestId === confirmation._id && (candidate.status === "RETRYABLE_FAILED" || candidate.status === "PENDING"));
  if (retry) {
    if (
      !["ACTION_AUTHORISED", "ACTION_EXECUTING"].includes(current.incident.status) ||
      !confirmation.requestConfirmedByCustomer ||
      confirmation.commercialResponse !== "APPROVE" ||
      confirmation.bookingVersion !== current.booking.version ||
      confirmation.decisionHash !== current.decision.decisionHash ||
      confirmation.sourceVersion !== current.source.version ||
      current.decision.supportState !== "SUPPORTED" ||
      current.decision.decisionState !== "ADD_ON_APPROVAL_REQUIRED"
    ) throw new ConvexError("Action authority changed before retry.");
    const now = new Date().toISOString();
    const nextStatus = current.incident.status === "ACTION_AUTHORISED"
      ? transitionIncident(current.incident.status, { type: "START_ACTION" }, {}).nextStatus
      : current.incident.status;
    await context.db.patch(retry._id, { status: "PENDING", attemptCount: retry.attemptCount + 1, errorCode: undefined, errorMessage: undefined, updatedAt: now });
    await context.db.patch(current.incident._id, { status: nextStatus, updatedAt: now });
    return { kind: "EXECUTE" as const, request: actionExecutionRequestSchema.parse({
      tenantId: confirmation.tenantId,
      incidentKey: current.incident.incidentKey,
      decisionHash: confirmation.decisionHash,
      bookingKey: current.booking.bookingKey,
      bookingVersion: current.booking.version,
      sourceVersion: confirmation.sourceVersion,
      action,
      requestHash: retry.payloadHash,
      idempotencyKey: retry.idempotencyKey,
    }) };
  }
  const executionRequest = buildActionExecutionRequest({
    tenantId: confirmation.tenantId,
    incidentKey: current.incident.incidentKey,
    incidentStatus: current.incident.status,
    bookingKey: current.booking.bookingKey,
    storedBookingVersion: confirmation.bookingVersion,
    currentBookingVersion: current.booking.version,
    storedDecisionHash: confirmation.decisionHash,
    currentDecisionHash: current.decision.decisionHash,
    storedSourceVersion: confirmation.sourceVersion,
    currentSourceVersion: current.source.version,
    requestConfirmedByCustomer: confirmation.requestConfirmedByCustomer,
    commercialResponse: confirmation.commercialResponse ?? null,
    decisionState: current.decision.decisionState ?? "NOT_SUPPORTED",
    supportState: current.decision.supportState,
    action,
  });
  const existing = await executionByKey(context, confirmation.tenantId, executionRequest.idempotencyKey);
  if (existing) {
    if (existing.payloadHash !== executionRequest.requestHash) throw new ConvexError("Idempotency key payload mismatch.");
    if (existing.status === "RETRYABLE_FAILED") {
      const now = new Date().toISOString();
      await context.db.patch(existing._id, { status: "PENDING", attemptCount: existing.attemptCount + 1, errorCode: undefined, errorMessage: undefined, updatedAt: now });
      return { kind: "EXECUTE" as const, request: executionRequest };
    }
    return { kind: "STORED" as const, execution: publicProjection(existing) };
  }
  const now = new Date().toISOString();
  const started = transitionIncident(current.incident.status, { type: "START_ACTION" }, {});
  await context.db.insert("actionExecutions", {
    tenantId: confirmation.tenantId, incidentId: current.incident._id, decisionId: current.decision._id,
    confirmationRequestId: confirmation._id, connector: "DEMONSTRATION_CONNECTOR", actionType: "ADD_TASK",
    payload: { bookingKey: current.booking.bookingKey, taskId: action.taskId, priceDeltaMinor: action.priceDeltaMinor, durationDeltaMinutes: action.durationDeltaMinutes },
    payloadHash: executionRequest.requestHash, idempotencyKey: executionRequest.idempotencyKey, status: "PENDING",
    attemptCount: 1, priorBookingVersion: current.booking.version, startedAt: now, updatedAt: now,
  });
  await context.db.patch(current.incident._id, { status: started.nextStatus, updatedAt: now });
  return { kind: "EXECUTE" as const, request: actionExecutionRequestSchema.parse(executionRequest) };
}

export async function finalizeHandler(context: Context, args: { tokenHash: string; receipt: unknown }) {
  const confirmation = await confirmationByHash(context, args.tokenHash);
  if (!confirmation) throw new ConvexError("Confirmation request is invalid.");
  const receipt = actionReceiptSchema.parse(args.receipt);
  const execution = await executionByKey(context, confirmation.tenantId, receipt.idempotencyKey);
  if (!execution || execution.payloadHash !== receipt.requestHash) throw new ConvexError("Action reservation does not match receipt.");
  if (execution.status === "SUCCEEDED") return publicProjection(execution);
  if (execution.status !== "PENDING") throw new ConvexError("Action reservation is not pending.");
  const current = await relations(context, confirmation);
  if (!current?.booking || !current.source || current.booking.version !== execution.priorBookingVersion || current.decision.decisionHash !== confirmation.decisionHash || current.source.version !== confirmation.sourceVersion || current.incident.status !== "ACTION_EXECUTING") throw new ConvexError("Action authority changed before finalization.");
  if (receipt.previousBookingVersion !== current.booking.version || receipt.resultingBookingVersion !== current.booking.version + 1) throw new ConvexError("Connector receipt has invalid booking versions.");
  const taskId = execution.payload.taskId;
  const included = current.booking.includedTaskIds.includes(taskId) ? current.booking.includedTaskIds : [...current.booking.includedTaskIds, taskId];
  const addOns = current.booking.existingAddOnTaskIds.includes(taskId) ? current.booking.existingAddOnTaskIds : [...current.booking.existingAddOnTaskIds, taskId];
  const now = new Date().toISOString();
  await context.db.patch(current.booking._id, { includedTaskIds: included, existingAddOnTaskIds: addOns, scheduledDurationMinutes: current.booking.scheduledDurationMinutes + execution.payload.durationDeltaMinutes, version: receipt.resultingBookingVersion });
  await context.db.patch(execution._id, { status: "SUCCEEDED", externalActionId: receipt.externalActionId, resultingBookingVersion: receipt.resultingBookingVersion, receipt, completedAt: now, updatedAt: now });
  const executed = transitionIncident(current.incident.status, { type: "ACTION_SUCCEEDS" }, {});
  const completed = transitionIncident(executed.nextStatus, { type: "MARK_COMPLETION_PENDING" }, {});
  await context.db.patch(current.incident._id, { status: completed.nextStatus, bookingVersion: receipt.resultingBookingVersion, updatedAt: now });
  await appendIncidentTrace(context, { incident: current.incident, runId: current.incident.demoRunId, stage: "booking_action_executed", actor: "SYSTEM", inputSummary: "Authorised booking change sent to the demonstration connector.", outputSummary: `Booking updated with receipt ${receipt.externalActionId}.`, sourceIds: [`${confirmation.requestSnapshot.sourceKey}:${confirmation.sourceVersion}`], nowIso: now });
  return { status: "SUCCEEDED" as const, attemptCount: execution.attemptCount, receipt: publicReceipt(receipt), error: null };
}

export async function failHandler(context: Context, args: { tokenHash: string; code: string; message: string; retryable: boolean }) {
  const confirmation = await confirmationByHash(context, args.tokenHash);
  if (!confirmation) throw new ConvexError("Confirmation request is invalid.");
  const executions = await context.db.query("actionExecutions").withIndex("by_tenant_incident", (q) => q.eq("tenantId", confirmation.tenantId).eq("incidentId", confirmation.incidentId)).collect();
  const execution = executions.find((candidate) => candidate.confirmationRequestId === confirmation._id);
  if (!execution) throw new ConvexError("Action reservation is missing.");
  if (execution.status === "SUCCEEDED") return publicProjection(execution);
  const now = new Date().toISOString();
  const status = args.retryable ? "RETRYABLE_FAILED" as const : "PERMANENT_FAILED" as const;
  await context.db.patch(execution._id, { status, errorCode: args.code, errorMessage: args.message.slice(0, 160), completedAt: now, updatedAt: now });
  const current = await relations(context, confirmation);
  if (!current) throw new ConvexError("Action authority is stale.");
  const transition = transitionIncident(current.incident.status, { type: args.retryable ? "ACTION_FAILS" : "ACTION_ABORTS" }, {});
  await context.db.patch(confirmation.incidentId, { status: transition.nextStatus, updatedAt: now });
  return { status, attemptCount: execution.attemptCount, receipt: null, error: { code: args.code, message: args.message.slice(0, 160) } };
}

export async function executeMockConnectorHandler(context: Context, args: { request: unknown }) {
  const request = actionExecutionRequestSchema.parse(args.request);
  if (request.tenantId !== DEMO_TENANT_ID) throw new ConvexError("Connector tenant is invalid.");
  const existing = await context.db.query("mockConnectorReceipts")
    .withIndex("by_tenant_idempotency", (q) => q.eq("tenantId", request.tenantId).eq("idempotencyKey", request.idempotencyKey))
    .unique();
  if (existing) {
    if (existing.requestHash !== request.requestHash) throw new ConvexError("Connector idempotency payload mismatch.");
    return existing.receipt;
  }
  const suffix = request.idempotencyKey.slice(0, 16).toUpperCase();
  const now = new Date().toISOString();
  const receipt = actionReceiptSchema.parse({
    actionExecutionId: `EXEC-DEMO-${suffix}`,
    connector: "DEMONSTRATION_CONNECTOR",
    idempotencyKey: request.idempotencyKey,
    externalActionId: `ACT-DEMO-${suffix}`,
    requestHash: request.requestHash,
    previousBookingVersion: request.bookingVersion,
    resultingBookingVersion: request.bookingVersion + 1,
    actionType: request.action.type,
    status: "SUCCEEDED",
    executedAt: now,
  });
  await context.db.insert("mockConnectorReceipts", {
    tenantId: request.tenantId,
    idempotencyKey: request.idempotencyKey,
    requestHash: request.requestHash,
    receipt,
    createdAt: now,
  });
  return receipt;
}
