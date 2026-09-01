import { describe, expect, it } from "vitest";

import {
  InvalidIncidentTransitionError,
  transitionIncident,
  type IncidentEvent,
  type IncidentStatus,
} from "./incident-state";

describe("transitionIncident", () => {
  it.each<{
    current: IncidentStatus;
    event: IncidentEvent;
    nextStatus: IncidentStatus;
    auditEvent: string;
  }>([
    {
      current: "DRAFT",
      event: { type: "CAPTURE_INPUT" },
      nextStatus: "INPUT_CAPTURED",
      auditEvent: "input_captured",
    },
    {
      current: "INPUT_CAPTURED",
      event: { type: "PREPARE_TRANSCRIPT" },
      nextStatus: "TRANSCRIPT_READY",
      auditEvent: "transcript_ready",
    },
    {
      current: "TRANSCRIPT_READY",
      event: { type: "CONFIRM_TRANSCRIPT" },
      nextStatus: "TRANSCRIPT_CONFIRMED",
      auditEvent: "transcript_confirmed",
    },
    {
      current: "TRANSCRIPT_CONFIRMED",
      event: { type: "OFFER_CANDIDATES" },
      nextStatus: "TASK_CONFIRMATION_REQUIRED",
      auditEvent: "task_candidates_offered",
    },
    {
      current: "TRANSCRIPT_CONFIRMED",
      event: { type: "ABSTAIN_TO_REVIEW" },
      nextStatus: "AWAITING_HUMAN_REVIEW",
      auditEvent: "human_review_requested",
    },
    {
      current: "TASK_CONFIRMATION_REQUIRED",
      event: { type: "CONFIRM_TASK" },
      nextStatus: "TASK_CONFIRMED",
      auditEvent: "task_confirmed",
    },
    {
      current: "TASK_CONFIRMED",
      event: { type: "RESOLVE_POLICY" },
      nextStatus: "DECISION_READY",
      auditEvent: "policy_resolved",
    },
    {
      current: "DECISION_READY",
      event: { type: "SEND_TO_CUSTOMER" },
      nextStatus: "AWAITING_CUSTOMER",
      auditEvent: "sent_to_customer",
    },
    {
      current: "AWAITING_CUSTOMER",
      event: { type: "CUSTOMER_APPROVES" },
      nextStatus: "ACTION_AUTHORISED",
      auditEvent: "customer_approved",
    },
    {
      current: "AWAITING_CUSTOMER",
      event: { type: "CUSTOMER_DECLINES" },
      nextStatus: "COMPLETION_PENDING",
      auditEvent: "customer_declined",
    },
    {
      current: "AWAITING_CUSTOMER",
      event: { type: "CUSTOMER_REPORTS_MISMATCH" },
      nextStatus: "AWAITING_HUMAN_REVIEW",
      auditEvent: "customer_reported_mismatch",
    },
    {
      current: "ACTION_AUTHORISED",
      event: { type: "START_ACTION" },
      nextStatus: "ACTION_EXECUTING",
      auditEvent: "action_started",
    },
    {
      current: "ACTION_EXECUTING",
      event: { type: "ACTION_SUCCEEDS" },
      nextStatus: "ACTION_EXECUTED",
      auditEvent: "action_executed",
    },
    {
      current: "ACTION_EXECUTED",
      event: { type: "MARK_COMPLETION_PENDING" },
      nextStatus: "COMPLETION_PENDING",
      auditEvent: "completion_pending",
    },
    {
      current: "ACTION_EXECUTING",
      event: { type: "ACTION_FAILS" },
      nextStatus: "ACTION_AUTHORISED",
      auditEvent: "action_failed",
    },
    {
      current: "ACTION_EXECUTING",
      event: { type: "ACTION_ABORTS" },
      nextStatus: "COMPLETION_PENDING",
      auditEvent: "action_aborted",
    },
    {
      current: "ACTION_AUTHORISED",
      event: { type: "ACTION_REQUIRES_RECONCILIATION" },
      nextStatus: "AWAITING_HUMAN_REVIEW",
      auditEvent: "action_reconciliation_required",
    },
    {
      current: "TRANSCRIPT_READY",
      event: { type: "RETRY_INPUT" },
      nextStatus: "DRAFT",
      auditEvent: "input_retry_requested",
    },
    {
      current: "TASK_CONFIRMATION_REQUIRED",
      event: { type: "REVISE_TRANSCRIPT" },
      nextStatus: "TRANSCRIPT_READY",
      auditEvent: "transcript_revision_requested",
    },
    {
      current: "TASK_CONFIRMATION_REQUIRED",
      event: { type: "REQUEST_TASK_REVIEW" },
      nextStatus: "AWAITING_HUMAN_REVIEW",
      auditEvent: "human_review_requested",
    },
  ])(
    "moves $current to $nextStatus",
    ({ current, event, nextStatus, auditEvent }) => {
      expect(
        transitionIncident(current, event, {
          hasConfirmedTranscript: event.type === "CONFIRM_TASK",
        }),
      ).toEqual({ nextStatus, auditEvent });
    },
  );

  it("rejects task confirmation without a confirmed transcript", () => {
    expect(() =>
      transitionIncident(
        "TASK_CONFIRMATION_REQUIRED",
        { type: "CONFIRM_TASK" },
        { hasConfirmedTranscript: false },
      ),
    ).toThrow(InvalidIncidentTransitionError);
  });

  it("rejects undefined transitions without changing state", () => {
    expect(() =>
      transitionIncident("DRAFT", { type: "CONFIRM_TASK" }, {}),
    ).toThrow("Cannot apply CONFIRM_TASK while incident is DRAFT.");
  });

  it("rejects policy resolution before task confirmation", () => {
    expect(() =>
      transitionIncident("TASK_CONFIRMATION_REQUIRED", { type: "RESOLVE_POLICY" }, {}),
    ).toThrow("Cannot apply RESOLVE_POLICY while incident is TASK_CONFIRMATION_REQUIRED.");
  });

  it.each([
    ["DRAFT", "SEND_TO_CUSTOMER"],
    ["DECISION_READY", "CUSTOMER_APPROVES"],
    ["ACTION_AUTHORISED", "CUSTOMER_DECLINES"],
    ["ACTION_EXECUTING", "START_ACTION"],
    ["ACTION_EXECUTED", "ACTION_FAILS"],
    ["COMPLETION_PENDING", "CUSTOMER_REPORTS_MISMATCH"],
  ] as const)("rejects %s -> %s", (current, type) => {
    expect(() =>
      transitionIncident(current, { type }, {}),
    ).toThrow(InvalidIncidentTransitionError);
  });
});
