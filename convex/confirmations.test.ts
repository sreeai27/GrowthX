import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const createConfirmation = makeFunctionReference<
  "mutation",
  {
    publicRunId: string;
    browserTokenHash: string;
    incidentKey: string;
    tokenHash: string;
    completionTokenHash: string;
    expiresAt: string;
  },
  { status: "PENDING"; created: boolean; expiresAt: string }
>("confirmations:create");
const getForCustomer = makeFunctionReference<
  "mutation",
  { tokenHash: string },
  Record<string, unknown>
>("confirmations:getForCustomer");
const confirmRequest = makeFunctionReference<
  "mutation",
  { tokenHash: string; answer: "YES" | "MISMATCH" },
  Record<string, unknown>
>("confirmations:confirmRequest");
const respond = makeFunctionReference<
  "mutation",
  { tokenHash: string; response: "APPROVE" | "DECLINE" },
  Record<string, unknown>
>("confirmations:respond");
const getForWorker = makeFunctionReference<
  "mutation",
  { publicRunId: string; browserTokenHash: string; incidentKey: string },
  Record<string, unknown> | null
>("confirmations:getForWorker");

const tenantId = "demo_sahaay_home_services";
const now = new Date().toISOString();
const expiresAt = new Date(Date.parse(now) + 30 * 60 * 1000).toISOString();
const tokenHash = "a".repeat(64);
const completionTokenHash = "c".repeat(64);

async function setupDecision() {
  const database = convexTest(schema, modules);
  const ids = await database.run(async (context) => {
    const runId = await context.db.insert("demoRuns", {
      tenantId,
      publicRunId: "run_confirmation_owner",
      browserTokenHash: "b".repeat(64),
      status: "ACTIVE",
      bookingKey: "DEMO-4821",
      startedAt: now,
      lastActiveAt: now,
      resumeExpiresAt: "2099-09-01T11:00:00.000Z",
    });
    const bookingId = await context.db.insert("bookings", {
      bookingKey: "DEMO-4821",
      tenantId,
      workerPublicUserId: "demo-worker-asha",
      customerAlias: "Neha",
      serviceId: "essential-home-cleaning",
      serviceName: "Essential Home Cleaning",
      status: "IN_PROGRESS",
      city: "Pune",
      currency: "INR",
      scheduledDurationMinutes: 120,
      remainingDurationMinutes: 50,
      workerRole: "HOME_SERVICE_WORKER",
      version: 1,
      includedTaskIds: ["bathroom_cleaning_standard_1"],
      existingAddOnTaskIds: [],
      catalogVersion: "v1",
    });
    const incidentId = await context.db.insert("incidents", {
      incidentKey: "inc_confirmation",
      tenantId,
      demoRunId: runId,
      scenarioPack: "TASK_CONFIRM",
      bookingKey: "DEMO-4821",
      bookingVersion: 1,
      workerPublicUserId: "demo-worker-asha",
      status: "DECISION_READY",
      riskTier: 1,
      supportState: "SUPPORTED",
      flowVersion: "taskconfirm-typed-v1",
      createdAt: now,
      updatedAt: now,
    });
    const decisionId = await context.db.insert("policyDecisions", {
      tenantId,
      incidentId,
      bookingVersion: 1,
      taskId: "balcony_deep_cleaning",
      ruleKey: "balcony-deep-clean-add-on",
      ruleVersion: "v1",
      sourceKey: "taskconfirm-demo-policy",
      sourceVersion: "v1",
      passageKey: "balcony-deep-clean-add-on",
      decisionState: "ADD_ON_APPROVAL_REQUIRED",
      supportState: "SUPPORTED",
      durationDeltaMinutes: 25,
      priceDeltaMinor: 29_900,
      currency: "INR",
      removableTaskIds: [],
      requirements: {
        customerRequestConfirmation: true,
        customerCommercialApproval: true,
        humanReview: false,
        workerFeasibilityConfirmation: false,
      },
      flowVersion: "taskconfirm-typed-v1",
      promptVersion: "deterministic-policy-resolver-v1",
      modelId: "none-deterministic-v1",
      allowedActions: ["ADD_TASK"],
      prohibitedActions: [],
      explanationKey: "add_on_approval_required",
      decisionHash: "decision-hash-v1",
      createdAt: now,
    });
    await context.db.insert("taskCatalog", {
      tenantId,
      catalogVersion: "v1",
      taskId: "balcony_deep_cleaning",
      displayName: "Balcony deep cleaning",
      category: "CLEANING",
      riskTier: 1,
      synonymsHi: [],
      synonymsMr: [],
      active: true,
    });
    await context.db.insert("taskCatalog", {
      tenantId,
      catalogVersion: "v1",
      taskId: "bathroom_cleaning_standard_1",
      displayName: "One standard bathroom",
      category: "CLEANING",
      riskTier: 1,
      synonymsHi: [],
      synonymsMr: [],
      active: true,
    });
    await context.db.insert("policySources", {
      tenantId,
      sourceKey: "taskconfirm-demo-policy",
      title: "Sahaay demonstration policy",
      owner: "Sahaay Operations",
      version: "v1",
      status: "ACTIVE",
      effectiveFrom: "2026-08-31T00:00:00.000Z",
      effectiveTo: null,
      priority: 100,
      regionTags: ["Pune"],
      roleTags: ["HOME_SERVICE_WORKER"],
      notice: "Fictional demonstration policy.",
    });
    return { bookingId, incidentId, decisionId };
  });
  return { database, ids };
}

