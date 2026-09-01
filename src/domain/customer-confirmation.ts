import type { IncidentStatus } from "./incident-state";

export type ConfirmationStatus =
  | "PENDING"
  | "APPROVED"
  | "DECLINED"
  | "REQUEST_MISMATCH"
  | "EXPIRED"
  | "REVOKED"
  | "STALE";

export type CustomerResponse =
  | "CONFIRM_REQUEST"
  | "APPROVE"
  | "DECLINE"
  | "REPORT_MISMATCH";

export interface ConfirmationLifecycleInput {
  readonly now: string;
  readonly expiresAt: string;
  readonly status: ConfirmationStatus;
  readonly requestConfirmed: boolean;
  readonly storedBookingVersion: number;
  readonly currentBookingVersion: number;
  readonly storedDecisionHash: string;
  readonly currentDecisionHash: string;
  readonly storedSourceVersion: string;
  readonly currentSourceVersion: string;
}

export type ConfirmationAccessResult =
  | { readonly kind: "ACTIVE" }
  | {
      readonly kind: "ALREADY_USED";
      readonly status: "APPROVED" | "DECLINED" | "REQUEST_MISMATCH";
    }
  | { readonly kind: "EXPIRED"; readonly status: "EXPIRED" }
  | { readonly kind: "REVOKED"; readonly status: "REVOKED" }
  | { readonly kind: "STALE"; readonly status: "STALE" };

type RecordedStatus = "APPROVED" | "DECLINED" | "REQUEST_MISMATCH";

export type CustomerResponseResult =
  | {
      readonly kind: "RECORDED" | "IDEMPOTENT";
      readonly status: ConfirmationStatus;
      readonly requestConfirmed: boolean;
      readonly incidentStatus: IncidentStatus;
    }
  | {
      readonly kind: "REJECTED";
      readonly reason:
        | "REQUEST_NOT_CONFIRMED"
        | "ALREADY_USED"
        | "EXPIRED"
        | "REVOKED"
        | "STALE";
    };

const INCIDENT_STATUS_BY_RECORDED_STATUS: Record<RecordedStatus, IncidentStatus> = {
  APPROVED: "ACTION_AUTHORISED",
  DECLINED: "COMPLETION_PENDING",
  REQUEST_MISMATCH: "AWAITING_HUMAN_REVIEW",
};

const STATUS_BY_RESPONSE: Record<Exclude<CustomerResponse, "CONFIRM_REQUEST">, RecordedStatus> = {
  APPROVE: "APPROVED",
  DECLINE: "DECLINED",
  REPORT_MISMATCH: "REQUEST_MISMATCH",
};

export function evaluateConfirmationAccess(
  input: ConfirmationLifecycleInput,
): ConfirmationAccessResult {
  if (input.status === "EXPIRED") return { kind: "EXPIRED", status: "EXPIRED" };
  if (input.status === "REVOKED") return { kind: "REVOKED", status: "REVOKED" };
  if (input.status === "STALE") return { kind: "STALE", status: "STALE" };
  if (input.status !== "PENDING") {
    return { kind: "ALREADY_USED", status: input.status };
  }

  if (
    input.storedBookingVersion !== input.currentBookingVersion ||
    input.storedDecisionHash !== input.currentDecisionHash ||
    input.storedSourceVersion !== input.currentSourceVersion
  ) {
    return { kind: "STALE", status: "STALE" };
  }

  const now = Date.parse(input.now);
  const expiresAt = Date.parse(input.expiresAt);
  if (!Number.isFinite(now) || !Number.isFinite(expiresAt) || now >= expiresAt) {
    return { kind: "EXPIRED", status: "EXPIRED" };
  }

  return { kind: "ACTIVE" };
}

export function applyCustomerResponse(
  input: ConfirmationLifecycleInput & {
    readonly requestedResponse: CustomerResponse;
  },
): CustomerResponseResult {
  const access = evaluateConfirmationAccess(input);

  if (access.kind === "ALREADY_USED") {
    if (
      input.requestedResponse !== "CONFIRM_REQUEST" &&
      STATUS_BY_RESPONSE[input.requestedResponse] === access.status
    ) {
      return {
        kind: "IDEMPOTENT",
        status: access.status,
        requestConfirmed: input.requestConfirmed,
        incidentStatus: INCIDENT_STATUS_BY_RECORDED_STATUS[access.status],
      };
    }
    return { kind: "REJECTED", reason: "ALREADY_USED" };
  }
  if (access.kind !== "ACTIVE") {
    return { kind: "REJECTED", reason: access.kind };
  }

  if (input.requestedResponse === "CONFIRM_REQUEST") {
    return {
      kind: input.requestConfirmed ? "IDEMPOTENT" : "RECORDED",
      status: "PENDING",
      requestConfirmed: true,
      incidentStatus: "AWAITING_CUSTOMER",
    };
  }
  if (
    !input.requestConfirmed &&
    (input.requestedResponse === "APPROVE" ||
      input.requestedResponse === "DECLINE")
  ) {
    return { kind: "REJECTED", reason: "REQUEST_NOT_CONFIRMED" };
  }

  const status = STATUS_BY_RESPONSE[input.requestedResponse];
  return {
    kind: "RECORDED",
    status,
    requestConfirmed: input.requestConfirmed,
    incidentStatus: INCIDENT_STATUS_BY_RECORDED_STATUS[status],
  };
}
