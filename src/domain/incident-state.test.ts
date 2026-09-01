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
});
