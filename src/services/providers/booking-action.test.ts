import { describe, expect, it } from "vitest";

import type { ActionExecutionRequest } from "../../domain/action-execution";
import {
  BookingActionConnectorError,
  MockBookingActionConnector,
  executeWithOutput,
} from "./booking-action";

const request: ActionExecutionRequest = {
  tenantId: "demo_sahaay_home_services",
  incidentKey: "incident-1",
  decisionHash: "decision-hash-v1",
  bookingKey: "DEMO-4821",
  bookingVersion: 1,
  sourceVersion: "taskconfirm-demo-policy-v1",
  action: {
    type: "ADD_TASK",
    taskId: "balcony_deep_cleaning",
    priceDeltaMinor: 29_900,
    durationDeltaMinutes: 25,
  },
  requestHash: "1".repeat(64),
  idempotencyKey: "2".repeat(64),
};

describe("MockBookingActionConnector", () => {
  it("returns the same receipt for the same idempotency key", async () => {
    const connector = new MockBookingActionConnector();

    const first = await connector.execute(request);
    const second = await connector.execute(request);

    expect(second).toEqual(first);
    expect(connector.mutationCount).toBe(1);
  });

  it("converges concurrent calls on one receipt", async () => {
    const connector = new MockBookingActionConnector();

    const [first, second] = await Promise.all([
      connector.execute(request),
      connector.execute(request),
    ]);

    expect(second).toEqual(first);
    expect(connector.mutationCount).toBe(1);
  });

  it("keeps different idempotency keys isolated", async () => {
    const connector = new MockBookingActionConnector();
    const first = await connector.execute(request);
    const second = await connector.execute({
      ...request,
      requestHash: "3".repeat(64),
      idempotencyKey: "4".repeat(64),
    });

    expect(second.externalActionId).not.toBe(first.externalActionId);
    expect(connector.mutationCount).toBe(2);
  });

  it("rejects malformed connector output", async () => {
    await expect(executeWithOutput(request, { status: "ok" })).rejects.toThrow();
  });

  it("recovers safely from a transient failure before commit", async () => {
    const connector = new MockBookingActionConnector({
      failureMode: "TRANSIENT_BEFORE_COMMIT",
    });

    await expect(connector.execute(request)).rejects.toMatchObject({
      code: "TRANSIENT_BEFORE_COMMIT",
      retryable: true,
      outcomeUncertain: false,
    });
    expect(connector.mutationCount).toBe(0);

    await expect(connector.execute(request)).resolves.toMatchObject({
      idempotencyKey: request.idempotencyKey,
    });
    expect(connector.mutationCount).toBe(1);
  });

  it("returns the committed receipt after a timeout", async () => {
    const connector = new MockBookingActionConnector({
      failureMode: "TIMEOUT_AFTER_COMMIT",
    });

    await expect(connector.execute(request)).rejects.toMatchObject({
      code: "TIMEOUT_AFTER_COMMIT",
      retryable: true,
      outcomeUncertain: true,
    });
    expect(connector.mutationCount).toBe(1);

    const receipt = await connector.execute(request);
    expect(receipt.externalActionId).toBe(
      `ACT-DEMO-${request.idempotencyKey.slice(0, 16).toUpperCase()}`,
    );
    expect(connector.mutationCount).toBe(1);
  });

  it("surfaces permanent rejection without committing", async () => {
    const connector = new MockBookingActionConnector({
      failureMode: "PERMANENT_REJECTION",
    });

    await expect(connector.execute(request)).rejects.toBeInstanceOf(
      BookingActionConnectorError,
    );
    await expect(connector.execute(request)).rejects.toMatchObject({
      code: "PERMANENT_REJECTION",
      retryable: false,
      outcomeUncertain: false,
    });
    expect(connector.mutationCount).toBe(0);
  });
});
