import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const reserve = makeFunctionReference<"mutation", { tokenHash: string }, Record<string, unknown>>(
  "actionExecutions:reserve",
);
const finalize = makeFunctionReference<"mutation", { tokenHash: string; receipt: unknown }, Record<string, unknown>>("actionExecutions:finalize");
const fail = makeFunctionReference<"mutation", { tokenHash: string; code: string; message: string; retryable: boolean }, Record<string, unknown>>("actionExecutions:fail");
const executeMockConnector = makeFunctionReference<"mutation", { request: unknown }, Record<string, unknown>>("actionExecutions:executeMockConnector");
const tenantId = "demo_sahaay_home_services";
const tokenHash = "a".repeat(64);

async function approvedDatabase() {
  const database = convexTest(schema, modules);
  await database.run(async (context) => {
    const now = "2026-09-01T10:00:00.000Z";
    const runId = await context.db.insert("demoRuns", { tenantId, publicRunId: "run", browserTokenHash: "b".repeat(64), status: "ACTIVE", bookingKey: "DEMO-4821", startedAt: now, lastActiveAt: now, resumeExpiresAt: "2099-01-01T00:00:00.000Z" });
    await context.db.insert("bookings", { tenantId, bookingKey: "DEMO-4821", workerPublicUserId: "worker", customerAlias: "Neha", serviceId: "clean", serviceName: "Cleaning", status: "IN_PROGRESS", city: "Pune", currency: "INR", scheduledDurationMinutes: 120, remainingDurationMinutes: 50, workerRole: "HOME_SERVICE_WORKER", version: 1, includedTaskIds: ["bathroom"], existingAddOnTaskIds: [], catalogVersion: "v1" });
    const incidentId = await context.db.insert("incidents", { tenantId, incidentKey: "inc", demoRunId: runId, scenarioPack: "TASK_CONFIRM", bookingKey: "DEMO-4821", bookingVersion: 1, workerPublicUserId: "worker", status: "ACTION_AUTHORISED", riskTier: 1, supportState: "SUPPORTED", flowVersion: "v1", createdAt: now, updatedAt: now });
    const decisionId = await context.db.insert("policyDecisions", { tenantId, incidentId, bookingVersion: 1, taskId: "balcony_deep_cleaning", ruleKey: "rule", ruleVersion: "v1", sourceKey: "source", sourceVersion: "v1", passageKey: "p", decisionState: "ADD_ON_APPROVAL_REQUIRED", supportState: "SUPPORTED", durationDeltaMinutes: 25, priceDeltaMinor: 29900, currency: "INR", removableTaskIds: [], requirements: { customerRequestConfirmation: true, customerCommercialApproval: true, humanReview: false, workerFeasibilityConfirmation: false }, flowVersion: "v1", promptVersion: "v1", modelId: "none", allowedActions: ["ADD_TASK"], prohibitedActions: [], explanationKey: "add", decisionHash: "decision-v1", createdAt: now });
    await context.db.insert("policySources", { tenantId, sourceKey: "source", title: "Policy", owner: "Ops", version: "v1", status: "ACTIVE", effectiveFrom: now, effectiveTo: null, priority: 1, regionTags: ["Pune"], roleTags: ["HOME_SERVICE_WORKER"], notice: "Demo" });
    await context.db.insert("confirmationRequests", { tenantId, incidentId, decisionId, tokenHash, expiresAt: "2099-01-01T00:00:00.000Z", status: "APPROVED", requestSnapshot: { bookingKey: "DEMO-4821", serviceName: "Cleaning", includedTasks: [{ taskId: "bathroom", displayName: "Bathroom" }], resultingTasks: [{ taskId: "bathroom", displayName: "Bathroom" }, { taskId: "balcony_deep_cleaning", displayName: "Balcony" }], taskId: "balcony_deep_cleaning", taskDisplayName: "Balcony", decisionState: "ADD_ON_APPROVAL_REQUIRED", durationDeltaMinutes: 25, priceDeltaMinor: 29900, currency: "INR", removableTaskIds: [], sourceKey: "source", sourceTitle: "Policy", sourceVersion: "v1" }, requestConfirmedByCustomer: true, requestConfirmedAt: now, commercialResponse: "APPROVE", respondedAt: now, bookingVersion: 1, decisionHash: "decision-v1", sourceVersion: "v1", createdAt: now, updatedAt: now });
  });
  return database;
}

