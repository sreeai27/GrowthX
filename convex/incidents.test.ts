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

describe("TaskConfirm incidents", () => {
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
