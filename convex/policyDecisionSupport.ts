/* eslint-disable @typescript-eslint/no-explicit-any -- checked-in Convex shim has no generated context types. */
import { ConvexError } from "convex/values";
import {
  orchestratePolicyDecision,
  policyOutcome,
} from "../src/domain/policy-orchestration";
import { transitionIncident } from "../src/domain/incident-state";
import { DEMO_TENANT_ID } from "./fixtures";
import {
  appendIncidentTrace,
  findIncidentAccess,
  INCIDENT_FLOW_VERSION,
  requireIncidentAccess,
} from "./incidentSupport";

type PolicyArgs = {
  publicRunId: string;
  browserTokenHash: string;
  incidentKey: string;
};

async function findExistingDecision(context: any, incidentId: any) {
  return context.db
    .query("policyDecisions")
    .withIndex("by_tenant_incident", (range: any) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((filter: any) => filter.eq(filter.field("incidentId"), incidentId))
    .unique();
}

async function loadResolutionContext(context: any, incident: any) {
  const confirmations = await context.db
    .query("taskConfirmations")
    .withIndex("by_tenant_incident", (range: any) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((filter: any) =>
      filter.eq(filter.field("incidentId"), incident._id),
    )
    .collect();
  const confirmation = confirmations.at(-1);
  if (!confirmation) throw new ConvexError("Confirmed task is unavailable.");
  const booking = await context.db
    .query("bookings")
    .withIndex("by_tenant_booking_key", (range: any) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((filter: any) =>
      filter.eq(filter.field("bookingKey"), incident.bookingKey),
    )
    .unique();
  const selectedTask = await context.db
    .query("taskCatalog")
    .withIndex("by_tenant_task", (range: any) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((filter: any) =>
      filter.eq(filter.field("taskId"), confirmation.selectedTaskId),
    )
    .unique();
  if (
    !booking ||
    !selectedTask ||
    booking.version !== incident.bookingVersion
  ) {
    throw new ConvexError("Policy inputs are unavailable or stale.");
  }
  const [sources, rules, passages] = await Promise.all([
    context.db
      .query("policySources")
      .withIndex("by_tenant_source_version", (range: any) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .collect(),
    context.db
      .query("policyRules")
      .withIndex("by_tenant_rule", (range: any) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .collect(),
    context.db
      .query("policyPassages")
      .withIndex("by_tenant_source_passage", (range: any) =>
        range.eq("tenantId", DEMO_TENANT_ID),
      )
      .collect(),
  ]);
  const evidencedRules = rules.filter((rule: any) =>
    passages.some(
      (passage: any) =>
        passage.sourceKey === rule.sourceKey &&
        passage.sourceVersion === rule.sourceVersion &&
        passage.passageKey === rule.passageKey,
    ),
  );
  return { booking, selectedTask, sources, evidencedRules };
}

function resolveApprovedPolicy(inputs: any, nowIso: string) {
  return orchestratePolicyDecision({
    currentTime: nowIso,
    bookingVersion: inputs.booking.version,
    booking: {
      tenantId: inputs.booking.tenantId,
      bookingKey: inputs.booking.bookingKey,
      version: inputs.booking.version,
      serviceId: inputs.booking.serviceId,
      catalogVersion: inputs.booking.catalogVersion,
      includedTaskIds: inputs.booking.includedTaskIds,
      workerRole: inputs.booking.workerRole,
      city: inputs.booking.city,
    },
    selectedTask: {
      tenantId: inputs.selectedTask.tenantId,
      taskId: inputs.selectedTask.taskId,
      catalogVersion: inputs.selectedTask.catalogVersion,
      active: inputs.selectedTask.active,
    },
    sources: inputs.sources,
    rules: inputs.evidencedRules.map((rule: any) => ({
      tenantId: rule.tenantId,
      ruleKey: rule.ruleKey,
      version: rule.ruleVersion,
      sourceKey: rule.sourceKey,
      sourceVersion: rule.sourceVersion,
      serviceId: rule.serviceId,
      catalogVersion: rule.catalogVersion,
      taskId: rule.taskId,
      decisionState: rule.decisionState,
      durationDeltaMinutes: rule.durationDeltaMinutes,
      priceDeltaMinor: rule.priceDeltaMinor,
      currency: rule.currency,
      removableTaskIds: rule.removableTaskIds,
      requiresCustomerRequestConfirmation:
        rule.requiresCustomerRequestConfirmation,
      requiresCustomerCommercialApproval:
        rule.requiresCustomerCommercialApproval,
      requiresHumanReview: rule.requiresHumanReview,
      requiresWorkerFeasibilityConfirmation:
        rule.requiresWorkerFeasibilityConfirmation,
      roleTags: rule.roleTags,
      regionTags: rule.regionTags,
      specificity: rule.specificity,
      prohibitedActions: rule.prohibitedActions,
      active: rule.active,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      priority: rule.priority,
    })),
  });
}

async function persistDecision(
  context: any,
  incident: any,
  inputs: any,
  orchestration: any,
  nowIso: string,
) {
  const { result, supported, decisionHash } = orchestration;
  const outcome = policyOutcome(orchestration);
  const matchingRule = orchestration.rule
    ? inputs.evidencedRules.find(
        (rule: any) =>
          rule.ruleKey === orchestration.rule.ruleKey &&
          rule.ruleVersion === orchestration.rule.version,
      )
    : undefined;
  await context.db.insert("policyDecisions", {
    tenantId: DEMO_TENANT_ID,
    incidentId: incident._id,
    bookingVersion: inputs.booking.version,
    taskId: inputs.selectedTask.taskId,
    ruleKey: supported ? result.ruleKey : undefined,
    ruleVersion: supported ? result.ruleVersion : undefined,
    sourceKey: supported ? result.sourceKey : undefined,
    sourceVersion: supported ? result.sourceVersion : undefined,
    passageKey: matchingRule?.passageKey,
    decisionState: supported ? result.decisionState : undefined,
    supportState: result.supportState,
    durationDeltaMinutes: outcome.durationDeltaMinutes,
    priceDeltaMinor: outcome.priceDeltaMinor,
    currency: outcome.currency,
    removableTaskIds: outcome.removableTaskIds,
    requirements: outcome.requirements,
    flowVersion: INCIDENT_FLOW_VERSION,
    promptVersion: "deterministic-policy-resolver-v1",
    modelId: "none-deterministic-v1",
    allowedActions: outcome.allowedActions,
    prohibitedActions: outcome.prohibitedActions,
    explanationKey: outcome.explanationKey,
    decisionHash,
    createdAt: nowIso,
  });
  await context.db.patch(incident._id, {
    status: orchestration.status,
    supportState: result.supportState,
    updatedAt: nowIso,
  });
}

async function persistReview(
  context: any,
  incident: any,
  selectedTask: any,
  orchestration: any,
  nowIso: string,
) {
  if (orchestration.status !== "AWAITING_HUMAN_REVIEW") return;
  await context.db.insert("humanReviews", {
    tenantId: DEMO_TENANT_ID,
    incidentId: incident._id,
    reviewType: "POLICY_SUPPORT",
    status: "OPEN",
    reasonCode: orchestration.result.supportState,
    contextSnapshot: { confirmedText: selectedTask.taskId },
    createdAt: nowIso,
  });
}

async function appendPolicyTrace(
  context: any,
  access: any,
  orchestration: any,
  auditEvent: string,
) {
  const { result, supported } = orchestration;
  await appendIncidentTrace(context, {
    incident: access.incident,
    runId: access.run._id,
    stage: auditEvent,
    actor: "SYSTEM",
    inputSummary:
      "Confirmed task checked against active approved policy snapshots.",
    outputSummary: supported
      ? `Policy resolved as ${result.decisionState}.`
      : `Policy abstained as ${result.supportState}.`,
    sourceIds: supported
      ? [
          `${result.sourceKey}:${result.sourceVersion}`,
          `${result.ruleKey}:${result.ruleVersion}`,
        ]
      : [],
    nowIso: access.nowIso,
  });
}

async function resolvePolicyDecisionWorkflow(context: any, args: PolicyArgs) {
  const access = await requireIncidentAccess(context, args);
  const existing = await findExistingDecision(context, access.incident._id);
  if (existing)
    return {
      status: access.incident.status,
      supportState: existing.supportState,
      decisionState: existing.decisionState,
      taskId: existing.taskId,
      decisionHash: existing.decisionHash,
    };
  const transition = transitionIncident(
    access.incident.status,
    { type: "RESOLVE_POLICY" },
    {},
  );
  const inputs = await loadResolutionContext(context, access.incident);
  const orchestration = resolveApprovedPolicy(inputs, access.nowIso);
  await persistDecision(
    context,
    access.incident,
    inputs,
    orchestration,
    access.nowIso,
  );
  await persistReview(
    context,
    access.incident,
    inputs.selectedTask,
    orchestration,
    access.nowIso,
  );
  await appendPolicyTrace(
    context,
    access,
    orchestration,
    transition.auditEvent,
  );
  return {
    status: orchestration.status,
    supportState: orchestration.result.supportState,
    decisionState: orchestration.supported
      ? orchestration.result.decisionState
      : undefined,
    taskId: inputs.selectedTask.taskId,
    decisionHash: orchestration.decisionHash,
  };
}

async function loadEvidenceRelations(context: any, access: any, decision: any) {
  const booking = await context.db
    .query("bookings")
    .withIndex("by_tenant_booking_key", (range: any) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((filter: any) =>
      filter.eq(filter.field("bookingKey"), access.incident.bookingKey),
    )
    .unique();
  const catalogue = await context.db
    .query("taskCatalog")
    .withIndex("by_tenant_task", (range: any) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .collect();
  const selectedTask = catalogue.find(
    (task: any) => task.taskId === decision.taskId,
  );
  const source =
    decision.sourceKey && decision.sourceVersion
      ? await context.db
          .query("policySources")
          .withIndex("by_tenant_source_version", (range: any) =>
            range.eq("tenantId", DEMO_TENANT_ID),
          )
          .filter((filter: any) =>
            filter.and(
              filter.eq(filter.field("sourceKey"), decision.sourceKey),
              filter.eq(filter.field("version"), decision.sourceVersion),
            ),
          )
          .unique()
      : null;
  const passage =
    decision.sourceKey && decision.sourceVersion && decision.passageKey
      ? await context.db
          .query("policyPassages")
          .withIndex("by_tenant_source_passage", (range: any) =>
            range.eq("tenantId", DEMO_TENANT_ID),
          )
          .filter((filter: any) =>
            filter.and(
              filter.eq(filter.field("sourceKey"), decision.sourceKey),
              filter.eq(filter.field("sourceVersion"), decision.sourceVersion),
              filter.eq(filter.field("passageKey"), decision.passageKey),
            ),
          )
          .unique()
      : null;
  return booking && selectedTask
    ? { booking, catalogue, selectedTask, source, passage }
    : null;
}

function assembleWorkerView(access: any, decision: any, relations: any) {
  const { booking, catalogue, selectedTask, source, passage } = relations;
  return {
    incidentKey: access.incident.incidentKey,
    status: access.incident.status,
    booking: {
      bookingKey: booking.bookingKey,
      bookingVersion: decision.bookingVersion,
      serviceName: booking.serviceName,
      scheduledDurationMinutes: booking.scheduledDurationMinutes,
      remainingDurationMinutes: booking.remainingDurationMinutes,
      catalogVersion: booking.catalogVersion,
      includedTasks: catalogue
        .filter((task: any) => booking.includedTaskIds.includes(task.taskId))
        .map((task: any) => ({
          taskId: task.taskId,
          displayName: task.displayName,
        })),
    },
    selectedTask: {
      taskId: selectedTask.taskId,
      displayName: selectedTask.displayName,
      catalogVersion: selectedTask.catalogVersion,
    },
    outcome: {
      decisionState: decision.decisionState,
      supportState: decision.supportState,
      durationDeltaMinutes: decision.durationDeltaMinutes,
      priceDeltaMinor: decision.priceDeltaMinor,
      currency: decision.currency,
      removableTaskIds: decision.removableTaskIds,
      requirements: decision.requirements,
      allowedActions: decision.allowedActions,
      prohibitedActions: decision.prohibitedActions,
      explanationKey: decision.explanationKey,
    },
    authority: source
      ? {
          sourceKey: source.sourceKey,
          title: source.title,
          owner: source.owner,
          version: source.version,
          effectiveFrom: source.effectiveFrom,
          notice: source.notice,
          ruleKey: decision.ruleKey,
          ruleVersion: decision.ruleVersion,
          passage: passage
            ? {
                passageKey: passage.passageKey,
                heading: passage.heading,
                text: passage.text,
              }
            : null,
        }
      : null,
    decisionHash: decision.decisionHash,
    createdAt: decision.createdAt,
  };
}

async function loadWorkerPolicyDecision(context: any, args: PolicyArgs) {
  const access = await findIncidentAccess(context, args);
  if (!access) return null;
  const decision = await findExistingDecision(context, access.incident._id);
  if (!decision) return null;
  const relations = await loadEvidenceRelations(context, access, decision);
  return relations ? assembleWorkerView(access, decision, relations) : null;
}

export async function resolvePolicyDecisionHandler(
  context: any,
  args: PolicyArgs,
) {
  return resolvePolicyDecisionWorkflow(context, args);
}

export async function getPolicyDecisionHandler(context: any, args: PolicyArgs) {
  return loadWorkerPolicyDecision(context, args);
}
