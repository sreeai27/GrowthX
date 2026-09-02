export type IncidentStatus =
  | "DRAFT"
  | "INPUT_CAPTURED"
  | "TRANSCRIPT_READY"
  | "TRANSCRIPT_CONFIRMED"
  | "TASK_CONFIRMATION_REQUIRED"
  | "TASK_CONFIRMED"
  | "DECISION_READY"
  | "AWAITING_CUSTOMER"
  | "ACTION_AUTHORISED"
  | "ACTION_EXECUTING"
  | "ACTION_EXECUTED"
  | "COMPLETION_PENDING"
  | "AWAITING_COMPLETION_RESPONSE"
  | "VERIFIED"
  | "DISPUTED"
  | "AWAITING_HUMAN_REVIEW";

export type IncidentEvent =
  | { readonly type: "CAPTURE_INPUT" }
  | { readonly type: "PREPARE_TRANSCRIPT" }
  | { readonly type: "CONFIRM_TRANSCRIPT" }
  | { readonly type: "RETRY_INPUT" }
  | { readonly type: "REVISE_TRANSCRIPT" }
  | { readonly type: "REQUEST_TASK_REVIEW" }
  | { readonly type: "OFFER_CANDIDATES" }
  | { readonly type: "ABSTAIN_TO_REVIEW" }
  | { readonly type: "CONFIRM_TASK" }
  | { readonly type: "RESOLVE_POLICY" }
  | { readonly type: "SEND_TO_CUSTOMER" }
  | { readonly type: "CUSTOMER_APPROVES" }
  | { readonly type: "CUSTOMER_DECLINES" }
  | { readonly type: "CUSTOMER_REPORTS_MISMATCH" }
  | { readonly type: "START_ACTION" }
  | { readonly type: "ACTION_SUCCEEDS" }
  | { readonly type: "ACTION_FAILS" }
  | { readonly type: "ACTION_ABORTS" }
  | { readonly type: "ACTION_REQUIRES_RECONCILIATION" }
  | { readonly type: "MARK_COMPLETION_PENDING" }
  | { readonly type: "SUBMIT_COMPLETION" }
  | { readonly type: "CUSTOMER_ACKNOWLEDGES" }
  | { readonly type: "CUSTOMER_RAISES_ISSUE" }
  | { readonly type: "REQUIRE_COMPLETION_REVIEW" };

export interface TransitionContext {
  readonly hasConfirmedTranscript?: boolean;
}

export interface TransitionResult {
  readonly nextStatus: IncidentStatus;
  readonly auditEvent:
    | "input_captured"
    | "transcript_ready"
    | "transcript_confirmed"
    | "input_retry_requested"
    | "transcript_revision_requested"
    | "task_candidates_offered"
    | "human_review_requested"
    | "task_confirmed"
    | "policy_resolved"
    | "sent_to_customer"
    | "customer_approved"
    | "customer_declined"
    | "customer_reported_mismatch"
    | "action_started"
    | "action_executed"
    | "action_failed"
    | "action_aborted"
    | "action_reconciliation_required"
    | "completion_pending"
    | "completion_submitted"
    | "customer_acknowledged"
    | "customer_raised_issue"
    | "completion_review_required";
}

