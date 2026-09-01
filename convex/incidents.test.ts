import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const seedDemo = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { inserted: boolean }
>("seed:seedDemo");
const startTaskConfirm = makeFunctionReference<
  "mutation",
  {
    publicRunId: string;
    browserTokenHash: string;
    incidentKey: string;
  },
  { incidentKey: string; bookingKey: string; status: "DRAFT" }
>("incidents:startTaskConfirm");
const captureRequest = makeFunctionReference<
  "mutation",
  {
    publicRunId: string;
    browserTokenHash: string;
    incidentKey: string;
    input:
      | { modality: "TEXT"; text: string }
      | { modality: "PRESET"; presetKey: string };
  },
  { status: "TRANSCRIPT_READY" }
>("incidents:captureRequest");
const confirmTranscript = makeFunctionReference<
  "mutation",
  {
    publicRunId: string;
    browserTokenHash: string;
    incidentKey: string;
    confirmedText: string;
  },
  { status: "TRANSCRIPT_CONFIRMED" }
>("incidents:confirmTranscript");
const getWorkerIncident = makeFunctionReference<
  "query",
  { publicRunId: string; browserTokenHash: string; incidentKey: string },
  {
    status: string;
    originalText: string | null;
    confirmedText: string | null;
    wasEdited: boolean | null;
  } | null
>("incidents:getWorkerIncident");
const prepareTaskCandidates = makeFunctionReference<
  "mutation",
  { publicRunId: string; browserTokenHash: string; incidentKey: string },
  {
    status: "TASK_CONFIRMATION_REQUIRED" | "AWAITING_HUMAN_REVIEW";
    candidates: Array<{ taskId: string; displayName: string }>;
  }
>("incidents:prepareTaskCandidates");
const confirmTask = makeFunctionReference<
  "mutation",
  {
    publicRunId: string;
    browserTokenHash: string;
    incidentKey: string;
    selectedTaskId: string;
  },
  { status: "TASK_CONFIRMED"; selectedTaskId: string }
>("incidents:confirmTask");
const reviseTranscript = makeFunctionReference<
  "mutation",
  { publicRunId: string; browserTokenHash: string; incidentKey: string },
  { status: "TRANSCRIPT_READY" }
>("incidents:reviseTranscript");
const requestTaskReview = makeFunctionReference<
  "mutation",
  { publicRunId: string; browserTokenHash: string; incidentKey: string },
  { status: "AWAITING_HUMAN_REVIEW" }
>("incidents:requestTaskReview");
const retryInput = makeFunctionReference<
  "mutation",
  { publicRunId: string; browserTokenHash: string; incidentKey: string },
  { status: "DRAFT" }
>("incidents:retryInput");
const resolvePolicyDecision = makeFunctionReference<
  "mutation",
  { publicRunId: string; browserTokenHash: string; incidentKey: string },
  {
    status: "DECISION_READY" | "AWAITING_HUMAN_REVIEW";
    supportState: string;
    decisionState?: string;
    taskId: string;
    decisionHash: string;
  }
>("policyDecisions:resolvePolicyDecision");
const getPolicyDecision = makeFunctionReference<
  "query",
  { publicRunId: string; browserTokenHash: string; incidentKey: string },
  {
    booking: {
      bookingVersion: number;
      serviceName: string;
      includedTasks: Array<{ taskId: string }>;
    };
    selectedTask: { taskId: string; displayName: string };
    outcome: {
      supportState: string;
      decisionState?: string;
      durationDeltaMinutes?: number;
      priceDeltaMinor?: number;
    };
    authority: null | {
      title: string;
      version: string;
      effectiveFrom: string;
      notice: string;
      passage: null | { passageKey: string; text: string };
    };
  } | null
>("policyDecisions:getPolicyDecision");

