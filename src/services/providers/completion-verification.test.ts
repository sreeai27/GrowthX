import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  CompletionSubmissionConflictError,
  completionViewSchema,
  createFixtureCompletionVerificationGateway,
  parseCompletionFixtureStore,
  projectCompletionView,
} from "./completion-verification";

const view = {
  kind: "RECORDED",
  agreement: {
    bookingKey: "DEMO-4821",
    serviceName: "Essential Home Cleaning",
    bookingVersion: 2,
    tasks: [{ taskId: "balcony", displayName: "Balcony" }],
    receipt: {
      connector: "DEMONSTRATION_CONNECTOR",
      externalActionId: "ACT-1",
      resultingBookingVersion: 2,
      executedAt: "2026-09-01T10:00:00.000Z",
    },
  },
  summary: {
    taskStates: [{ taskId: "balcony", state: "COMPLETE" }],
    note: null,
    submittedAt: "2026-09-01T10:01:00.000Z",
    customerResponse: "ACKNOWLEDGE",
    customerNote: null,
    respondedAt: "2026-09-01T10:02:00.000Z",
  },
  verification: {
    state: "VERIFIED",
    reviewerRequired: false,
    criteriaVersion: "taskconfirm-verification-v1",
    bookingVersion: 2,
    updatedAt: "2026-09-01T10:02:00.000Z",
  },
} as const;