export class InvalidIncidentTransitionError extends Error {
  constructor(current: IncidentStatus, event: IncidentEvent["type"]) {
    super(`Cannot apply ${event} while incident is ${current}.`);
    this.name = "InvalidIncidentTransitionError";
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled incident state: ${String(value)}`);
}

export function transitionIncident(
  current: IncidentStatus,
  event: IncidentEvent,
  context: TransitionContext,
): TransitionResult {
  switch (current) {
    case "DRAFT":
      if (event.type === "CAPTURE_INPUT")
        return { nextStatus: "INPUT_CAPTURED", auditEvent: "input_captured" };
      break;
    case "INPUT_CAPTURED":
      if (event.type === "PREPARE_TRANSCRIPT")
        return {
          nextStatus: "TRANSCRIPT_READY",
          auditEvent: "transcript_ready",
        };
      break;
    case "TRANSCRIPT_READY":
      if (event.type === "RETRY_INPUT")
        return {
          nextStatus: "DRAFT",
          auditEvent: "input_retry_requested",
        };
      if (event.type === "CONFIRM_TRANSCRIPT")
        return {
          nextStatus: "TRANSCRIPT_CONFIRMED",
          auditEvent: "transcript_confirmed",
        };
      break;
    case "TRANSCRIPT_CONFIRMED":
      if (event.type === "OFFER_CANDIDATES")
        return {
          nextStatus: "TASK_CONFIRMATION_REQUIRED",
          auditEvent: "task_candidates_offered",
        };
      if (event.type === "ABSTAIN_TO_REVIEW")
        return {
          nextStatus: "AWAITING_HUMAN_REVIEW",
          auditEvent: "human_review_requested",
        };
      break;
    case "TASK_CONFIRMATION_REQUIRED":
      if (event.type === "REVISE_TRANSCRIPT")
        return {
          nextStatus: "TRANSCRIPT_READY",
          auditEvent: "transcript_revision_requested",
        };
      if (event.type === "REQUEST_TASK_REVIEW")
        return {
          nextStatus: "AWAITING_HUMAN_REVIEW",
          auditEvent: "human_review_requested",
        };
      if (event.type === "CONFIRM_TASK" && context.hasConfirmedTranscript)
        return { nextStatus: "TASK_CONFIRMED", auditEvent: "task_confirmed" };
      break;
    case "TASK_CONFIRMED":
      if (event.type === "RESOLVE_POLICY")
        return { nextStatus: "DECISION_READY", auditEvent: "policy_resolved" };
      break;
    case "DECISION_READY":
      if (event.type === "SEND_TO_CUSTOMER")
        return {
          nextStatus: "AWAITING_CUSTOMER",
          auditEvent: "sent_to_customer",
        };
      break;
    case "AWAITING_CUSTOMER":
      if (event.type === "CUSTOMER_APPROVES")
        return {
          nextStatus: "ACTION_AUTHORISED",
          auditEvent: "customer_approved",
        };
      if (event.type === "CUSTOMER_DECLINES")
        return {
          nextStatus: "COMPLETION_PENDING",
          auditEvent: "customer_declined",
        };
      if (event.type === "CUSTOMER_REPORTS_MISMATCH")
        return {
          nextStatus: "AWAITING_HUMAN_REVIEW",
          auditEvent: "customer_reported_mismatch",
        };
      break;
    case "ACTION_AUTHORISED":
      if (event.type === "START_ACTION")
        return { nextStatus: "ACTION_EXECUTING", auditEvent: "action_started" };
      if (event.type === "ACTION_REQUIRES_RECONCILIATION")
        return { nextStatus: "AWAITING_HUMAN_REVIEW", auditEvent: "action_reconciliation_required" };
      break;
    case "ACTION_EXECUTING":
      if (event.type === "ACTION_SUCCEEDS")
        return { nextStatus: "ACTION_EXECUTED", auditEvent: "action_executed" };
      if (event.type === "ACTION_FAILS")
        return { nextStatus: "ACTION_AUTHORISED", auditEvent: "action_failed" };
      if (event.type === "ACTION_ABORTS")
        return { nextStatus: "COMPLETION_PENDING", auditEvent: "action_aborted" };
      if (event.type === "ACTION_REQUIRES_RECONCILIATION")
        return { nextStatus: "AWAITING_HUMAN_REVIEW", auditEvent: "action_reconciliation_required" };
      break;
    case "ACTION_EXECUTED":
      if (event.type === "MARK_COMPLETION_PENDING")
        return {
          nextStatus: "COMPLETION_PENDING",
          auditEvent: "completion_pending",
        };
      break;
    case "COMPLETION_PENDING":
      if (event.type === "SUBMIT_COMPLETION")
        return {
          nextStatus: "AWAITING_COMPLETION_RESPONSE",
          auditEvent: "completion_submitted",
        };
      break;
    case "AWAITING_COMPLETION_RESPONSE":
      if (event.type === "CUSTOMER_ACKNOWLEDGES")
        return { nextStatus: "VERIFIED", auditEvent: "customer_acknowledged" };
      if (event.type === "CUSTOMER_RAISES_ISSUE")
        return { nextStatus: "DISPUTED", auditEvent: "customer_raised_issue" };
      if (event.type === "REQUIRE_COMPLETION_REVIEW")
        return {
          nextStatus: "AWAITING_HUMAN_REVIEW",
          auditEvent: "completion_review_required",
        };
      break;
    case "VERIFIED":
    case "DISPUTED":
    case "AWAITING_HUMAN_REVIEW":
      break;
    default:
      return assertNever(current);
  }
  throw new InvalidIncidentTransitionError(current, event.type);
}