async function createActiveRun(
  database: ReturnType<typeof convexTest>,
  publicRunId = "run_incident_owner",
  tokenHash = "a".repeat(64),
) {
  await database.mutation(seedDemo, {});
  await database.run((context) =>
    context.db.insert("demoRuns", {
      tenantId: "demo_sahaay_home_services",
      publicRunId,
      browserTokenHash: tokenHash,
      status: "ACTIVE",
      bookingKey: "DEMO-4821",
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      resumeExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    }),
  );
}

async function confirmSelectedTask(
  database: ReturnType<typeof convexTest>,
  incidentKey: string,
  request: string,
  taskId: string,
) {
  const access = {
    publicRunId: "run_incident_owner",
    browserTokenHash: "a".repeat(64),
    incidentKey,
  };
  await database.mutation(startTaskConfirm, access);
  await database.mutation(captureRequest, {
    ...access,
    input: { modality: "TEXT", text: request },
  });
  await database.mutation(confirmTranscript, {
    ...access,
    confirmedText: request,
  });
  await database.mutation(prepareTaskCandidates, access);
  await database.mutation(confirmTask, { ...access, selectedTaskId: taskId });
  return access;
}

async function insertConfirmedTask(
  database: ReturnType<typeof convexTest>,
  incidentKey: string,
  taskId: string,
) {
  const access = {
    publicRunId: "run_incident_owner",
    browserTokenHash: "a".repeat(64),
    incidentKey,
  };
  await database.run(async (context) => {
    const run = await context.db.query("demoRuns").first();
    if (!run) throw new Error("run fixture missing");
    const now = new Date().toISOString();
    const incidentId = await context.db.insert("incidents", {
      incidentKey,
      tenantId: "demo_sahaay_home_services",
      demoRunId: run._id,
      scenarioPack: "TASK_CONFIRM",
      bookingKey: "DEMO-4821",
      bookingVersion: 1,
      workerPublicUserId: "demo-worker-asha",
      status: "TASK_CONFIRMED",
      riskTier: 1,
      supportState: "PENDING",
      flowVersion: "taskconfirm-typed-v1",
      createdAt: now,
      updatedAt: now,
    });
    const mediaInputId = await context.db.insert("mediaInputs", {
      tenantId: "demo_sahaay_home_services",
      incidentId,
      modality: "TEXT",
      capturePurpose: "CUSTOMER_REQUESTED_CHANGE",
      consentBasis: "WORKER_INITIATED_REPORT",
      qualityState: "USABLE",
      createdAt: now,
    });
    const transcriptId = await context.db.insert("transcripts", {
      tenantId: "demo_sahaay_home_services",
      incidentId,
      mediaInputId,
      provider: "TYPED_OR_REVIEWED_PRESET",
      providerModel: "deterministic-input-v1",
      mode: "TEXT",
      detectedLanguages: [],
      rawTranscript: taskId,
      inputQualityState: "USABLE",
      createdAt: now,
    });
    const confirmedTranscriptId = await context.db.insert(
      "transcriptConfirmations",
      {
        tenantId: "demo_sahaay_home_services",
        incidentId,
        transcriptId,
        confirmedBy: "demo-worker-asha",
        originalText: taskId,
        confirmedText: taskId,
        wasEdited: false,
        editSummary: "No edits",
        confirmedAt: now,
      },
    );
    const interpretationId = await context.db.insert(
      "exceptionInterpretations",
      {
        tenantId: "demo_sahaay_home_services",
        incidentId,
        confirmedTranscriptId,
        flowVersion: "taskconfirm-typed-v1",
        promptVersion: "fixture-v1",
        modelId: "deterministic-fixture-v1",
        reportedRequest: taskId,
        summary: "Test fixture confirmed task.",
        candidateTasks: [
          { taskId, displayName: taskId, matchReason: "fixture" },
        ],
        shouldAbstain: false,
        createdAt: now,
      },
    );
    await context.db.insert("taskConfirmations", {
      tenantId: "demo_sahaay_home_services",
      incidentId,
      interpretationId,
      selectedTaskId: taskId,
      confirmedByWorker: "demo-worker-asha",
      confirmedAt: now,
    });
  });
  return access;
}

