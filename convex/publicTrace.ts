import type { DataModelFromSchemaDefinition, GenericQueryCtx } from "convex/server";
import { v } from "convex/values";

import { projectPublicTrace } from "../src/domain/public-trace";
import { DEMO_TENANT_ID } from "./fixtures";
import schema from "./schema";
import { query } from "./_generated/server";

type Context = GenericQueryCtx<DataModelFromSchemaDefinition<typeof schema>>;
type Access = { publicRunId: string; browserTokenHash: string };
const HASH = /^[a-f0-9]{64}$/;

async function getCurrentHandler(context: Context, access: Access) {
  if (!HASH.test(access.browserTokenHash)) return null;
  const run = await context.db.query("demoRuns").withIndex("by_tenant_public_run", (q) => q.eq("tenantId", DEMO_TENANT_ID).eq("publicRunId", access.publicRunId)).unique();
  if (!run || run.browserTokenHash !== access.browserTokenHash || run.status === "ABANDONED" || Date.parse(run.resumeExpiresAt) <= Date.now()) return null;
  const incidents = await context.db.query("incidents").withIndex("by_tenant_booking", (q) => q.eq("tenantId", run.tenantId).eq("bookingKey", run.bookingKey)).collect();
  const incident = incidents.find((item) => item.demoRunId === run._id);
  if (!incident) return projectPublicTrace({ traceId: `trace-${run.publicRunId}`, title: "Current TaskConfirm run", outcome: "Run started", scenario: "TASK_CONFIRM", stages: [{ sequence: 1, label: "Run started", actor: "SYSTEM", status: "COMPLETED", summary: "A private demo run was started.", versions: { flow: "taskconfirm-v1" } }] });

  const [steps, interpretation, decision, confirmation, executions, completion, verification, replay, capability] = await Promise.all([
    context.db.query("traceSteps").withIndex("by_tenant_incident_sequence", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).collect(),
    context.db.query("exceptionInterpretations").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).unique(),
    context.db.query("policyDecisions").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).unique(),
    context.db.query("confirmationRequests").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).unique(),
    context.db.query("actionExecutions").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).collect(),
    context.db.query("completionSummaries").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).unique(),
    context.db.query("verificationEvents").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).collect(),
    context.db.query("replays").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).unique(),
    context.db.query("capabilityEvents").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).unique(),
  ]);
  const execution = executions.find((item) => item.status === "SUCCEEDED") ?? executions.at(-1);
  const ordered = [...steps].sort((a, b) => a.sequence - b.sequence).map((step, index) => ({ sequence: index + 1, label: step.stage, actor: (["WORKER", "CUSTOMER", "SYSTEM", "MODEL", "CONNECTOR", "REVIEWER"].includes(step.actor) ? step.actor : "SYSTEM") as "WORKER" | "CUSTOMER" | "SYSTEM" | "MODEL" | "CONNECTOR" | "REVIEWER", status: "COMPLETED" as const, summary: step.outputSummary, versions: { flow: step.flowVersion } }));
  if (!ordered.length) ordered.push({ sequence: 1, label: "Incident", actor: "SYSTEM", status: "COMPLETED", summary: `TaskConfirm incident is ${incident.status.toLowerCase().replaceAll("_", " ")}.`, versions: { flow: incident.flowVersion } });
  const final = ordered.at(-1)!;
  if (interpretation) Object.assign(final, { versions: { model: interpretation.modelId, flow: interpretation.flowVersion, prompt: interpretation.promptVersion }, metrics: interpretation.providerMetadata ? { latencyMs: interpretation.providerMetadata.latencyMs, ...(interpretation.providerMetadata.inputTokens === null ? {} : { inputTokens: interpretation.providerMetadata.inputTokens }), ...(interpretation.providerMetadata.outputTokens === null ? {} : { outputTokens: interpretation.providerMetadata.outputTokens }), ...(interpretation.providerMetadata.estimatedCostMinor === null ? {} : { estimatedCostMinor: interpretation.providerMetadata.estimatedCostMinor }) } : undefined });
  if (decision?.sourceKey && decision.sourceVersion) Object.assign(final, { source: { id: decision.sourceKey, version: decision.sourceVersion }, versions: { model: decision.modelId, flow: decision.flowVersion, prompt: decision.promptVersion } });
  if (confirmation) Object.assign(final, { approval: { state: confirmation.status === "APPROVED" ? "APPROVED" : confirmation.status === "DECLINED" ? "DECLINED" : confirmation.status === "EXPIRED" ? "EXPIRED" : "PENDING", ...(confirmation.status === "APPROVED" ? { approvedBy: "CUSTOMER" } : {}) } });
  if (execution) Object.assign(final, { receipt: { state: execution.status === "SUCCEEDED" ? "SUCCEEDED" : execution.status.includes("FAILED") ? "FAILED" : "NOT_ATTEMPTED", ...(execution.externalActionId ? { reference: execution.externalActionId } : {}) } });
  if (completion || verification.length || replay || capability) final.summary = `Outcome ${completion?.verificationState ?? verification.at(-1)?.state ?? incident.status}; replay ${replay ? "created" : "not created"}; capability ${capability?.result ?? "not recorded"}.`;
  return projectPublicTrace({ traceId: `trace-${run.publicRunId}`, title: "Current TaskConfirm run", outcome: decision?.decisionState ?? incident.status, scenario: "TASK_CONFIRM", stages: ordered });
}

export const getCurrent = query({ args: { publicRunId: v.string(), browserTokenHash: v.string() }, handler: getCurrentHandler });
