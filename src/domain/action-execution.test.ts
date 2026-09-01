import { describe, expect, it } from "vitest";

import {
  assertActionAuthorised,
  buildActionExecutionRequest,
  classifyActionRetry,
  type ActionAuthorityInput,
} from "./action-execution";

const authorisedFixture: ActionAuthorityInput = {
  tenantId: "demo_sahaay_home_services",
  incidentKey: "incident-1",
  incidentStatus: "ACTION_AUTHORISED",
  bookingKey: "DEMO-4821",
  storedBookingVersion: 1,
  currentBookingVersion: 1,
  storedDecisionHash: "decision-hash-v1",
  currentDecisionHash: "decision-hash-v1",
  storedSourceVersion: "taskconfirm-demo-policy-v1",
  currentSourceVersion: "taskconfirm-demo-policy-v1",
  requestConfirmedByCustomer: true,
  commercialResponse: "APPROVE",
  decisionState: "ADD_ON_APPROVAL_REQUIRED",
  supportState: "SUPPORTED",
  action: {
    type: "ADD_TASK",
    taskId: "balcony_deep_cleaning",
    priceDeltaMinor: 29_900,
    durationDeltaMinutes: 25,
  },
};

describe("action execution authority", () => {
  it("builds one canonical add-task request only from current approval", () => {
    const request = buildActionExecutionRequest(authorisedFixture);

    expect(request.action).toEqual({
      type: "ADD_TASK",
      taskId: "balcony_deep_cleaning",
      priceDeltaMinor: 29_900,
      durationDeltaMinutes: 25,
    });
    expect(request.idempotencyKey).toMatch(/^[a-f0-9]{64}$/);
    expect(request.requestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(buildActionExecutionRequest(authorisedFixture)).toEqual(request);
  });

  it.each([
    ["wrong status", { incidentStatus: "AWAITING_CUSTOMER" }],
    ["unconfirmed request", { requestConfirmedByCustomer: false }],
    ["declined", { commercialResponse: "DECLINE" }],
    ["stale booking", { currentBookingVersion: 2 }],
    ["stale decision", { currentDecisionHash: "decision-hash-v2" }],
    ["stale source", { currentSourceVersion: "policy-v2" }],
    ["unsupported action", { decisionState: "TRADE_OFF_REQUIRED" }],
    ["unsupported evidence", { supportState: "PARTIALLY_SUPPORTED" }],
  ] as const)("rejects %s before connector execution", (_caseName, change) => {
    expect(() =>
      buildActionExecutionRequest({ ...authorisedFixture, ...change }),
    ).toThrow();
  });

  it("rejects an invented add-on even when approval fields match", () => {
    expect(() =>
      assertActionAuthorised({
        ...authorisedFixture,
        action: { ...authorisedFixture.action, taskId: "invented_task" },
      }),
    ).toThrow();
  });

  it("uses unambiguous hashing for field boundaries", () => {
    const first = buildActionExecutionRequest({
      ...authorisedFixture,
      tenantId: "ab",
      incidentKey: "c",
    });
    const second = buildActionExecutionRequest({
      ...authorisedFixture,
      tenantId: "a",
      incidentKey: "bc",
    });

    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
  });
});

describe("classifyActionRetry", () => {
  it.each([
    ["PENDING", "WAIT"],
    ["SUCCEEDED", "RETURN_STORED_RECEIPT"],
    ["RETRYABLE_FAILED", "RETRY"],
    ["PERMANENT_FAILED", "STOP"],
    ["RECONCILIATION_REQUIRED", "ESCALATE"],
  ] as const)("classifies %s as %s", (status, expected) => {
    expect(classifyActionRetry(status)).toBe(expected);
  });
});
