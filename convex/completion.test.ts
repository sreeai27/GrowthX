import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const get = makeFunctionReference<"mutation", WorkerAccess, Record<string, unknown> | null>("completion:get");
const submit = makeFunctionReference<"mutation", WorkerAccess & { input: unknown }, Record<string, unknown>>("completion:submitWorkerSummary");
const getForCustomer = makeFunctionReference<"mutation", { tokenHash: string }, Record<string, unknown>>("completion:getForCustomer");
const respond = makeFunctionReference<"mutation", { tokenHash: string; input: unknown }, Record<string, unknown>>("completion:respondAsCustomer");

const defaultTenantId = "demo_sahaay_home_services";
const tokenHash = "a".repeat(64);
const workerAccess = { publicRunId: "run-completion", browserTokenHash: "b".repeat(64), incidentKey: "inc-completion" };
type WorkerAccess = typeof workerAccess;

async function setup(options: { executed?: boolean; blocked?: boolean; tenantId?: string } = {}) {
  const database = convexTest(schema, modules);
  const tenantId = options.tenantId ?? defaultTenantId;
  const now = "2026-09-01T10:00:00.000Z";
  await database.run(async (context) => {
    const runId = await context.db.insert("demoRuns", { tenantId, publicRunId: workerAccess.publicRunId, browserTokenHash: workerAccess.browserTokenHash, status: "ACTIVE", bookingKey: "DEMO-4821", startedAt: now, lastActiveAt: now, resumeExpiresAt: "2099-01-01T00:00:00.000Z" });
    await context.db.insert("bookings", { tenantId, bookingKey: "DEMO-4821", workerPublicUserId: "worker", customerAlias: "Neha", serviceId: "clean", serviceName: "Cleaning", status: "IN_PROGRESS", city: "Pune", currency: "INR", scheduledDurationMinutes: options.executed === false ? 120 : 145, remainingDurationMinutes: 50, workerRole: "HOME_SERVICE_WORKER", version: options.executed === false ? 1 : 2, includedTaskIds: options.executed === false ? ["bathroom"] : ["bathroom", "balcony"], existingAddOnTaskIds: options.executed === false ? [] : ["balcony"], catalogVersion: "v1" });
    for (const [taskId, displayName] of [["bathroom", "Bathroom"], ["balcony", "Balcony"]] as const) await context.db.insert("taskCatalog", { tenantId, catalogVersion: "v1", taskId, displayName, category: "CLEANING", riskTier: 1, synonymsHi: [], synonymsMr: [], active: true });
    const incidentId = await context.db.insert("incidents", { tenantId, incidentKey: workerAccess.incidentKey, demoRunId: runId, scenarioPack: "TASK_CONFIRM", bookingKey: "DEMO-4821", bookingVersion: options.executed === false ? 1 : 2, workerPublicUserId: "worker", status: "COMPLETION_PENDING", riskTier: 1, supportState: "SUPPORTED", flowVersion: "v1", createdAt: now, updatedAt: now });
    const decisionId = await context.db.insert("policyDecisions", { tenantId, incidentId, bookingVersion: 1, taskId: "balcony", ruleKey: "rule", ruleVersion: "v1", sourceKey: "source", sourceVersion: "v1", passageKey: "p", decisionState: "ADD_ON_APPROVAL_REQUIRED", supportState: "SUPPORTED", durationDeltaMinutes: 25, priceDeltaMinor: 29900, currency: "INR", removableTaskIds: [], requirements: { customerRequestConfirmation: true, customerCommercialApproval: true, humanReview: false, workerFeasibilityConfirmation: false }, flowVersion: "v1", promptVersion: "v1", modelId: "none", allowedActions: ["ADD_TASK"], prohibitedActions: [], explanationKey: "add", decisionHash: "hash", createdAt: now });
    const confirmationId = await context.db.insert("confirmationRequests", { tenantId, incidentId, decisionId, tokenHash: "b".repeat(64), completionTokenHash: tokenHash, expiresAt: "2099-01-01T00:00:00.000Z", status: options.executed === false ? "DECLINED" : "APPROVED", requestSnapshot: { bookingKey: "DEMO-4821", serviceName: "Cleaning", includedTasks: [{ taskId: "bathroom", displayName: "Bathroom" }], resultingTasks: [{ taskId: "bathroom", displayName: "Bathroom" }, { taskId: "balcony", displayName: "Balcony" }], taskId: "balcony", taskDisplayName: "Balcony", decisionState: "ADD_ON_APPROVAL_REQUIRED", durationDeltaMinutes: 25, priceDeltaMinor: 29900, currency: "INR", removableTaskIds: [], sourceKey: "source", sourceTitle: "Policy", sourceVersion: "v1" }, requestConfirmedByCustomer: true, requestConfirmedAt: now, commercialResponse: options.executed === false ? "DECLINE" : "APPROVE", respondedAt: now, bookingVersion: 1, decisionHash: "hash", sourceVersion: "v1", createdAt: now, updatedAt: now });
    if (options.executed !== false) await context.db.insert("actionExecutions", { tenantId, incidentId, decisionId, confirmationRequestId: confirmationId, connector: "DEMONSTRATION_CONNECTOR", actionType: "ADD_TASK", payload: { bookingKey: "DEMO-4821", taskId: "balcony", priceDeltaMinor: 29900, durationDeltaMinutes: 25 }, payloadHash: "payload", idempotencyKey: "key", status: "SUCCEEDED", attemptCount: 1, externalActionId: "ACT-1", priorBookingVersion: 1, resultingBookingVersion: 2, receipt: { actionExecutionId: "EXEC-1", connector: "DEMONSTRATION_CONNECTOR", idempotencyKey: "key", externalActionId: "ACT-1", requestHash: "payload", previousBookingVersion: 1, resultingBookingVersion: 2, actionType: "ADD_TASK", status: "SUCCEEDED", executedAt: now }, startedAt: now, completedAt: now, updatedAt: now });
  });
  return database;
}