describe("authorised action persistence", () => {
  it("rejects reservation when the confirmation is missing", async () => {
    const database = convexTest(schema, modules);
    await expect(database.mutation(reserve, { tokenHash: "a".repeat(64) })).rejects.toThrow(
      "Confirmation request is invalid",
    );
  });

  it("finalizes one booking mutation and reuses the durable receipt", async () => {
    const database = await approvedDatabase();
    const reservation = await database.mutation(reserve, { tokenHash }) as { kind: "EXECUTE"; request: { idempotencyKey: string; requestHash: string; bookingVersion: number } };
    const receipt = { actionExecutionId: "EXEC-1", connector: "DEMONSTRATION_CONNECTOR", idempotencyKey: reservation.request.idempotencyKey, externalActionId: "ACT-DEMO-1", requestHash: reservation.request.requestHash, previousBookingVersion: 1, resultingBookingVersion: 2, actionType: "ADD_TASK", status: "SUCCEEDED", executedAt: "2026-09-01T10:01:00.000Z" };
    const first = await database.mutation(finalize, { tokenHash, receipt });
    const second = await database.mutation(finalize, { tokenHash, receipt });
    expect(second).toEqual(first);
    const booking = await database.run((context) => context.db.query("bookings").unique());
    expect(booking).toMatchObject({ version: 2, scheduledDurationMinutes: 145, includedTaskIds: ["bathroom", "balcony_deep_cleaning"], existingAddOnTaskIds: ["balcony_deep_cleaning"] });
    expect(await database.run((context) => context.db.query("actionExecutions").collect())).toHaveLength(1);
  });

  it("reuses one reservation for a retryable failure", async () => {
    const database = await approvedDatabase();
    await database.mutation(reserve, { tokenHash });
    await expect(database.mutation(fail, { tokenHash, code: "TRANSIENT_BEFORE_COMMIT", message: "Temporary connector failure.", retryable: true })).resolves.toMatchObject({ status: "RETRYABLE_FAILED", attemptCount: 1 });
    await expect(database.mutation(reserve, { tokenHash })).resolves.toMatchObject({ kind: "EXECUTE" });
    const executions = await database.run((context) => context.db.query("actionExecutions").collect());
    expect(executions).toHaveLength(1);
    expect(executions[0]).toMatchObject({ status: "PENDING", attemptCount: 2 });
  });

  it("recovers a pending reservation after refresh with the same idempotency key", async () => {
    const database = await approvedDatabase();
    const first = await database.mutation(reserve, { tokenHash }) as { kind: "EXECUTE"; request: { idempotencyKey: string } };
    const recovered = await database.mutation(reserve, { tokenHash }) as { kind: "EXECUTE"; request: { idempotencyKey: string } };
    expect(recovered.request.idempotencyKey).toBe(first.request.idempotencyKey);
    const executions = await database.run((context) => context.db.query("actionExecutions").collect());
    expect(executions).toHaveLength(1);
    expect(executions[0]).toMatchObject({ status: "PENDING", attemptCount: 2 });
  });

  it("returns one durable connector receipt across separate calls", async () => {
    const database = await approvedDatabase();
    const reservation = await database.mutation(reserve, { tokenHash }) as { kind: "EXECUTE"; request: unknown };
    const first = await database.mutation(executeMockConnector, { request: reservation.request });
    const second = await database.mutation(executeMockConnector, { request: reservation.request });
    expect(second).toEqual(first);
    expect(await database.run((context) => context.db.query("mockConnectorReceipts").collect())).toHaveLength(1);
  });

  it("escalates without a second connector mutation when authority changes after connector success", async () => {
    const database = await approvedDatabase();
    const reservation = await database.mutation(reserve, { tokenHash }) as { kind: "EXECUTE"; request: { idempotencyKey: string } };
    const receipt = await database.mutation(executeMockConnector, { request: reservation.request });
    await database.run(async (context) => {
      const booking = await context.db.query("bookings").unique();
      if (!booking) throw new Error("Expected booking fixture.");
      await context.db.patch(booking._id, { version: 2 });
    });
    await expect(database.mutation(finalize, { tokenHash, receipt })).rejects.toThrow("Action authority changed");
    await database.mutation(fail, { tokenHash, code: "FINALIZATION_PENDING", message: "Stored receipt needs reconciliation.", retryable: true });

    await expect(database.mutation(reserve, { tokenHash })).resolves.toMatchObject({
      kind: "STORED",
      execution: {
        status: "RECONCILIATION_REQUIRED",
        error: { code: "RECONCILIATION_REQUIRED" },
      },
    });
    expect(await database.run((context) => context.db.query("mockConnectorReceipts").collect())).toHaveLength(1);
    expect(await database.run((context) => context.db.query("actionExecutions").unique())).toMatchObject({ status: "RECONCILIATION_REQUIRED" });
    expect(await database.run((context) => context.db.query("incidents").unique())).toMatchObject({ status: "AWAITING_HUMAN_REVIEW" });
  });
});
