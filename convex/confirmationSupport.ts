import { ConvexError } from "convex/values";
import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  GenericMutationCtx,
} from "convex/server";

import {
  applyCustomerResponse,
  evaluateConfirmationAccess,
  type ConfirmationAccessResult,
  type CustomerResponse,
} from "../src/domain/customer-confirmation";
import {
  buildConfirmationSnapshot,
  validateConfirmationCreation,
} from "../src/domain/customer-confirmation-snapshot";
import { transitionIncident } from "../src/domain/incident-state";
import { DEMO_TENANT_ID } from "./fixtures";
import type schema from "./schema";
import {
  appendIncidentTrace,
  findIncidentAccess,
  requireIncidentAccess,
} from "./incidentSupport";

type WorkerArgs = {
  publicRunId: string;
  browserTokenHash: string;
  incidentKey: string;
};

type CreateArgs = WorkerArgs & {
  tokenHash: string;
  completionTokenHash: string;
  expiresAt: string;
};

type DataModel = DataModelFromSchemaDefinition<typeof schema>;
type MutationContext = GenericMutationCtx<DataModel>;
type Doc<TableName extends keyof DataModel> = DocumentByName<DataModel, TableName>;
type StoredConfirmation = Doc<"confirmationRequests">;

async function executionProjection(context: MutationContext, request: StoredConfirmation) {
  const executions = await context.db
    .query("actionExecutions")
    .withIndex("by_tenant_incident", (range) =>
      range.eq("tenantId", request.tenantId).eq("incidentId", request.incidentId),
    )
    .collect();
  const execution = executions.find((candidate) => candidate.confirmationRequestId === request._id);
  const receipt = execution?.receipt;
  return execution
    ? {
        status: execution.status,
        attemptCount: execution.attemptCount,
        receipt: receipt ? {
          connector: receipt.connector,
          externalActionId: receipt.externalActionId,
          previousBookingVersion: receipt.previousBookingVersion,
          resultingBookingVersion: receipt.resultingBookingVersion,
          status: receipt.status,
          executedAt: receipt.executedAt,
        } : null,
        error: execution.errorCode
          ? { code: execution.errorCode, message: execution.errorMessage ?? "Action could not be completed." }
          : null,
      }
    : null;
}

