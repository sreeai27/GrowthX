import { describe, expect, it } from "vitest";

import {
  applyCustomerResponse,
  evaluateConfirmationAccess,
  type ConfirmationLifecycleInput,
} from "./customer-confirmation";

const NOW = "2026-09-01T10:00:00.000Z";

function fixture(
  overrides: Partial<ConfirmationLifecycleInput> = {},
): ConfirmationLifecycleInput {
  return {
    now: NOW,
    expiresAt: "2026-09-01T10:30:00.000Z",
    status: "PENDING",
    requestConfirmed: false,
    storedBookingVersion: 7,
    currentBookingVersion: 7,
    storedDecisionHash: "decision-v7",
    currentDecisionHash: "decision-v7",
    storedSourceVersion: "source-v2",
    currentSourceVersion: "source-v2",
    ...overrides,
  };
}

describe("evaluateConfirmationAccess", () => {
  it("allows a current pending request", () => {
    expect(evaluateConfirmationAccess(fixture())).toEqual({ kind: "ACTIVE" });
  });

  it.each([
    ["APPROVED", "ALREADY_USED"],
    ["DECLINED", "ALREADY_USED"],
    ["REQUEST_MISMATCH", "ALREADY_USED"],
    ["EXPIRED", "EXPIRED"],
    ["REVOKED", "REVOKED"],
    ["STALE", "STALE"],
  ] as const)("maps %s to %s", (status, kind) => {
    expect(evaluateConfirmationAccess(fixture({ status }))).toEqual({
      kind,
      status,
    });
  });

  it("expires at the exact expiry instant", () => {
    expect(
      evaluateConfirmationAccess(
        fixture({ now: "2026-09-01T10:30:00.000Z" }),
      ),
    ).toEqual({ kind: "EXPIRED", status: "EXPIRED" });
  });

  it.each([
    ["booking", { currentBookingVersion: 8 }],
    ["decision", { currentDecisionHash: "changed" }],
    ["source", { currentSourceVersion: "source-v3" }],
  ] as const)("marks a changed %s authority stale", (_name, change) => {
    expect(evaluateConfirmationAccess(fixture(change))).toEqual({
      kind: "STALE",
      status: "STALE",
    });
  });
});

describe("applyCustomerResponse", () => {
  it("records request confirmation without commercial approval", () => {
    expect(
      applyCustomerResponse({ ...fixture(), requestedResponse: "CONFIRM_REQUEST" }),
    ).toEqual({
      kind: "RECORDED",
      status: "PENDING",
      requestConfirmed: true,
      incidentStatus: "AWAITING_CUSTOMER",
    });
  });

  it("rejects commercial approval until the request is confirmed", () => {
    expect(
      applyCustomerResponse({ ...fixture(), requestedResponse: "APPROVE" }),
    ).toEqual({ kind: "REJECTED", reason: "REQUEST_NOT_CONFIRMED" });
  });

  it("records a mismatch answer to the first question without confirmation", () => {
    expect(
      applyCustomerResponse({
        ...fixture(),
        requestedResponse: "REPORT_MISMATCH",
      }),
    ).toEqual({
      kind: "RECORDED",
      status: "REQUEST_MISMATCH",
      requestConfirmed: false,
      incidentStatus: "AWAITING_HUMAN_REVIEW",
    });
  });

  it("keeps an unconfirmed mismatch retry idempotent", () => {
    expect(
      applyCustomerResponse({
        ...fixture({ status: "REQUEST_MISMATCH" }),
        requestedResponse: "REPORT_MISMATCH",
      }),
    ).toEqual({
      kind: "IDEMPOTENT",
      status: "REQUEST_MISMATCH",
      requestConfirmed: false,
      incidentStatus: "AWAITING_HUMAN_REVIEW",
    });
  });

  it("treats repeated request confirmation as idempotent", () => {
    expect(
      applyCustomerResponse({
        ...fixture({ requestConfirmed: true }),
        requestedResponse: "CONFIRM_REQUEST",
      }),
    ).toEqual({
      kind: "IDEMPOTENT",
      status: "PENDING",
      requestConfirmed: true,
      incidentStatus: "AWAITING_CUSTOMER",
    });
  });

  it.each([
    ["APPROVE", "APPROVED", "ACTION_AUTHORISED"],
    ["DECLINE", "DECLINED", "COMPLETION_PENDING"],
    ["REPORT_MISMATCH", "REQUEST_MISMATCH", "AWAITING_HUMAN_REVIEW"],
  ] as const)("records %s", (requestedResponse, status, incidentStatus) => {
    expect(
      applyCustomerResponse({
        ...fixture({ requestConfirmed: true }),
        requestedResponse,
      }),
    ).toEqual({
      kind: "RECORDED",
      status,
      requestConfirmed: true,
      incidentStatus,
    });
  });

  it.each([
    ["APPROVED", "APPROVE", "ACTION_AUTHORISED"],
    ["DECLINED", "DECLINE", "COMPLETION_PENDING"],
    ["REQUEST_MISMATCH", "REPORT_MISMATCH", "AWAITING_HUMAN_REVIEW"],
  ] as const)("treats a retry of %s as idempotent", (status, requestedResponse, incidentStatus) => {
    expect(
      applyCustomerResponse({
        ...fixture({ status, requestConfirmed: true }),
        requestedResponse,
      }),
    ).toEqual({
      kind: "IDEMPOTENT",
      status,
      requestConfirmed: true,
      incidentStatus,
    });
  });

  it("rejects a different response after consumption", () => {
    expect(
      applyCustomerResponse({
        ...fixture({ status: "APPROVED", requestConfirmed: true }),
        requestedResponse: "DECLINE",
      }),
    ).toEqual({ kind: "REJECTED", reason: "ALREADY_USED" });
  });

  it.each([
    [fixture({ now: "2026-09-01T10:31:00.000Z" }), "EXPIRED"],
    [fixture({ currentBookingVersion: 8 }), "STALE"],
    [fixture({ currentDecisionHash: "changed" }), "STALE"],
    [fixture({ currentSourceVersion: "source-v3" }), "STALE"],
    [fixture({ status: "REVOKED" }), "REVOKED"],
  ] as const)("rejects unavailable authority", (input, reason) => {
    expect(
      applyCustomerResponse({ ...input, requestedResponse: "REPORT_MISMATCH" }),
    ).toEqual({ kind: "REJECTED", reason });
  });
});
