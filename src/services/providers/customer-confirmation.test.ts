import { describe, expect, it } from "vitest";

import {
  customerConfirmationViewSchema,
  parseConfirmationFixtureStore,
  projectFixtureExecution,
  workerConfirmationViewSchema,
} from "./customer-confirmation";
import { buildConfirmationTaskLists } from "../../domain/customer-confirmation-snapshot";

const snapshot = {
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
} as const;

describe("customer confirmation provider contracts", () => {
  it("accepts the frozen worker and customer snapshots", () => {
    expect(
      workerConfirmationViewSchema.parse({
        status: "PENDING",
        expiresAt: "2026-09-01T10:30:00.000Z",
        requestConfirmed: false,
        commercialResponse: null,
        respondedAt: null,
        snapshot,
        execution: null,
      }),
    ).toMatchObject({ status: "PENDING", snapshot });
    expect(
      customerConfirmationViewSchema.parse({
        kind: "ACTIVE",
        requestConfirmed: false,
        expiresAt: "2026-09-01T10:30:00.000Z",
        snapshot,
      }),
    ).toMatchObject({ kind: "ACTIVE", snapshot });
  });

  it("rejects internal identity, token and document fields in public views", () => {
    for (const privateField of [
      "tenantId",
      "customerAlias",
      "workerId",
      "tokenHash",
      "incidentId",
      "decisionId",
      "_id",
    ]) {
      expect(() =>
        customerConfirmationViewSchema.parse({
          kind: "ACTIVE",
          requestConfirmed: false,
          expiresAt: "2026-09-01T10:30:00.000Z",
          snapshot,
          [privateField]: "private",
        }),
      ).toThrow();
    }
  });

  it("keeps invalid and terminal public states discriminated and field-minimal", () => {
    expect(customerConfirmationViewSchema.parse({ kind: "INVALID" })).toEqual({
      kind: "INVALID",
    });
    expect(
      customerConfirmationViewSchema.parse({
        kind: "ALREADY_USED",
        status: "APPROVED",
        snapshot,
        execution: null,
      }),
    ).toEqual({ kind: "ALREADY_USED", status: "APPROVED", snapshot, execution: null });
    expect(() =>
      customerConfirmationViewSchema.parse({
        kind: "INVALID",
        snapshot,
      }),
    ).toThrow();
  });

  it("strips legacy token prefixes without weakening fixture validation", () => {
    const legacyRequest = {
      status: "PENDING",
      expiresAt: "2026-09-01T10:30:00.000Z",
      requestConfirmed: false,
      commercialResponse: null,
      respondedAt: null,
      snapshot,
      publicRunId: "run-1",
      incidentKey: "incident-1",
      tokenHash: "a".repeat(64),
      tokenPrefix: "raw-prefix",
      bookingVersion: 1,
      decisionHash: "decision-1",
      sourceVersion: "v1",
      createdAt: "2026-09-01T10:00:00.000Z",
    };
    const result = parseConfirmationFixtureStore({ requests: [legacyRequest] });
    expect(result.migrated).toBe(true);
    expect(result.store.requests[0]).not.toHaveProperty("tokenPrefix");
    expect(() =>
      parseConfirmationFixtureStore({
        requests: [{ ...legacyRequest, tokenHash: "not-a-hash" }],
      }),
    ).toThrow();
  });

  it("projects only customer-safe fields into resulting tasks", () => {
    const selectedTask = {
      taskId: "balcony_deep_cleaning",
      displayName: "Balcony deep cleaning",
      catalogVersion: "internal-v1",
    };
    expect(
      buildConfirmationTaskLists({
        includedTaskIds: [],
        catalogue: [],
        selectedTask,
      }).resultingTasks,
    ).toEqual([
      { taskId: "balcony_deep_cleaning", displayName: "Balcony deep cleaning" },
    ]);
  });

  it("projects a successful fixture execution without private request fields", () => {
    const receipt = {
      actionExecutionId: "execution-1",
      connector: "DEMONSTRATION_CONNECTOR" as const,
      idempotencyKey: "b".repeat(64),
      externalActionId: "ACT-DEMO-1234567890AB",
      requestHash: "a".repeat(64),
      previousBookingVersion: 1,
      resultingBookingVersion: 2,
      actionType: "ADD_TASK" as const,
      status: "SUCCEEDED" as const,
      executedAt: "2026-09-01T10:01:00.000Z",
    };
    const result = projectFixtureExecution({
      tokenHash: "c".repeat(64),
      request: {
        tenantId: "private-tenant",
        incidentKey: "private-incident",
        decisionHash: "decision-1",
        bookingKey: "DEMO-4821",
        bookingVersion: 1,
        sourceVersion: "v1",
        action: {
          type: "ADD_TASK",
          taskId: "balcony_deep_cleaning",
          priceDeltaMinor: 29_900,
          durationDeltaMinutes: 25,
        },
        requestHash: "a".repeat(64),
        idempotencyKey: "b".repeat(64),
      },
      status: "SUCCEEDED",
      attemptCount: 1,
      receipt,
      error: null,
    });

    expect(result).toEqual({
      status: "SUCCEEDED",
      attemptCount: 1,
      receipt: {
        connector: receipt.connector,
        externalActionId: receipt.externalActionId,
        previousBookingVersion: receipt.previousBookingVersion,
        resultingBookingVersion: receipt.resultingBookingVersion,
        status: receipt.status,
        executedAt: receipt.executedAt,
      },
      error: null,
    });
    expect(result.receipt).not.toHaveProperty("requestHash");
    expect(result.receipt).not.toHaveProperty("idempotencyKey");
    expect(result.receipt).not.toHaveProperty("actionExecutionId");
    expect(result).not.toHaveProperty("tokenHash");
    expect(result).not.toHaveProperty("request");
  });
});
