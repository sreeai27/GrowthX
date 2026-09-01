export type IncidentStatus =
  | "DRAFT"
  | "INPUT_CAPTURED"
  | "TRANSCRIPT_READY"
  | "TRANSCRIPT_CONFIRMED"
  | "TASK_CONFIRMATION_REQUIRED"
  | "TASK_CONFIRMED"
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
  | { readonly type: "CONFIRM_TASK" };

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
    | "task_confirmed";
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
    case "AWAITING_HUMAN_REVIEW":
      break;
    default:
      return assertNever(current);
  }
  throw new InvalidIncidentTransitionError(current, event.type);
}
