import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const captureContact = makeFunctionReference<"mutation", Record<string, unknown>, Record<string, unknown>>("privateDemoResults:captureContact");
const getByResultToken = makeFunctionReference<"query", { tokenHash: string }, Record<string, unknown> | null>("privateDemoResults:getByResultToken");
const reserveDelivery = makeFunctionReference<"mutation", Record<string, unknown>, Record<string, unknown>>("privateDemoResults:reserveDelivery");

describe("private demo result persistence", () => {
  it("captures an unverified contact and opens only the frozen safe result", async () => {
    const database = convexTest(schema, modules);
    const now = "2026-09-01T10:00:00.000Z";
    await database.run(async (context) => {
      const runId = await context.db.insert("demoRuns", { tenantId: "demo_sahaay_home_services", publicRunId: "run-private-result", browserTokenHash: "a".repeat(64), status: "COMPLETED", bookingKey: "DEMO-4821", startedAt: now, lastActiveAt: now, resumeExpiresAt: "2099-01-01T00:00:00.000Z" });
      const incidentId = await context.db.insert("incidents", { tenantId: "demo_sahaay_home_services", incidentKey: "inc-private-result", demoRunId: runId, scenarioPack: "TASK_CONFIRM", bookingKey: "DEMO-4821", bookingVersion: 2, workerPublicUserId: "worker", status: "VERIFIED", riskTier: 1, supportState: "SUPPORTED", flowVersion: "v1", createdAt: now, updatedAt: now });
      const mediaId = await context.db.insert("mediaInputs", { tenantId: "demo_sahaay_home_services", incidentId, modality: "TEXT", capturePurpose: "CUSTOMER_REQUESTED_CHANGE", consentBasis: "WORKER_INITIATED_REPORT", qualityState: "USABLE", createdAt: now });
      const transcriptId = await context.db.insert("transcripts", { tenantId: "demo_sahaay_home_services", incidentId, mediaInputId: mediaId, provider: "TYPED_OR_REVIEWED_PRESET", providerModel: "deterministic-input-v1", mode: "TEXT", detectedLanguages: ["en-IN"], rawTranscript: "raw words must stay private", inputQualityState: "USABLE", createdAt: now });
      const transcriptConfirmationId = await context.db.insert("transcriptConfirmations", { tenantId: "demo_sahaay_home_services", incidentId, transcriptId, confirmedBy: "worker", originalText: "raw words must stay private", confirmedText: "raw words must stay private", wasEdited: false, editSummary: "No edits", confirmedAt: now });
      const interpretationId = await context.db.insert("exceptionInterpretations", { tenantId: "demo_sahaay_home_services", incidentId, confirmedTranscriptId: transcriptConfirmationId, flowVersion: "v1", promptVersion: "v1", modelId: "model", reportedRequest: "raw words must stay private", summary: "Add balcony deep cleaning", candidateTasks: [], shouldAbstain: false, createdAt: now });
      await context.db.insert("taskConfirmations", { tenantId: "demo_sahaay_home_services", incidentId, interpretationId, selectedTaskId: "balcony", confirmedByWorker: "worker", confirmedAt: now });
      const decisionId = await context.db.insert("policyDecisions", { tenantId: "demo_sahaay_home_services", incidentId, bookingVersion: 1, taskId: "balcony", ruleKey: "rule", ruleVersion: "v1", sourceKey: "source", sourceVersion: "v1", passageKey: "p", decisionState: "ADD_ON_APPROVAL_REQUIRED", supportState: "SUPPORTED", durationDeltaMinutes: 25, priceDeltaMinor: 29900, currency: "INR", removableTaskIds: [], requirements: { customerRequestConfirmation: true, customerCommercialApproval: true, humanReview: false, workerFeasibilityConfirmation: false }, flowVersion: "v1", promptVersion: "v1", modelId: "none", allowedActions: ["ADD_TASK"], prohibitedActions: [], explanationKey: "add", decisionHash: "hash", createdAt: now });
      const confirmationId = await context.db.insert("confirmationRequests", { tenantId: "demo_sahaay_home_services", incidentId, decisionId, tokenHash: "b".repeat(64), expiresAt: "2099-01-01T00:00:00.000Z", status: "APPROVED", requestSnapshot: { bookingKey: "DEMO-4821", serviceName: "Cleaning", includedTasks: [], resultingTasks: [], taskId: "balcony", taskDisplayName: "Balcony", decisionState: "ADD_ON_APPROVAL_REQUIRED", durationDeltaMinutes: 25, priceDeltaMinor: 29900, currency: "INR", removableTaskIds: [], sourceKey: "source", sourceTitle: "Policy", sourceVersion: "v1" }, requestConfirmedByCustomer: true, requestConfirmedAt: now, commercialResponse: "APPROVE", respondedAt: now, bookingVersion: 1, decisionHash: "hash", sourceVersion: "v1", createdAt: now, updatedAt: now });
      await context.db.insert("actionExecutions", { tenantId: "demo_sahaay_home_services", incidentId, decisionId, confirmationRequestId: confirmationId, connector: "DEMONSTRATION_CONNECTOR", actionType: "ADD_TASK", payload: { bookingKey: "DEMO-4821", taskId: "balcony", priceDeltaMinor: 29900, durationDeltaMinutes: 25 }, payloadHash: "payload", idempotencyKey: "private", status: "SUCCEEDED", attemptCount: 1, externalActionId: "ACT-1", priorBookingVersion: 1, resultingBookingVersion: 2, receipt: { actionExecutionId: "EXEC-1", connector: "DEMONSTRATION_CONNECTOR", idempotencyKey: "private", externalActionId: "ACT-1", requestHash: "payload", previousBookingVersion: 1, resultingBookingVersion: 2, actionType: "ADD_TASK", status: "SUCCEEDED", executedAt: now }, startedAt: now, completedAt: now, updatedAt: now });
      const summaryId = await context.db.insert("completionSummaries", { tenantId: "demo_sahaay_home_services", incidentId, bookingVersion: 2, agreedTasks: [{ taskId: "balcony", displayName: "Balcony" }], workerTaskStates: [{ taskId: "balcony", state: "COMPLETE" }], submittedBy: "worker", submittedAt: now, customerResponse: "ACKNOWLEDGE", respondedAt: now, verificationState: "VERIFIED", reviewerRequired: false, updatedAt: now });
      await context.db.insert("verificationEvents", { tenantId: "demo_sahaay_home_services", incidentId, completionSummaryId: summaryId, criteriaVersion: "taskconfirm-verification-v1", actor: "CUSTOMER", bookingVersion: 2, evidence: { agreedTaskIds: ["balcony"], workerTaskStates: [{ taskId: "balcony", state: "COMPLETE" }], receiptRequired: true, receiptMatches: true, customerResponse: "ACKNOWLEDGE" }, state: "VERIFIED", reviewerRequired: false, createdAt: now });
    });

    const captured = await database.mutation(captureContact, { publicRunId: "run-private-result", browserTokenHash: "a".repeat(64), contact: " Visitor@Example.COM ", invitationConsent: false });
    expect(captured).toMatchObject({ maskedDisplay: "v***@example.com", verificationState: "UNVERIFIED" });
    const resultTokenHash = "c".repeat(64);
    await database.mutation(reserveDelivery, { publicRunId: "run-private-result", browserTokenHash: "a".repeat(64), browserRateKey: "browser-one", resultTokenHash });
    const opened = await database.query(getByResultToken, { tokenHash: resultTokenHash });
    expect(opened).toMatchObject({ kind: "ACTIVE", snapshot: { requestSummary: "Add balcony deep cleaning", policyOutcome: { decisionState: "ADD_ON_APPROVAL_REQUIRED" }, customerDecision: "APPROVE", finalReceipt: { externalActionId: "ACT-1" } } });
    expect(JSON.stringify(opened)).not.toMatch(/visitor@example|tenantId|raw words|tokenHash|trace/i);
  });
});
