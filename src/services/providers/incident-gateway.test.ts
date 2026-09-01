import { describe, expect, it } from "vitest";

import { workerPolicyDecisionViewSchema } from "./worker-policy-decision";

const supportedDecision = {
  incidentKey: "inc_policy123",
  status: "DECISION_READY",
  booking: {
    bookingKey: "DEMO-4821",
    bookingVersion: 1,
    serviceName: "Essential Home Cleaning",
      scheduledDurationMinutes: 60,
      remainingDurationMinutes: 40,
    catalogVersion: "task-catalog-v1",
    includedTasks: [
      { taskId: "bathroom_cleaning_standard_1", displayName: "One standard bathroom" },
    ],
  },
  selectedTask: {
    taskId: "balcony_deep_cleaning",
    displayName: "Balcony deep cleaning",
    catalogVersion: "task-catalog-v1",
  },
  outcome: {
    decisionState: "ADD_ON_APPROVAL_REQUIRED",
    supportState: "SUPPORTED",
    durationDeltaMinutes: 25,
    priceDeltaMinor: 29_900,
    currency: "INR",
    removableTaskIds: [],
    requirements: {
      customerRequestConfirmation: true,
      customerCommercialApproval: true,
        humanReview: false,
        workerFeasibilityConfirmation: false,
    },
    allowedActions: ["REQUEST_CUSTOMER_APPROVAL", "CONTINUE_ORIGINAL_BOOKING"],
    prohibitedActions: ["CANCEL_BOOKING"],
    explanationKey: "ADD_ON_APPROVAL_REQUIRED",
  },
  authority: {
    sourceKey: "taskconfirm-demo-policy",
    title: "Sahaay TaskConfirm demonstration policy",
    owner: "Sahaay Home Services",
    version: "taskconfirm-demo-v1",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    notice: "Fictional demonstration catalogue data.",
    ruleKey: "balcony-deep-cleaning",
    ruleVersion: "1",
    passage: {
      passageKey: "balcony-deep-cleaning",
      heading: "Balcony deep cleaning",
      text: "Customer approval is required for the add-on.",
    },
  },
  decisionHash: "a".repeat(64),
  createdAt: "2026-09-01T10:00:00.000Z",
} as const;

describe("workerPolicyDecisionViewSchema", () => {
  it("validates the complete source-backed worker decision snapshot", () => {
    expect(workerPolicyDecisionViewSchema.parse(supportedDecision)).toEqual(
      supportedDecision,
    );
  });

  it("rejects a supported outcome without its source evidence", () => {
    expect(() =>
      workerPolicyDecisionViewSchema.parse({
        ...supportedDecision,
        authority: null,
      }),
    ).toThrow();
  });
});
