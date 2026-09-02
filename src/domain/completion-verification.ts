import { z } from "zod";

export const workerTaskStateSchema = z
  .object({
    taskId: z.string().trim().min(1),
    state: z.enum(["COMPLETE", "BLOCKED"]),
  })
  .strict();

export const completionSummaryInputSchema = z
  .object({
    bookingVersion: z.number().int().positive(),
    taskStates: z.array(workerTaskStateSchema).min(1),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const customerCompletionResponseSchema = z
  .object({
    response: z.enum(["ACKNOWLEDGE", "RAISE_ISSUE"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const verificationResultSchema = z
  .object({
    state: z.enum([
      "VERIFIED",
      "DISPUTED",
      "REVIEW_REQUIRED",
      "CANNOT_VERIFY",
    ]),
    reviewerRequired: z.boolean(),
  })
  .strict();

export type WorkerTaskState = z.infer<typeof workerTaskStateSchema>;
export type CustomerCompletionResponse = z.infer<
  typeof customerCompletionResponseSchema
>["response"];
export type CustomerCompletionOutcome = CustomerCompletionResponse | "TIMED_OUT";
export type VerificationResult = z.infer<typeof verificationResultSchema>;

export interface WorkerCompletionValidationInput {
  readonly finalBookingVersion: number;
  readonly submittedBookingVersion: number;
  readonly agreedTaskIds: readonly string[];
  readonly workerTaskStates: readonly WorkerTaskState[];
}

export type WorkerCompletionValidation =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly reason: "STALE_BOOKING_VERSION" | "TASK_SET_MISMATCH";
    };

export function validateWorkerCompletion(
  input: WorkerCompletionValidationInput,
): WorkerCompletionValidation {
  if (input.submittedBookingVersion !== input.finalBookingVersion) {
    return { valid: false, reason: "STALE_BOOKING_VERSION" };
  }

  const expected = new Set(input.agreedTaskIds);
  const submitted = new Set(input.workerTaskStates.map(({ taskId }) => taskId));
  if (
    expected.size !== input.agreedTaskIds.length ||
    submitted.size !== input.workerTaskStates.length ||
    expected.size !== submitted.size ||
    [...expected].some((taskId) => !submitted.has(taskId))
  ) {
    return { valid: false, reason: "TASK_SET_MISMATCH" };
  }

  return { valid: true };
}

export interface ComputeVerificationInput {
  readonly agreedTaskIds: readonly string[];
  readonly workerTaskStates: readonly WorkerTaskState[];
  readonly requiredReceiptMatches: boolean;
  readonly receiptRequired?: boolean;
  readonly customerResponse: CustomerCompletionOutcome;
  readonly unresolvedReview: boolean;
}

export function computeVerification(
  input: ComputeVerificationInput,
): VerificationResult {
  const taskSet = validateWorkerCompletion({
    finalBookingVersion: 1,
    submittedBookingVersion: 1,
    agreedTaskIds: input.agreedTaskIds,
    workerTaskStates: input.workerTaskStates,
  });
  if (
    !taskSet.valid ||
    (input.receiptRequired !== false && !input.requiredReceiptMatches)
  ) {
    return { state: "CANNOT_VERIFY", reviewerRequired: true };
  }
  if (input.customerResponse === "RAISE_ISSUE") {
    return { state: "DISPUTED", reviewerRequired: true };
  }
  if (input.customerResponse === "TIMED_OUT") {
    return { state: "CANNOT_VERIFY", reviewerRequired: true };
  }
  if (
    input.unresolvedReview ||
    input.workerTaskStates.some(({ state }) => state === "BLOCKED")
  ) {
    return { state: "REVIEW_REQUIRED", reviewerRequired: true };
  }
  return { state: "VERIFIED", reviewerRequired: false };
}

export function resolveCustomerCompletionResponse(
  existing: CustomerCompletionResponse | undefined,
  incoming: CustomerCompletionResponse,
): CustomerCompletionResponse {
  if (existing !== undefined && existing !== incoming) {
    throw new Error("Customer completion response conflicts with the stored response.");
  }
  return existing ?? incoming;
}