async function findDecision(
  context: MutationContext,
  incidentId: Doc<"incidents">["_id"],
) {
  return context.db
    .query("policyDecisions")
    .withIndex("by_tenant_incident", (range) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((filter) => filter.eq(filter.field("incidentId"), incidentId))
    .unique();
}

async function findByDecision(
  context: MutationContext,
  decisionId: Doc<"policyDecisions">["_id"],
) {
  return context.db
    .query("confirmationRequests")
    .withIndex("by_tenant_decision", (range) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((filter) => filter.eq(filter.field("decisionId"), decisionId))
    .unique();
}

async function findByHash(context: MutationContext, tokenHash: string) {
  return context.db
    .query("confirmationRequests")
    .withIndex("by_tenant_token_hash", (range) =>
      range.eq("tenantId", DEMO_TENANT_ID).eq("tokenHash", tokenHash),
    )
    .unique();
}

async function findByCompletionHash(context: MutationContext, tokenHash: string) {
  return context.db
    .query("confirmationRequests")
    .withIndex("by_tenant_completion_token_hash", (range) =>
      range.eq("tenantId", DEMO_TENANT_ID).eq("completionTokenHash", tokenHash),
    )
    .unique();
}

async function loadCurrentRelations(
  context: MutationContext,
  request: StoredConfirmation,
) {
  const [incident, decision] = await Promise.all([
    context.db.get(request.incidentId),
    context.db.get(request.decisionId),
  ]);
  if (
    !incident ||
    !decision ||
    incident.tenantId !== request.tenantId ||
    decision.tenantId !== request.tenantId ||
    decision.incidentId !== incident._id
  ) {
    return null;
  }
  const [booking, sources] = await Promise.all([
    context.db
      .query("bookings")
      .withIndex("by_tenant_booking_key", (range) =>
        range.eq("tenantId", request.tenantId),
      )
      .filter((filter) =>
        filter.eq(filter.field("bookingKey"), incident.bookingKey),
      )
      .unique(),
    context.db
      .query("policySources")
      .withIndex("by_tenant_source_version", (range) =>
        range.eq("tenantId", request.tenantId),
      )
      .filter((filter) =>
        filter.eq(filter.field("sourceKey"), decision.sourceKey),
      )
      .collect(),
  ]);
  const activeSources = sources.filter(
    (source: { status: string }) => source.status === "ACTIVE",
  );
  const source = activeSources.length === 1 ? activeSources[0] : null;
  return { incident, decision, booking, source };
}

async function evaluateStoredRequest(
  context: MutationContext,
  request: StoredConfirmation,
  now: string,
) {
  const relations = await loadCurrentRelations(context, request);
  if (!relations)
    return {
      access: { kind: "STALE" as const, status: "STALE" as const },
      relations: null,
    };
  const { incident, decision, booking, source } = relations;
  const currentSourceVersion =
    source?.status === "ACTIVE" ? source.version : "__inactive__";
  const access = evaluateConfirmationAccess({
    now,
    expiresAt: request.expiresAt,
    status: request.status,
    requestConfirmed: request.requestConfirmedByCustomer,
    storedBookingVersion: request.bookingVersion,
    currentBookingVersion: booking?.version ?? -1,
    storedDecisionHash: request.decisionHash,
    currentDecisionHash: decision.decisionHash,
    storedSourceVersion: request.sourceVersion,
    currentSourceVersion,
  });
  if (incident.status !== "AWAITING_CUSTOMER" && access.kind === "ACTIVE") {
    return {
      access: { kind: "STALE" as const, status: "STALE" as const },
      relations,
    };
  }
  return { access, relations };
}

async function publicAccessView(
  context: MutationContext,
  request: StoredConfirmation,
  access: ConfirmationAccessResult,
) {
  if (access.kind === "ACTIVE") {
    return {
      kind: "ACTIVE" as const,
      requestConfirmed: request.requestConfirmedByCustomer,
      snapshot: request.requestSnapshot,
      expiresAt: request.expiresAt,
    };
  }
  if (access.kind === "ALREADY_USED") {
    return {
      kind: "ALREADY_USED" as const,
      status: access.status,
      snapshot: request.requestSnapshot,
      execution: await executionProjection(context, request),
    };
  }
  if (access.kind === "EXPIRED") return { kind: "EXPIRED" as const };
  return { kind: "STALE" as const };
}

export async function createConfirmationHandler(
  context: MutationContext,
  args: CreateArgs,
) {
  const access = await requireIncidentAccess(context, args);
  const nowIso = access.nowIso;
  const decision = await findDecision(context, access.incident._id);
  if (!decision) throw new ConvexError("Policy decision is unavailable.");
  const existing = await findByDecision(context, decision._id);
  if (existing) {
    return {
      status: existing.status,
      created: false,
      expiresAt: existing.expiresAt,
    };
  }
  if (await findByHash(context, args.tokenHash) || await findByCompletionHash(context, args.completionTokenHash)) {
    throw new ConvexError("Confirmation token collision.");
  }
  let canonicalExpiresAt: string;
  try {
    canonicalExpiresAt = validateConfirmationCreation({
      createdAt: nowIso,
      requestedExpiresAt: args.expiresAt,
      tokenHash: args.tokenHash,
      incidentStatus: access.incident.status,
      supportState: decision.supportState,
      decisionState: decision.decisionState ?? "",
      requiresCustomer:
        decision.requirements.customerRequestConfirmation ||
        decision.requirements.customerCommercialApproval,
    });
  } catch (error) {
    throw new ConvexError((error as Error).message);
  }
  const [booking, task, source, catalogueTasks] = await Promise.all([
    context.db
      .query("bookings")
      .withIndex("by_tenant_booking_key", (range) =>
        range.eq("tenantId", access.incident.tenantId),
      )
      .filter((filter) =>
        filter.eq(filter.field("bookingKey"), access.incident.bookingKey),
      )
      .unique(),
    context.db
      .query("taskCatalog")
      .withIndex("by_tenant_task", (range) =>
        range.eq("tenantId", access.incident.tenantId),
      )
      .filter((filter) => filter.eq(filter.field("taskId"), decision.taskId))
      .unique(),
    context.db
      .query("policySources")
      .withIndex("by_tenant_source_version", (range) =>
        range.eq("tenantId", access.incident.tenantId),
      )
      .filter((filter) =>
        filter.and(
          filter.eq(filter.field("sourceKey"), decision.sourceKey),
          filter.eq(filter.field("version"), decision.sourceVersion),
        ),
      )
      .unique(),
    context.db
      .query("taskCatalog")
      .withIndex("by_tenant_task", (range) =>
        range.eq("tenantId", access.incident.tenantId),
      )
      .collect(),
  ]);
  if (!booking || !task || !source || source.status !== "ACTIVE") {
    throw new ConvexError("Confirmation snapshot inputs are unavailable.");
  }
  const requestSnapshot = buildConfirmationSnapshot({
    bookingKey: booking.bookingKey,
    serviceName: booking.serviceName,
    includedTaskIds: booking.includedTaskIds,
    catalogue: catalogueTasks,
    selectedTask: { taskId: task.taskId, displayName: task.displayName },
    durationDeltaMinutes: decision.durationDeltaMinutes,
    priceDeltaMinor: decision.priceDeltaMinor,
    currency: decision.currency ?? booking.currency,
    removableTaskIds: decision.removableTaskIds,
    source,
  });
  transitionIncident(access.incident.status, { type: "SEND_TO_CUSTOMER" }, {});
  await context.db.insert("confirmationRequests", {
    tenantId: access.incident.tenantId,
    incidentId: access.incident._id,
    decisionId: decision._id,
    tokenHash: args.tokenHash,
    completionTokenHash: args.completionTokenHash,
    expiresAt: canonicalExpiresAt,
    status: "PENDING",
    requestSnapshot,
    requestConfirmedByCustomer: false,
    bookingVersion: decision.bookingVersion,
    decisionHash: decision.decisionHash,
    sourceVersion: source.version,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  await context.db.patch(access.incident._id, {
    status: "AWAITING_CUSTOMER",
    updatedAt: nowIso,
  });
  await appendIncidentTrace(context, {
    incident: access.incident,
    runId: access.run._id,
    stage: "customer_confirmation_requested",
    actor: "WORKER",
    inputSummary: "Worker created one customer confirmation request.",
    outputSummary: "Frozen decision snapshot is awaiting the customer.",
    sourceIds: [`${source.sourceKey}:${source.version}`],
    nowIso,
  });
  return {
    status: "PENDING" as const,
    created: true,
    expiresAt: canonicalExpiresAt,
  };
}

export async function getForCustomerHandler(
  context: MutationContext,
  args: { tokenHash: string },
) {
  const request = await findByHash(context, args.tokenHash);
  if (!request) return { kind: "INVALID" as const };
  const nowIso = new Date().toISOString();
  const { access } = await evaluateStoredRequest(context, request, nowIso);
  if (access.kind === "EXPIRED" || access.kind === "STALE") {
    await context.db.patch(request._id, { status: access.kind, updatedAt: nowIso });
  }
  return publicAccessView(context, request, access);
}

async function applyResponse(
  context: MutationContext,
  args: { tokenHash: string },
  requestedResponse: CustomerResponse,
) {
  const nowIso = new Date().toISOString();
  const request = await findByHash(context, args.tokenHash);
  if (!request) throw new ConvexError("Confirmation request is invalid.");
  const evaluated = await evaluateStoredRequest(context, request, nowIso);
  const relations = evaluated.relations;
  const result = applyCustomerResponse({
    now: nowIso,
    expiresAt: request.expiresAt,
    status: request.status,
    requestConfirmed: request.requestConfirmedByCustomer,
    storedBookingVersion: request.bookingVersion,
    currentBookingVersion: relations?.booking?.version ?? -1,
    storedDecisionHash: request.decisionHash,
    currentDecisionHash: relations?.decision?.decisionHash ?? "__missing__",
    storedSourceVersion: request.sourceVersion,
    currentSourceVersion:
      relations?.source?.status === "ACTIVE" ? relations.source.version : "__inactive__",
    requestedResponse,
  });
  if (result.kind === "REJECTED") {
    if (result.reason === "REQUEST_NOT_CONFIRMED")
      throw new ConvexError("Customer must confirm the request first.");
    if (result.reason === "ALREADY_USED")
      throw new ConvexError("Confirmation request is already used.");
    await context.db.patch(request._id, { status: result.reason, updatedAt: nowIso });
    return { kind: result.reason };
  }
  if (result.kind === "IDEMPOTENT") {
    return { kind: "IDEMPOTENT" as const, status: result.status };
  }
  if (!relations) throw new ConvexError("Confirmation request is stale.");
  const patch: Record<string, unknown> = {
    status: result.status,
    requestConfirmedByCustomer: result.requestConfirmed,
    updatedAt: nowIso,
  };
  if (requestedResponse === "CONFIRM_REQUEST") patch.requestConfirmedAt = nowIso;
  if (requestedResponse === "APPROVE" || requestedResponse === "DECLINE") {
    patch.commercialResponse = requestedResponse;
    patch.respondedAt = nowIso;
  }
  if (requestedResponse === "REPORT_MISMATCH") patch.respondedAt = nowIso;
  await context.db.patch(request._id, patch);
  await context.db.patch(relations.incident._id, {
    status: result.incidentStatus,
    updatedAt: nowIso,
  });
  await appendIncidentTrace(context, {
    incident: relations.incident,
    runId: relations.incident.demoRunId,
    stage:
      requestedResponse === "CONFIRM_REQUEST"
        ? "customer_request_confirmed"
        : "customer_response_recorded",
    actor: "CUSTOMER",
    inputSummary: "Customer submitted a bounded confirmation response.",
    outputSummary: `Confirmation state is ${result.status}.`,
    sourceIds: [`${request.requestSnapshot.sourceKey}:${request.sourceVersion}`],
    nowIso,
  });
  return requestedResponse === "CONFIRM_REQUEST"
    ? { kind: "ACTIVE" as const, requestConfirmed: true }
    : { kind: "RECORDED" as const, status: result.status };
}

export async function confirmRequestHandler(
  context: MutationContext,
  args: { tokenHash: string; answer: "YES" | "MISMATCH" },
) {
  return applyResponse(
    context,
    args,
    args.answer === "YES" ? "CONFIRM_REQUEST" : "REPORT_MISMATCH",
  );
}

export async function respondHandler(
  context: MutationContext,
  args: { tokenHash: string; response: "APPROVE" | "DECLINE" },
) {
  return applyResponse(context, args, args.response);
}

export async function getForWorkerHandler(
  context: MutationContext,
  args: WorkerArgs,
) {
  const access = await findIncidentAccess(context, args);
  if (!access) return null;
  const decision = await findDecision(context, access.incident._id);
  if (!decision) return null;
  const request = await findByDecision(context, decision._id);
  if (!request) return null;
  const nowIso = new Date().toISOString();
  const evaluated = await evaluateStoredRequest(context, request, nowIso);
  if (evaluated.access.kind === "EXPIRED" || evaluated.access.kind === "STALE") {
    request.status = evaluated.access.kind;
    await context.db.patch(request._id, {
      status: evaluated.access.kind,
      updatedAt: nowIso,
    });
  }
  return {
    status: request.status,
    expiresAt: request.expiresAt,
    requestConfirmed: request.requestConfirmedByCustomer,
    commercialResponse: request.commercialResponse ?? null,
    respondedAt: request.respondedAt ?? null,
    snapshot: request.requestSnapshot,
    execution: await executionProjection(context, request),
  };
}
