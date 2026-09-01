import { ConvexError } from "convex/values";

import { canAccessDemoRun } from "../src/domain/demo-session-policy";
import { DEMO_TENANT_ID } from "./fixtures";

export const INCIDENT_FLOW_VERSION = "taskconfirm-typed-v1";

// The checked-in pre-deployment Convex shim cannot expose generated context
// types. These helpers keep that temporary exception at the database seam.
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function requireIncidentAccess(
  context: any,
  args: {
    publicRunId: string;
    browserTokenHash: string;
    incidentKey: string;
  },
) {
  const now = new Date();
  const run = await context.db
    .query("demoRuns")
    .withIndex("by_tenant_public_run", (range: any) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((filter: any) =>
      filter.eq(filter.field("publicRunId"), args.publicRunId),
    )
    .unique();
  if (!canAccessDemoRun(run, args.browserTokenHash, now))
    throw new ConvexError("This demo session is unavailable.");
  const incident = await context.db
    .query("incidents")
    .withIndex("by_tenant_incident_key", (range: any) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((filter: any) =>
      filter.eq(filter.field("incidentKey"), args.incidentKey),
    )
    .unique();
  if (!incident || incident.demoRunId !== run._id)
    throw new ConvexError("Incident is unavailable.");
  return { run, incident, nowIso: now.toISOString() };
}

export async function findIncidentAccess(context: any, args: any) {
  try {
    return await requireIncidentAccess(context, args);
  } catch {
    return null;
  }
}

export async function appendIncidentTrace(
  context: any,
  input: {
    incident: any;
    runId: any;
    stage: string;
    actor: "WORKER" | "SYSTEM";
    inputSummary: string;
    outputSummary: string;
    sourceIds?: string[];
    nowIso: string;
  },
) {
  const steps = await context.db
    .query("traceSteps")
    .withIndex("by_tenant_incident_sequence", (range: any) =>
      range.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((filter: any) =>
      filter.eq(filter.field("incidentId"), input.incident._id),
    )
    .collect();
  const sequence =
    Math.max(0, ...steps.map((step: { sequence: number }) => step.sequence)) +
    1;
  await context.db.insert("traceSteps", {
    tenantId: DEMO_TENANT_ID,
    incidentId: input.incident._id,
    runId: input.runId,
    sequence,
    stage: input.stage,
    actor: input.actor,
    status: "COMPLETED",
    inputSummary: input.inputSummary,
    outputSummary: input.outputSummary,
    sourceIds: input.sourceIds ?? [],
    flowVersion: INCIDENT_FLOW_VERSION,
    startedAt: input.nowIso,
    completedAt: input.nowIso,
    metadata: { bookingVersion: input.incident.bookingVersion },
  });
}

/* eslint-enable @typescript-eslint/no-explicit-any */