describe("completion verification provider contract", () => {
  it("ignores legacy summaries that have no durable audit evidence", () => {
    const legacy = {
      publicRunId: "run-1",
      incidentKey: "incident-1",
      tokenHash: "a".repeat(64),
      agreement: view.agreement,
      summary: view.summary,
      verification: view.verification,
      receiptRequired: true,
      receiptMatches: true,
    };
    expect(parseCompletionFixtureStore({ summaries: [legacy] })).toEqual({ summaries: [] });
  });
  it("parses the same safe projection for Convex and fixture values", () => {
    expect(completionViewSchema.parse(view)).toEqual(view);
    expect(projectCompletionView(view)).toEqual(view);
  });

  it("rejects private and unknown fields at every public boundary", () => {
    for (const privateField of ["tenantId", "tokenHash", "incidentId", "_id", "actionExecutionId", "receiptHash"]) {
      expect(() => completionViewSchema.parse({ ...view, [privateField]: "private" })).toThrow();
    }
    expect(() => completionViewSchema.parse({ ...view, agreement: { ...view.agreement, tenantId: "private" } })).toThrow();
    expect(() => completionViewSchema.parse({ ...view, agreement: { ...view.agreement, receipt: { ...view.agreement.receipt, requestHash: "private" } } })).toThrow();
  });

  it("keeps invalid and not-ready customer states minimal", () => {
    expect(projectCompletionView({ kind: "INVALID" })).toEqual({ kind: "INVALID" });
    expect(() => completionViewSchema.parse({ kind: "INVALID", tokenHash: "a".repeat(64) })).toThrow();
  });

  it("persists one frozen final agreement and customer response across fixture reload", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hunar-completion-"));
    const path = join(directory, "runs.json");
    const access = { publicRunId: "run-1", browserTokenHash: "b".repeat(64), incidentKey: "incident-1" };
    const tokenHash = "a".repeat(64);
    await writeFile(path, JSON.stringify({ runs: [{ publicRunId: access.publicRunId, browserTokenHash: access.browserTokenHash, status: "ACTIVE", resumeExpiresAt: "2099-01-01T00:00:00.000Z" }] }));
    await writeFile(`${path}.incidents`, JSON.stringify({ incidents: [{ publicRunId: access.publicRunId, incidentKey: access.incidentKey, status: "COMPLETION_PENDING", policyDecision: { booking: { bookingKey: "DEMO-4821", serviceName: "Cleaning", bookingVersion: 2, includedTasks: [{ taskId: "bathroom", displayName: "Bathroom" }, { taskId: "balcony", displayName: "Balcony" }] } } }] }));
    await writeFile(`${path}.confirmations`, JSON.stringify({ requests: [{ publicRunId: access.publicRunId, incidentKey: access.incidentKey, tokenHash: "b".repeat(64), completionTokenHash: tokenHash, commercialResponse: "APPROVE", snapshot: { resultingTasks: [{ taskId: "bathroom", displayName: "Bathroom" }, { taskId: "balcony", displayName: "Balcony" }] } }], executions: [{ tokenHash: "b".repeat(64), status: "SUCCEEDED", receipt: { actionExecutionId: "EXEC-1", connector: "DEMONSTRATION_CONNECTOR", externalActionId: "ACT-1", resultingBookingVersion: 2, executedAt: "2026-09-01T10:00:00.000Z", requestHash: "private" } }] }));
    const gateway = createFixtureCompletionVerificationGateway(path);
    const input = { bookingVersion: 2, taskStates: [{ taskId: "bathroom", state: "COMPLETE" as const }, { taskId: "balcony", state: "COMPLETE" as const }] };
    const submitted = await gateway.submitWorkerSummary(access, input);
    expect(submitted).toMatchObject({ kind: "SUBMITTED", agreement: { bookingVersion: 2 }, verification: { state: "CANNOT_VERIFY" } });
    expect(await gateway.submitWorkerSummary(access, input)).toEqual(submitted);

    const incidents = JSON.parse(await readFile(`${path}.incidents`, "utf8"));
    incidents.incidents[0].policyDecision.booking.includedTasks[1].displayName = "Changed later";
    await writeFile(`${path}.incidents`, JSON.stringify(incidents));
    const recorded = await gateway.respondAsCustomer(tokenHash, { response: "ACKNOWLEDGE" });
    expect(recorded).toMatchObject({ kind: "RECORDED", agreement: { tasks: [{ displayName: "Bathroom" }, { displayName: "Balcony" }] }, verification: { state: "VERIFIED" } });
    expect(await createFixtureCompletionVerificationGateway(path).getForCustomer(tokenHash)).toEqual(recorded);
    const stored = await readFile(`${path}.completions`, "utf8");
    expect(stored).toContain(tokenHash);
    expect(stored).not.toContain("private");
    const audit = JSON.parse(stored).summaries[0];
    expect(audit.events.map((event: { stage: string; actor: string }) => ({ stage: event.stage, actor: event.actor }))).toEqual([
      { stage: "completion_submitted", actor: "WORKER" },
      { stage: "verification_completed", actor: "CUSTOMER" },
    ]);
    expect(audit.events[1]).toMatchObject({ actionExecutionId: "EXEC-1", evidence: { receiptMatches: true, customerResponse: "ACKNOWLEDGE" } });
    expect(audit.humanReviews).toEqual([]);
  });

  it("persists neutral fixture review records for blockers and disputes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "hunar-completion-review-"));
    const path = join(directory, "runs.json");
    const access = { publicRunId: "run-1", browserTokenHash: "b".repeat(64), incidentKey: "incident-1" };
    const completionTokenHash = "a".repeat(64);
    await writeFile(path, JSON.stringify({ runs: [{ publicRunId: access.publicRunId, browserTokenHash: access.browserTokenHash, status: "ACTIVE", resumeExpiresAt: "2099-01-01T00:00:00.000Z" }] }));
    await writeFile(`${path}.incidents`, JSON.stringify({ incidents: [{ publicRunId: access.publicRunId, incidentKey: access.incidentKey, status: "COMPLETION_PENDING", policyDecision: { booking: { bookingKey: "DEMO-4821", serviceName: "Cleaning", bookingVersion: 1, includedTasks: [{ taskId: "bathroom", displayName: "Bathroom" }] } } }] }));
    await writeFile(`${path}.confirmations`, JSON.stringify({ requests: [{ publicRunId: access.publicRunId, incidentKey: access.incidentKey, tokenHash: "c".repeat(64), completionTokenHash, commercialResponse: "DECLINE", snapshot: { resultingTasks: [{ taskId: "bathroom", displayName: "Bathroom" }] } }], executions: [] }));
    const gateway = createFixtureCompletionVerificationGateway(path);
    await gateway.submitWorkerSummary(access, { bookingVersion: 1, taskStates: [{ taskId: "bathroom", state: "BLOCKED" }], note: "No access" });
    await expect(gateway.submitWorkerSummary(access, { bookingVersion: 1, taskStates: [{ taskId: "bathroom", state: "COMPLETE" }] })).rejects.toBeInstanceOf(CompletionSubmissionConflictError);
    const stored = JSON.parse(await readFile(`${path}.completions`, "utf8")).summaries[0];
    expect(stored.humanReviews).toMatchObject([{ type: "COMPLETION_BLOCKER", status: "OPEN", taskIds: ["bathroom"] }]);
    expect(stored.tokenHash).toBe(completionTokenHash);
    expect(stored.tokenHash).not.toBe("c".repeat(64));
  });
});