describe("completion persistence", () => {
  it("stores one final-version summary and deterministic acknowledgement", async () => {
    const database = await setup();
    await expect(database.mutation(submit, { ...workerAccess, input: { bookingVersion: 2, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }, { taskId: "balcony", state: "COMPLETE" }] } })).resolves.toMatchObject({ kind: "SUBMITTED", verification: { state: "CANNOT_VERIFY" } });
    await expect(database.mutation(respond, { tokenHash, input: { response: "ACKNOWLEDGE" } })).resolves.toMatchObject({ kind: "RECORDED", verification: { state: "VERIFIED", reviewerRequired: false } });
    await expect(database.mutation(getForCustomer, { tokenHash })).resolves.toMatchObject({ kind: "RECORDED", verification: { state: "VERIFIED" } });
    await expect(database.mutation(get, workerAccess)).resolves.toMatchObject({ kind: "RECORDED", agreement: { bookingVersion: 2 } });
  });

  it("accepts preserved-original completion without inventing an action receipt", async () => {
    const database = await setup({ executed: false });
    await expect(database.mutation(submit, { ...workerAccess, input: { bookingVersion: 1, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }] } })).resolves.toMatchObject({ agreement: { bookingVersion: 1, receipt: null } });
    await expect(database.mutation(respond, { tokenHash, input: { response: "ACKNOWLEDGE" } })).resolves.toMatchObject({ verification: { state: "VERIFIED" } });
    expect(await database.run((context) => context.db.query("actionExecutions").collect())).toHaveLength(0);
  });

  it("rejects a customer response before the worker summary", async () => {
    const database = await setup();
    await expect(database.mutation(respond, { tokenHash, input: { response: "ACKNOWLEDGE" } })).rejects.toThrow("not available yet");
  });

  it("resolves a completion token within its owning non-demo tenant", async () => {
    const database = await setup({ tenantId: "tenant_two" });
    await expect(database.mutation(getForCustomer, { tokenHash })).resolves.toMatchObject({
      kind: "NOT_READY",
      agreement: { bookingKey: "DEMO-4821", bookingVersion: 2 },
    });
  });

  it("rejects unknown and malformed external payload fields at the Convex boundary", async () => {
    const database = await setup();
    await expect(database.mutation(submit, { ...workerAccess, input: { bookingVersion: 2, taskStates: [], invented: true } })).rejects.toThrow(/unexpected field|not in the validator/i);
    await expect(database.mutation(submit, { ...workerAccess, input: { bookingVersion: "2", taskStates: [] } })).rejects.toThrow(/number/i);
    await expect(database.mutation(respond, { tokenHash, input: { response: "YES" } })).rejects.toThrow(/union|literal/i);
    await expect(database.mutation(respond, { tokenHash, input: { response: "ACKNOWLEDGE", privateOutcome: "WORKER_FAILURE" } })).rejects.toThrow(/unexpected field|not in the validator/i);
  });

  it("rejects stale and incomplete final agreements", async () => {
    const database = await setup();
    await expect(database.mutation(submit, { ...workerAccess, input: { bookingVersion: 1, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }, { taskId: "balcony", state: "COMPLETE" }] } })).rejects.toThrow("stale booking version");
    await expect(database.mutation(submit, { ...workerAccess, input: { bookingVersion: 2, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }] } })).rejects.toThrow("exactly match");
  });

  it("is idempotent for identical submissions and rejects conflicting ones", async () => {
    const database = await setup();
    const input = { bookingVersion: 2, taskStates: [{ taskId: "bathroom", state: "COMPLETE" as const }, { taskId: "balcony", state: "COMPLETE" as const }], note: "Done" };
    const first = await database.mutation(submit, { ...workerAccess, input });
    expect(await database.mutation(submit, { ...workerAccess, input })).toEqual(first);
    await expect(database.mutation(submit, { ...workerAccess, input: { ...input, note: "Different" } })).rejects.toThrow("conflicts");
    expect(await database.run((context) => context.db.query("completionSummaries").collect())).toHaveLength(1);
  });

  it("is idempotent for identical customer responses and rejects conflicting ones", async () => {
    const database = await setup();
    await database.mutation(submit, { ...workerAccess, input: { bookingVersion: 2, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }, { taskId: "balcony", state: "COMPLETE" }] } });
    const first = await database.mutation(respond, { tokenHash, input: { response: "ACKNOWLEDGE", note: "Looks right" } });
    expect(await database.mutation(respond, { tokenHash, input: { response: "ACKNOWLEDGE", note: "Looks right" } })).toEqual(first);
    await expect(database.mutation(respond, { tokenHash, input: { response: "ACKNOWLEDGE", note: "Changed note" } })).rejects.toThrow("conflicts");
    await expect(database.mutation(respond, { tokenHash, input: { response: "RAISE_ISSUE" } })).rejects.toThrow("conflicts");
  });

  it("freezes readable final tasks and rejects a changed booking before response", async () => {
    const database = await setup();
    await database.mutation(submit, { ...workerAccess, input: { bookingVersion: 2, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }, { taskId: "balcony", state: "COMPLETE" }] } });
    await database.run(async (context) => {
      const tasks = await context.db.query("taskCatalog").collect();
      const balcony = tasks.find((task) => task.taskId === "balcony");
      const booking = await context.db.query("bookings").unique();
      if (!balcony || !booking) throw new Error("fixture missing");
      await context.db.patch(balcony._id, { displayName: "Changed label" });
      await context.db.patch(booking._id, { version: 3 });
    });
    await expect(database.mutation(getForCustomer, { tokenHash })).resolves.toMatchObject({ agreement: { bookingVersion: 2, tasks: [{ displayName: "Bathroom" }, { displayName: "Balcony" }] } });
    await expect(database.mutation(respond, { tokenHash, input: { response: "ACKNOWLEDGE" } })).rejects.toThrow("stale");
  });

  it("opens neutral review for a worker blocker", async () => {
    const database = await setup();
    await expect(database.mutation(submit, { ...workerAccess, input: { bookingVersion: 2, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }, { taskId: "balcony", state: "BLOCKED" }], note: "Access unavailable" } })).resolves.toMatchObject({ verification: { state: "REVIEW_REQUIRED", reviewerRequired: true } });
    expect(await database.run((context) => context.db.query("humanReviews").unique())).toMatchObject({ reviewType: "COMPLETION_BLOCKER", reasonCode: "WORKER_REPORTED_BLOCKER" });
    expect(await database.run((context) => context.db.query("incidents").unique())).toMatchObject({ status: "AWAITING_HUMAN_REVIEW" });
  });

  it("records a customer issue as disputed and opens human review", async () => {
    const database = await setup();
    await database.mutation(submit, { ...workerAccess, input: { bookingVersion: 2, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }, { taskId: "balcony", state: "COMPLETE" }] } });
    await expect(database.mutation(respond, { tokenHash, input: { response: "RAISE_ISSUE", note: "Balcony was not completed" } })).resolves.toMatchObject({ verification: { state: "DISPUTED", reviewerRequired: true } });
    expect(await database.run((context) => context.db.query("humanReviews").unique())).toMatchObject({ reviewType: "COMPLETION_DISPUTE" });
  });

  it("cannot verify when the required action receipt is missing", async () => {
    const database = await setup();
    await database.run(async (context) => {
      const execution = await context.db.query("actionExecutions").unique();
      if (!execution) throw new Error("fixture missing");
      await context.db.delete(execution._id);
    });
    await expect(database.mutation(submit, { ...workerAccess, input: { bookingVersion: 2, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }, { taskId: "balcony", state: "COMPLETE" }] } })).resolves.toMatchObject({ verification: { state: "CANNOT_VERIFY", reviewerRequired: true } });
    await expect(database.mutation(respond, { tokenHash, input: { response: "ACKNOWLEDGE" } })).rejects.toThrow("not awaiting");
  });

  it("cannot verify when the final task list differs from the approved agreement", async () => {
    const database = await setup();
    await database.run(async (context) => {
      const booking = await context.db.query("bookings").unique();
      if (!booking) throw new Error("fixture missing");
      await context.db.patch(booking._id, { includedTaskIds: ["balcony", "bathroom"] });
    });
    await expect(database.mutation(submit, {
      ...workerAccess,
      input: {
        bookingVersion: 2,
        taskStates: [
          { taskId: "balcony", state: "COMPLETE" },
          { taskId: "bathroom", state: "COMPLETE" },
        ],
      },
    })).resolves.toMatchObject({
      verification: { state: "CANNOT_VERIFY", reviewerRequired: true },
    });
  });

  it("keeps worker access bound to the owning run and stores ordered trace and evidence", async () => {
    const database = await setup();
    await expect(database.mutation(get, { ...workerAccess, browserTokenHash: "c".repeat(64) })).resolves.toBeNull();
    await database.mutation(submit, { ...workerAccess, input: { bookingVersion: 2, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }, { taskId: "balcony", state: "COMPLETE" }] } });
    await database.mutation(respond, { tokenHash, input: { response: "ACKNOWLEDGE" } });
    const events = await database.run((context) => context.db.query("verificationEvents").collect());
    expect(events.map(({ actor, state }) => ({ actor, state }))).toEqual([{ actor: "WORKER", state: "CANNOT_VERIFY" }, { actor: "CUSTOMER", state: "VERIFIED" }]);
    expect(events[1]).toMatchObject({ criteriaVersion: "taskconfirm-verification-v1", bookingVersion: 2, evidence: { receiptRequired: true, receiptMatches: true, customerResponse: "ACKNOWLEDGE" } });
    const trace = await database.run((context) => context.db.query("traceSteps").collect());
    expect(trace.map((step) => step.stage)).toEqual(["completion_submitted", "verification_completed"]);
    expect(trace.map((step) => step.sequence)).toEqual([1, 2]);
  });
});