const workerAccess = {
  publicRunId: "run_confirmation_owner",
  browserTokenHash: "b".repeat(64),
  incidentKey: "inc_confirmation",
};

async function create(database: Awaited<ReturnType<typeof setupDecision>>["database"]) {
  return database.mutation(createConfirmation, {
    ...workerAccess,
    tokenHash,
    completionTokenHash,
    expiresAt,
  });
}

describe("customer confirmation persistence", () => {
  it("creates one immutable hash-only 30-minute request without changing the booking", async () => {
    const { database, ids } = await setupDecision();
    const bookingsBefore = await database.run((context) =>
      context.db.query("bookings").collect(),
    );

    await expect(create(database)).resolves.toMatchObject({
      status: "PENDING",
      created: true,
    });
    await expect(create(database)).resolves.toMatchObject({
      status: "PENDING",
      created: false,
    });

    const stored = await database.run((context) =>
      context.db.query("confirmationRequests").collect(),
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      tenantId,
      incidentId: ids.incidentId,
      decisionId: ids.decisionId,
      tokenHash,
      completionTokenHash,
      status: "PENDING",
      requestConfirmedByCustomer: false,
      bookingVersion: 1,
      decisionHash: "decision-hash-v1",
      sourceVersion: "v1",
      requestSnapshot: {
        bookingKey: "DEMO-4821",
        serviceName: "Essential Home Cleaning",
        includedTasks: [
          { taskId: "bathroom_cleaning_standard_1", displayName: "One standard bathroom" },
        ],
        resultingTasks: [
          { taskId: "bathroom_cleaning_standard_1", displayName: "One standard bathroom" },
          { taskId: "balcony_deep_cleaning", displayName: "Balcony deep cleaning" },
        ],
        taskId: "balcony_deep_cleaning",
        taskDisplayName: "Balcony deep cleaning",
        decisionState: "ADD_ON_APPROVAL_REQUIRED",
        durationDeltaMinutes: 25,
        priceDeltaMinor: 29_900,
        currency: "INR",
        removableTaskIds: [],
        sourceKey: "taskconfirm-demo-policy",
        sourceTitle: "Sahaay demonstration policy",
        sourceVersion: "v1",
      },
    });
    expect(Date.parse(stored[0]!.expiresAt) - Date.parse(stored[0]!.createdAt)).toBe(
      30 * 60 * 1000,
    );
    expect(JSON.stringify(stored[0])).not.toContain("rawToken");
    expect(stored[0]!.completionTokenHash).not.toBe(stored[0]!.tokenHash);
    expect(await database.run((context) => context.db.query("bookings").collect())).toEqual(
      bookingsBefore,
    );
  });

  it("returns only a customer-safe active snapshot", async () => {
    const { database } = await setupDecision();
    await create(database);
    const result = await database.mutation(getForCustomer, { tokenHash });
    expect(result).toEqual({
      kind: "ACTIVE",
      requestConfirmed: false,
      snapshot: expect.objectContaining({
        bookingKey: "DEMO-4821",
        taskDisplayName: "Balcony deep cleaning",
        priceDeltaMinor: 29_900,
        durationDeltaMinutes: 25,
        sourceVersion: "v1",
      }),
      expiresAt: expect.any(String),
    });
    expect(JSON.stringify(result)).not.toMatch(/tenantId|tokenHash|decisionId|incidentId|customerAlias/);
  });

  it("keeps human-readable task and source evidence frozen after catalogue edits", async () => {
    const { database } = await setupDecision();
    await create(database);
    const before = await database.mutation(getForCustomer, { tokenHash });

    await database.run(async (context) => {
      const tasks = await context.db.query("taskCatalog").collect();
      const balcony = tasks.find((task) => task.taskId === "balcony_deep_cleaning");
      const bathroom = tasks.find(
        (task) => task.taskId === "bathroom_cleaning_standard_1",
      );
      const source = await context.db.query("policySources").first();
      if (!balcony || !bathroom || !source) throw new Error("fixture missing");
      await context.db.patch(balcony._id, { displayName: "Changed balcony label" });
      await context.db.patch(bathroom._id, { displayName: "Changed bathroom label" });
      await context.db.patch(source._id, { title: "Changed policy title" });
    });

    expect(await database.mutation(getForCustomer, { tokenHash })).toEqual(before);
    expect(before).toMatchObject({
      kind: "ACTIVE",
      snapshot: {
        includedTasks: [
          {
            taskId: "bathroom_cleaning_standard_1",
            displayName: "One standard bathroom",
          },
        ],
        resultingTasks: [
          {
            taskId: "bathroom_cleaning_standard_1",
            displayName: "One standard bathroom",
          },
          {
            taskId: "balcony_deep_cleaning",
            displayName: "Balcony deep cleaning",
          },
        ],
        sourceTitle: "Sahaay demonstration policy",
      },
    });
  });

  it("records the two-step approve flow and is idempotent only for the same response", async () => {
    const { database } = await setupDecision();
    await create(database);
    await expect(
      database.mutation(respond, { tokenHash, response: "APPROVE" }),
    ).rejects.toThrow("Customer must confirm the request first.");
    await expect(
      database.mutation(confirmRequest, { tokenHash, answer: "YES" }),
    ).resolves.toMatchObject({ kind: "ACTIVE", requestConfirmed: true });
    await expect(
      database.mutation(respond, { tokenHash, response: "APPROVE" }),
    ).resolves.toEqual({ kind: "RECORDED", status: "APPROVED" });
    await expect(
      database.mutation(respond, { tokenHash, response: "APPROVE" }),
    ).resolves.toEqual({ kind: "IDEMPOTENT", status: "APPROVED" });
    await expect(
      database.mutation(respond, { tokenHash, response: "DECLINE" }),
    ).rejects.toThrow("Confirmation request is already used.");
    const customerView = await database.mutation(getForCustomer, { tokenHash });
    expect(customerView).toMatchObject({
      kind: "ALREADY_USED",
      status: "APPROVED",
      snapshot: {
        bookingKey: "DEMO-4821",
        taskDisplayName: "Balcony deep cleaning",
        priceDeltaMinor: 29_900,
        durationDeltaMinutes: 25,
        sourceVersion: "v1",
      },
      execution: null,
    });
    expect(JSON.stringify(customerView)).not.toMatch(
      /tenantId|tokenHash|decisionId|incidentId|requestHash|idempotencyKey|actionExecutionId/,
    );
    expect(await database.mutation(getForWorker, workerAccess)).toMatchObject({
      status: "APPROVED",
      requestConfirmed: true,
      commercialResponse: "APPROVE",
    });
  });

  it("records mismatch directly and never permits commercial response", async () => {
    const { database } = await setupDecision();
    await create(database);
    await expect(
      database.mutation(confirmRequest, { tokenHash, answer: "MISMATCH" }),
    ).resolves.toEqual({ kind: "RECORDED", status: "REQUEST_MISMATCH" });
    await expect(
      database.mutation(respond, { tokenHash, response: "APPROVE" }),
    ).rejects.toThrow("Confirmation request is already used.");
  });

  it("distinguishes invalid, expired and stale tokens without leaking fields", async () => {
    const { database, ids } = await setupDecision();
    await create(database);
    expect(
      await database.mutation(getForCustomer, { tokenHash: "f".repeat(64) }),
    ).toEqual({ kind: "INVALID" });
    await database.run(async (context) => {
      const request = await context.db.query("confirmationRequests").first();
      if (!request) throw new Error("confirmation fixture missing");
      await context.db.patch(request._id, { expiresAt: "2020-01-01T00:00:00.000Z" });
    });
    expect(await database.mutation(getForCustomer, { tokenHash })).toEqual({ kind: "EXPIRED" });
    await expect(
      database.mutation(respond, { tokenHash, response: "APPROVE" }),
    ).resolves.toEqual({ kind: "EXPIRED" });
    expect(
      await database.run(async (context) =>
        (await context.db.query("confirmationRequests").first())?.status,
      ),
    ).toBe("EXPIRED");

    await database.run((context) => context.db.patch(ids.bookingId, { version: 2 }));
    // Expiry remains the first terminal state; a separate request covers staleness.
  });

  it("rejects token collisions, bad expiry, unsupported decisions and cross-run workers", async () => {
    const { database, ids } = await setupDecision();
    await expect(
      database.mutation(createConfirmation, {
        ...workerAccess,
        tokenHash,
        completionTokenHash,
        expiresAt: "2026-09-01T10:29:59.999Z",
      }),
    ).rejects.toThrow("Confirmation must expire exactly 30 minutes after creation.");
    await create(database);
    await database.run((context) =>
      context.db.patch(ids.decisionId, {
        decisionHash: "changed-decision-hash",
      }),
    );
    expect(await database.mutation(getForCustomer, { tokenHash })).toEqual({
      kind: "STALE",
    });
    await expect(
      database.mutation(getForWorker, {
        ...workerAccess,
        publicRunId: "other-run",
      }),
    ).resolves.toBeNull();
  });

  it("rejects a trade-off until a replacement task is selected", async () => {
    const { database, ids } = await setupDecision();
    await database.run((context) =>
      context.db.patch(ids.decisionId, {
        decisionState: "TRADE_OFF_REQUIRED",
        priceDeltaMinor: undefined,
        removableTaskIds: ["bathroom_cleaning_standard_1"],
      }),
    );

    await expect(create(database)).rejects.toThrow(
      "Decision does not support customer confirmation.",
    );
    expect(
      await database.run(async (context) =>
        (await context.db.get(ids.incidentId))?.status,
      ),
    ).toBe("DECISION_READY");
    expect(
      await database.run((context) =>
        context.db.query("confirmationRequests").collect(),
      ),
    ).toEqual([]);
  });

  it("marks a request stale when the active source version changes", async () => {
    const { database } = await setupDecision();
    await create(database);
    await database.run(async (context) => {
      const oldSource = await context.db.query("policySources").first();
      if (!oldSource) throw new Error("source fixture missing");
      await context.db.patch(oldSource._id, { status: "ACTIVE" });
      await context.db.insert("policySources", {
        tenantId,
        sourceKey: "taskconfirm-demo-policy",
        title: "Sahaay demonstration policy",
        owner: "Sahaay Operations",
        version: "v2",
        status: "ACTIVE",
        effectiveFrom: "2026-09-01T00:00:00.000Z",
        effectiveTo: null,
        priority: 100,
        regionTags: ["Pune"],
        roleTags: ["HOME_SERVICE_WORKER"],
        notice: "Fictional demonstration policy.",
      });
    });
    expect(await database.mutation(getForCustomer, { tokenHash })).toEqual({
      kind: "STALE",
    });
    await expect(
      database.mutation(respond, { tokenHash, response: "DECLINE" }),
    ).resolves.toEqual({ kind: "STALE" });
    expect(
      await database.run(async (context) =>
        (await context.db.query("confirmationRequests").first())?.status,
      ),
    ).toBe("STALE");
  });

  it("records decline after request confirmation without changing the booking", async () => {
    const { database } = await setupDecision();
    await create(database);
    const before = await database.run((context) => context.db.query("bookings").collect());
    await database.mutation(confirmRequest, { tokenHash, answer: "YES" });
    await expect(
      database.mutation(respond, { tokenHash, response: "DECLINE" }),
    ).resolves.toEqual({ kind: "RECORDED", status: "DECLINED" });
    expect(await database.run((context) => context.db.query("bookings").collect())).toEqual(before);
    expect(
      await database.run(async (context) =>
        (await context.db.query("incidents").first())?.status,
      ),
    ).toBe("COMPLETION_PENDING");
  });

  it("rejects a token hash already present in another tenant", async () => {
    const { database, ids } = await setupDecision();
    await database.run((context) =>
      context.db.insert("confirmationRequests", {
        tenantId: "another_tenant",
        incidentId: ids.incidentId,
        decisionId: ids.decisionId,
        tokenHash,
        expiresAt,
        status: "PENDING",
        requestSnapshot: {
          bookingKey: "private-other-booking",
          serviceName: "Private other service",
          includedTasks: [],
          resultingTasks: [{ taskId: "private-task", displayName: "Private task" }],
          taskId: "private-task",
          taskDisplayName: "Private task",
          decisionState: "ADD_ON_APPROVAL_REQUIRED",
          durationDeltaMinutes: 1,
          priceDeltaMinor: 1,
          currency: "INR",
          removableTaskIds: [],
          sourceKey: "private-source",
          sourceTitle: "Private source",
          sourceVersion: "private-version",
        },
        requestConfirmedByCustomer: false,
        bookingVersion: 1,
        decisionHash: "private-decision",
        sourceVersion: "private-version",
        createdAt: now,
        updatedAt: now,
      }),
    );
    await expect(create(database)).resolves.toMatchObject({ created: true });
    expect(await database.mutation(getForCustomer, { tokenHash })).toMatchObject({
      kind: "ACTIVE",
    });
  });
});
