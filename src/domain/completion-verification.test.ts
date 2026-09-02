import { describe, expect, it } from "vitest";

import {
  completionSummaryInputSchema,
  computeVerification,
  customerCompletionResponseSchema,
  resolveCustomerCompletionResponse,
  validateWorkerCompletion,
  verificationResultSchema,
  workerTaskStateSchema,
} from "./completion-verification";

const completeTasks = [
  { taskId: "kitchen_surface_cleaning", state: "COMPLETE" as const },
  { taskId: "balcony_deep_cleaning", state: "COMPLETE" as const },
];
const kitchenComplete = {
  taskId: "kitchen_surface_cleaning",
  state: "COMPLETE" as const,
};
const balconyComplete = {
  taskId: "balcony_deep_cleaning",
  state: "COMPLETE" as const,
};

describe("computeVerification", () => {
  it("Q01 verifies an acknowledged final agreement with its required receipt", () => {
    expect(
      computeVerification({
        agreedTaskIds: [
          "kitchen_surface_cleaning",
          "balcony_deep_cleaning",
        ],
        workerTaskStates: [
          { taskId: "kitchen_surface_cleaning", state: "COMPLETE" },
          { taskId: "balcony_deep_cleaning", state: "COMPLETE" },
        ],
        requiredReceiptMatches: true,
        customerResponse: "ACKNOWLEDGE",
        unresolvedReview: false,
      }),
    ).toMatchObject({ state: "VERIFIED", reviewerRequired: false });
  });

  it("Q02 cannot verify when a required action receipt does not match", () => {
    expect(
      computeVerification({
        agreedTaskIds: completeTasks.map(({ taskId }) => taskId),
        workerTaskStates: completeTasks,
        requiredReceiptMatches: false,
        customerResponse: "ACKNOWLEDGE",
        unresolvedReview: false,
      }),
    ).toEqual({ state: "CANNOT_VERIFY", reviewerRequired: true });
  });

  it("Q03 disputes a customer issue and requires human review", () => {
    expect(
      computeVerification({
        agreedTaskIds: completeTasks.map(({ taskId }) => taskId),
        workerTaskStates: completeTasks,
        requiredReceiptMatches: true,
        customerResponse: "RAISE_ISSUE",
        unresolvedReview: false,
      }),
    ).toEqual({ state: "DISPUTED", reviewerRequired: true });
  });

  it("Q07 cannot verify a deterministic customer timeout and requires review", () => {
    expect(
      computeVerification({
        agreedTaskIds: completeTasks.map(({ taskId }) => taskId),
        workerTaskStates: completeTasks,
        requiredReceiptMatches: true,
        customerResponse: "TIMED_OUT",
        unresolvedReview: false,
      }),
    ).toEqual({ state: "CANNOT_VERIFY", reviewerRequired: true });
  });

  it("Q04 sends a worker blocker to review without a failure state", () => {
    expect(
      computeVerification({
        agreedTaskIds: completeTasks.map(({ taskId }) => taskId),
        workerTaskStates: [
          kitchenComplete,
          { taskId: balconyComplete.taskId, state: "BLOCKED" },
        ],
        requiredReceiptMatches: true,
        customerResponse: "ACKNOWLEDGE",
        unresolvedReview: false,
      }),
    ).toEqual({ state: "REVIEW_REQUIRED", reviewerRequired: true });
  });

  it("Q06 verifies without photo evidence", () => {
    const input = {
      agreedTaskIds: completeTasks.map(({ taskId }) => taskId),
      workerTaskStates: completeTasks,
      requiredReceiptMatches: true,
      customerResponse: "ACKNOWLEDGE" as const,
      unresolvedReview: false,
    };
    expect(input).not.toHaveProperty("photo");
    expect(computeVerification(input).state).toBe("VERIFIED");
  });

  it("verifies a preserved-original agreement without inventing a receipt", () => {
    expect(
      computeVerification({
        agreedTaskIds: completeTasks.map(({ taskId }) => taskId),
        workerTaskStates: completeTasks,
        receiptRequired: false,
        requiredReceiptMatches: false,
        customerResponse: "ACKNOWLEDGE",
        unresolvedReview: false,
      }),
    ).toEqual({ state: "VERIFIED", reviewerRequired: false });
  });

  it("requires review while an earlier review remains unresolved", () => {
    expect(
      computeVerification({
        agreedTaskIds: completeTasks.map(({ taskId }) => taskId),
        workerTaskStates: completeTasks,
        requiredReceiptMatches: true,
        customerResponse: "ACKNOWLEDGE",
        unresolvedReview: true,
      }),
    ).toEqual({ state: "REVIEW_REQUIRED", reviewerRequired: true });
  });
});

describe("validateWorkerCompletion", () => {
  it("accepts exactly one state for every final-agreement task", () => {
    expect(
      validateWorkerCompletion({
        finalBookingVersion: 3,
        submittedBookingVersion: 3,
        agreedTaskIds: completeTasks.map(({ taskId }) => taskId),
        workerTaskStates: completeTasks,
      }),
    ).toEqual({ valid: true });
  });

  it("Q05 rejects a completion against a stale booking version", () => {
    expect(
      validateWorkerCompletion({
        finalBookingVersion: 3,
        submittedBookingVersion: 2,
        agreedTaskIds: completeTasks.map(({ taskId }) => taskId),
        workerTaskStates: completeTasks,
      }),
    ).toEqual({ valid: false, reason: "STALE_BOOKING_VERSION" });
  });

  it.each([
    ["missing", [kitchenComplete]],
    ["extra", [...completeTasks, { taskId: "bathroom", state: "COMPLETE" as const }]],
    ["duplicate", [kitchenComplete, kitchenComplete]],
  ])("rejects a %s task state", (_case, workerTaskStates) => {
    expect(
      validateWorkerCompletion({
        finalBookingVersion: 3,
        submittedBookingVersion: 3,
        agreedTaskIds: completeTasks.map(({ taskId }) => taskId),
        workerTaskStates,
      }),
    ).toEqual({ valid: false, reason: "TASK_SET_MISMATCH" });
  });
});

describe("completion input and idempotency", () => {
  it("validates bounded, structured worker and customer inputs", () => {
    expect(workerTaskStateSchema.parse(kitchenComplete)).toEqual(kitchenComplete);
    expect(
      completionSummaryInputSchema.parse({ bookingVersion: 3, taskStates: completeTasks }),
    ).toMatchObject({ bookingVersion: 3 });
    expect(customerCompletionResponseSchema.parse({ response: "ACKNOWLEDGE" })).toEqual({
      response: "ACKNOWLEDGE",
    });
    expect(
      verificationResultSchema.parse({ state: "VERIFIED", reviewerRequired: false }),
    ).toEqual({ state: "VERIFIED", reviewerRequired: false });
  });

  it("returns an identical duplicate customer response", () => {
    expect(resolveCustomerCompletionResponse("ACKNOWLEDGE", "ACKNOWLEDGE")).toBe(
      "ACKNOWLEDGE",
    );
  });

  it("rejects a conflicting customer response", () => {
    expect(() =>
      resolveCustomerCompletionResponse("ACKNOWLEDGE", "RAISE_ISSUE"),
    ).toThrow("conflicts with the stored response");
  });
});