describe("TaskConfirm incidents", () => {
  it("persists the balcony add-on decision without changing the booking", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = await confirmSelectedTask(
      database,
      "inc_policy_balcony",
      "Balcony deep cleaning",
      "balcony_deep_cleaning",
    );
    const before = await database.run((context) =>
      context.db.query("bookings").collect(),
    );

    await expect(
      database.mutation(resolvePolicyDecision, access),
    ).resolves.toMatchObject({
      status: "DECISION_READY",
      supportState: "SUPPORTED",
      decisionState: "ADD_ON_APPROVAL_REQUIRED",
      taskId: "balcony_deep_cleaning",
    });
    const snapshot = await database.run(async (context) => ({
      bookings: await context.db.query("bookings").collect(),
      decisions: await context.db.query("policyDecisions").collect(),
      traces: await context.db.query("traceSteps").collect(),
    }));
    expect(snapshot.bookings).toEqual(before);
    expect(snapshot.decisions).toEqual([
      expect.objectContaining({
        bookingVersion: 1,
        ruleKey: "balcony-deep-clean-add-on",
        ruleVersion: "v1",
        sourceKey: "taskconfirm-demo-policy",
        sourceVersion: "v1",
        passageKey: "balcony-deep-clean-add-on",
        durationDeltaMinutes: 25,
        priceDeltaMinor: 29_900,
      }),
    ]);
    expect(snapshot.traces.at(-1)).toMatchObject({
      stage: "policy_resolved",
      sourceIds: ["taskconfirm-demo-policy:v1", "balcony-deep-clean-add-on:v1"],
      flowVersion: "taskconfirm-typed-v1",
      metadata: { bookingVersion: 1 },
    });
    await expect(
      database.query(getPolicyDecision, access),
    ).resolves.toMatchObject({
      booking: {
        bookingVersion: 1,
        serviceName: "Essential Home Cleaning",
        includedTasks: expect.arrayContaining([
          expect.objectContaining({ taskId: "bathroom_cleaning_standard_1" }),
        ]),
      },
      selectedTask: {
        taskId: "balcony_deep_cleaning",
        displayName: "Balcony deep cleaning",
      },
      outcome: {
        supportState: "SUPPORTED",
        decisionState: "ADD_ON_APPROVAL_REQUIRED",
        durationDeltaMinutes: 25,
        priceDeltaMinor: 29_900,
      },
      authority: {
        title: "Sahaay Home Services Demonstration Task and Add-on Policy",
        version: "v1",
        effectiveFrom: "2026-08-31T00:00:00.000Z",
        notice: "Fictional demonstration policy; not a real operator policy.",
        passage: expect.objectContaining({
          passageKey: "balcony-deep-clean-add-on",
          text: expect.stringContaining("25 minutes"),
        }),
      },
    });
  });

  it.each([
    ["bathroom_cleaning_standard_1", "INCLUDED_CONTINUE", "DECISION_READY"],
    ["balcony_deep_cleaning", "ADD_ON_APPROVAL_REQUIRED", "DECISION_READY"],
    ["inside_cabinet_cleaning", "TRADE_OFF_REQUIRED", "DECISION_READY"],
    ["wardrobe_assembly", "NOT_SUPPORTED", "DECISION_READY"],
    [
      "exposed_live_wire_response",
      "SAFETY_ESCALATION",
      "AWAITING_HUMAN_REVIEW",
    ],
  ])(
    "resolves confirmed task %s as %s",
    async (taskId, decisionState, status) => {
      const database = convexTest(schema, modules);
      await createActiveRun(database);
      const access = await insertConfirmedTask(
        database,
        `inc_state_${taskId}`,
        taskId,
      );
      await expect(
        database.mutation(resolvePolicyDecision, access),
      ).resolves.toMatchObject({
        status,
        decisionState,
        taskId,
      });
    },
  );

  it("persists one idempotent decision and denies another active run", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = await insertConfirmedTask(
      database,
      "inc_policy_private",
      "balcony_deep_cleaning",
    );
    const first = await database.mutation(resolvePolicyDecision, access);
    expect(await database.mutation(resolvePolicyDecision, access)).toEqual(
      first,
    );
    await createActiveRun(database, "run_other_visitor", "b".repeat(64));
    await expect(
      database.query(getPolicyDecision, {
        ...access,
        publicRunId: "run_other_visitor",
        browserTokenHash: "b".repeat(64),
      }),
    ).resolves.toBeNull();
    const counts = await database.run(async (context) => ({
      decisions: (await context.db.query("policyDecisions").collect()).length,
      policyTraces: (await context.db.query("traceSteps").collect()).filter(
        (step) => step.stage === "policy_resolved",
      ).length,
    }));
    expect(counts).toEqual({ decisions: 1, policyTraces: 1 });
  });

  it("abstains on equal-precedence conflicting rules", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = await insertConfirmedTask(
      database,
      "inc_policy_conflict",
      "balcony_deep_cleaning",
    );
    await database.run(async (context) => {
      const original = (await context.db.query("policyRules").collect()).find(
        (rule) => rule.taskId === "balcony_deep_cleaning",
      );
      if (!original) throw new Error("policy rule fixture missing");
      const {
        _id: ignoredId,
        _creationTime: ignoredCreationTime,
        ...copy
      } = original;
      void ignoredId;
      void ignoredCreationTime;
      await context.db.insert("policyRules", {
        ...copy,
        ruleKey: "balcony-conflicting-rule",
        decisionState: "NOT_SUPPORTED",
        durationDeltaMinutes: 0,
        priceDeltaMinor: 0,
      });
    });
    await expect(
      database.mutation(resolvePolicyDecision, access),
    ).resolves.toMatchObject({
      status: "AWAITING_HUMAN_REVIEW",
      supportState: "SOURCE_CONFLICT",
      taskId: "balcony_deep_cleaning",
    });
    const decision = await database.query(getPolicyDecision, access);
    expect(decision).toMatchObject({
      outcome: { supportState: "SOURCE_CONFLICT" },
      authority: null,
    });
  });

  it("rejects policy resolution before task confirmation", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = {
      publicRunId: "run_incident_owner",
      browserTokenHash: "a".repeat(64),
      incidentKey: "inc_policy_too_early",
    };
    await database.mutation(startTaskConfirm, access);
    await expect(
      database.mutation(resolvePolicyDecision, access),
    ).rejects.toThrow("Cannot apply RESOLVE_POLICY while incident is DRAFT.");
  });
  it("starts from the active seeded booking without changing it", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const before = await database.run((context) =>
      context.db.query("bookings").collect(),
    );

    await expect(
      database.mutation(startTaskConfirm, {
        publicRunId: "run_incident_owner",
        browserTokenHash: "a".repeat(64),
        incidentKey: "inc_demo_123",
      }),
    ).resolves.toEqual({
      incidentKey: "inc_demo_123",
      bookingKey: "DEMO-4821",
      status: "DRAFT",
    });

    const after = await database.run((context) =>
      context.db.query("bookings").collect(),
    );
    expect(after).toEqual(before);
  });

  it("persists typed wording across reads and retains edits after explicit confirmation", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = {
      publicRunId: "run_incident_owner",
      browserTokenHash: "a".repeat(64),
      incidentKey: "inc_demo_123",
    };
    await database.mutation(startTaskConfirm, access);

    await expect(
      database.mutation(captureRequest, {
        ...access,
        input: {
          modality: "TEXT",
          text: "  Balcony ko deep clean karna hai  ",
        },
      }),
    ).resolves.toEqual({ status: "TRANSCRIPT_READY" });
    expect(await database.query(getWorkerIncident, access)).toMatchObject({
      status: "TRANSCRIPT_READY",
      originalText: "Balcony ko deep clean karna hai",
      confirmedText: null,
    });

    await expect(
      database.mutation(confirmTranscript, {
        ...access,
        confirmedText: "Balcony ko achchhe se deep clean karna hai",
      }),
    ).resolves.toEqual({ status: "TRANSCRIPT_CONFIRMED" });
    expect(await database.query(getWorkerIncident, access)).toMatchObject({
      status: "TRANSCRIPT_CONFIRMED",
      originalText: "Balcony ko deep clean karna hai",
      confirmedText: "Balcony ko achchhe se deep clean karna hai",
      wasEdited: true,
    });
  });

  it("offers bounded catalogue candidates and rejects a task that was not offered", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = {
      publicRunId: "run_incident_owner",
      browserTokenHash: "a".repeat(64),
      incidentKey: "inc_demo_123",
    };
    await database.mutation(startTaskConfirm, access);
    await database.mutation(captureRequest, {
      ...access,
      input: { modality: "TEXT", text: "Balcony ko deep clean karna hai" },
    });
    await database.mutation(confirmTranscript, {
      ...access,
      confirmedText: "Balcony ko deep clean karna hai",
    });

    const offered = await database.mutation(prepareTaskCandidates, access);
    expect(offered).toEqual({
      status: "TASK_CONFIRMATION_REQUIRED",
      candidates: [
        {
          taskId: "balcony_deep_cleaning",
          displayName: "Balcony deep cleaning",
        },
      ],
    });
    await expect(
      database.mutation(confirmTask, {
        ...access,
        selectedTaskId: "wardrobe_assembly",
      }),
    ).rejects.toThrow("Selected task was not offered for this request.");
    await expect(
      database.mutation(confirmTask, {
        ...access,
        selectedTaskId: "balcony_deep_cleaning",
      }),
    ).resolves.toEqual({
      status: "TASK_CONFIRMED",
      selectedTaskId: "balcony_deep_cleaning",
    });
  });

  it("routes an unmatched confirmed request to safe review", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = {
      publicRunId: "run_incident_owner",
      browserTokenHash: "a".repeat(64),
      incidentKey: "inc_unmatched_123",
    };
    await database.mutation(startTaskConfirm, access);
    await database.mutation(captureRequest, {
      ...access,
      input: { modality: "TEXT", text: "Please polish the antique piano" },
    });
    await database.mutation(confirmTranscript, {
      ...access,
      confirmedText: "Please polish the antique piano",
    });

    await expect(
      database.mutation(prepareTaskCandidates, access),
    ).resolves.toEqual({
      status: "AWAITING_HUMAN_REVIEW",
      candidates: [],
    });
  });

  it("resolves reviewed preset keys server-side and rejects unknown presets", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = {
      publicRunId: "run_incident_owner",
      browserTokenHash: "a".repeat(64),
      incidentKey: "inc_preset_123",
    };
    await database.mutation(startTaskConfirm, access);
    await database.mutation(captureRequest, {
      ...access,
      input: { modality: "PRESET", presetKey: "BALCONY_DEEP_CLEAN" },
    });
    expect(await database.query(getWorkerIncident, access)).toMatchObject({
      status: "TRANSCRIPT_READY",
      originalText: "Customer asked for balcony deep cleaning.",
    });

    const secondAccess = { ...access, incidentKey: "inc_bad_preset_123" };
    await database.mutation(startTaskConfirm, secondAccess);
    await expect(
      database.mutation(captureRequest, {
        ...secondAccess,
        input: { modality: "PRESET", presetKey: "UNREVIEWED" },
      }),
    ).rejects.toThrow("Unknown reviewed preset.");
  });

  it("rejects cross-run reads and invalid repeated capture transitions", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    await createActiveRun(database, "run_other_visitor", "b".repeat(64));
    const ownerAccess = {
      publicRunId: "run_incident_owner",
      browserTokenHash: "a".repeat(64),
      incidentKey: "inc_private_123",
    };
    await database.mutation(startTaskConfirm, ownerAccess);
    await database.mutation(captureRequest, {
      ...ownerAccess,
      input: { modality: "TEXT", text: "Balcony deep cleaning" },
    });

    await expect(
      database.mutation(captureRequest, {
        ...ownerAccess,
        input: { modality: "TEXT", text: "Try to overwrite" },
      }),
    ).rejects.toThrow(
      "Cannot apply CAPTURE_INPUT while incident is TRANSCRIPT_READY.",
    );
    await expect(
      database.query(getWorkerIncident, {
        publicRunId: "run_other_visitor",
        browserTokenHash: "b".repeat(64),
        incidentKey: "inc_private_123",
      }),
    ).resolves.toBeNull();
  });

  it("lets the worker revise confirmed wording before task selection", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = {
      publicRunId: "run_incident_owner",
      browserTokenHash: "a".repeat(64),
      incidentKey: "inc_revision_123",
    };
    await database.mutation(startTaskConfirm, access);
    await database.mutation(captureRequest, {
      ...access,
      input: { modality: "TEXT", text: "Balcony deep cleaning" },
    });
    await database.mutation(confirmTranscript, {
      ...access,
      confirmedText: "Balcony deep cleaning",
    });
    await database.mutation(prepareTaskCandidates, access);

    await expect(database.mutation(reviseTranscript, access)).resolves.toEqual({
      status: "TRANSCRIPT_READY",
    });
    await database.mutation(confirmTranscript, {
      ...access,
      confirmedText: "Inside cabinet cleaning",
    });
    await expect(
      database.mutation(prepareTaskCandidates, access),
    ).resolves.toMatchObject({
      status: "TASK_CONFIRMATION_REQUIRED",
      candidates: [
        expect.objectContaining({ taskId: "inside_cabinet_cleaning" }),
      ],
    });
  });

  it("lets the worker reject all offered candidates and request safe review", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = {
      publicRunId: "run_incident_owner",
      browserTokenHash: "a".repeat(64),
      incidentKey: "inc_review_123",
    };
    await database.mutation(startTaskConfirm, access);
    await database.mutation(captureRequest, {
      ...access,
      input: { modality: "TEXT", text: "Balcony deep cleaning" },
    });
    await database.mutation(confirmTranscript, {
      ...access,
      confirmedText: "Balcony deep cleaning",
    });
    await database.mutation(prepareTaskCandidates, access);

    await expect(database.mutation(requestTaskReview, access)).resolves.toEqual(
      {
        status: "AWAITING_HUMAN_REVIEW",
      },
    );
  });

  it("retries input in the same incident and keeps trace sequence append-only", async () => {
    const database = convexTest(schema, modules);
    await createActiveRun(database);
    const access = {
      publicRunId: "run_incident_owner",
      browserTokenHash: "a".repeat(64),
      incidentKey: "inc_retry_123",
    };
    await database.mutation(startTaskConfirm, access);
    await database.mutation(captureRequest, {
      ...access,
      input: { modality: "TEXT", text: "Wrong first wording" },
    });
    await expect(database.mutation(retryInput, access)).resolves.toEqual({
      status: "DRAFT",
    });
    await database.mutation(captureRequest, {
      ...access,
      input: { modality: "TEXT", text: "Balcony deep cleaning" },
    });
    expect(await database.query(getWorkerIncident, access)).toMatchObject({
      status: "TRANSCRIPT_READY",
      originalText: "Balcony deep cleaning",
    });
    const sequences = await database.run(async (context) => {
      const incident = await context.db.query("incidents").first();
      if (!incident) return [];
      return (await context.db.query("traceSteps").collect())
        .filter((step) => step.incidentId === incident._id)
        .map((step) => step.sequence);
    });
    expect(sequences).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
