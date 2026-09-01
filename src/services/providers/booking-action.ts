import {
  actionExecutionRequestSchema,
  actionReceiptSchema,
  type ActionExecutionRequest,
  type ActionReceipt,
} from "../../domain/action-execution";
import { z } from "zod";

export interface BookingActionConnector {
  execute(request: ActionExecutionRequest): Promise<ActionReceipt>;
  getStoredReceipt?(idempotencyKey: string): ActionReceipt | null;
}

export async function executeWithOutput(
  input: ActionExecutionRequest,
  output: unknown,
): Promise<ActionReceipt> {
  const request = actionExecutionRequestSchema.parse(input);
  const receipt = actionReceiptSchema.parse(output);
  if (
    receipt.idempotencyKey !== request.idempotencyKey ||
    receipt.requestHash !== request.requestHash ||
    receipt.previousBookingVersion !== request.bookingVersion ||
    receipt.resultingBookingVersion !== request.bookingVersion + 1 ||
    receipt.actionType !== request.action.type
  ) {
    throw new Error("Connector receipt does not match the action request.");
  }
  return receipt;
}

export const mockBookingActionFailureModeSchema = z.enum([
  "TRANSIENT_BEFORE_COMMIT",
  "TIMEOUT_AFTER_COMMIT",
  "PERMANENT_REJECTION",
]);
export type MockBookingActionFailureMode = z.infer<
  typeof mockBookingActionFailureModeSchema
>;

export class BookingActionConnectorError extends Error {
  constructor(
    readonly code: MockBookingActionFailureMode,
    readonly retryable: boolean,
    readonly outcomeUncertain: boolean,
  ) {
    super(`Demonstration connector failed: ${code}.`);
    this.name = "BookingActionConnectorError";
  }
}

const mockBookingActionOptionsSchema = z
  .object({ failureMode: mockBookingActionFailureModeSchema.optional() })
  .strict();

export class MockBookingActionConnector implements BookingActionConnector {
  readonly #receipts = new Map<string, ActionReceipt>();
  readonly #inFlight = new Map<string, Promise<ActionReceipt>>();
  #mutationCount = 0;
  readonly #failureMode?: MockBookingActionFailureMode;
  #oneShotFailureUsed = false;

  constructor(options: { failureMode?: MockBookingActionFailureMode } = {}) {
    this.#failureMode = mockBookingActionOptionsSchema.parse(options).failureMode;
  }

  get mutationCount(): number {
    return this.#mutationCount;
  }

  getStoredReceipt(idempotencyKey: string): ActionReceipt | null {
    return this.#receipts.get(idempotencyKey) ?? null;
  }

  async execute(input: ActionExecutionRequest): Promise<ActionReceipt> {
    const request = actionExecutionRequestSchema.parse(input);
    const stored = this.#receipts.get(request.idempotencyKey);
    if (stored) return stored;

    const active = this.#inFlight.get(request.idempotencyKey);
    if (active) return active;

    const execution = this.#perform(request);
    this.#inFlight.set(request.idempotencyKey, execution);
    try {
      return await execution;
    } finally {
      if (this.#inFlight.get(request.idempotencyKey) === execution) {
        this.#inFlight.delete(request.idempotencyKey);
      }
    }
  }

  async #perform(request: ActionExecutionRequest): Promise<ActionReceipt> {
    if (this.#failureMode === "PERMANENT_REJECTION") {
      throw new BookingActionConnectorError(
        "PERMANENT_REJECTION",
        false,
        false,
      );
    }
    if (
      this.#failureMode === "TRANSIENT_BEFORE_COMMIT" &&
      !this.#oneShotFailureUsed
    ) {
      this.#oneShotFailureUsed = true;
      throw new BookingActionConnectorError(
        "TRANSIENT_BEFORE_COMMIT",
        true,
        false,
      );
    }

    const suffix = request.idempotencyKey.slice(0, 16).toUpperCase();
    const receipt = await executeWithOutput(request, {
      actionExecutionId: `EXEC-DEMO-${suffix}`,
      connector: "DEMONSTRATION_CONNECTOR",
      idempotencyKey: request.idempotencyKey,
      externalActionId: `ACT-DEMO-${suffix}`,
      requestHash: request.requestHash,
      previousBookingVersion: request.bookingVersion,
      resultingBookingVersion: request.bookingVersion + 1,
      actionType: request.action.type,
      status: "SUCCEEDED",
      executedAt: new Date().toISOString(),
    });

    this.#receipts.set(request.idempotencyKey, receipt);
    this.#mutationCount += 1;
    if (
      this.#failureMode === "TIMEOUT_AFTER_COMMIT" &&
      !this.#oneShotFailureUsed
    ) {
      this.#oneShotFailureUsed = true;
      throw new BookingActionConnectorError("TIMEOUT_AFTER_COMMIT", true, true);
    }
    return receipt;
  }
}
