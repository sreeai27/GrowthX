import { createHash } from "node:crypto";
import { z } from "zod";

import type { IncidentStatus } from "./incident-state";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const allowedBookingActionSchema = z
  .object({
    type: z.literal("ADD_TASK"),
    taskId: z.string().min(1),
    priceDeltaMinor: z.number().int().nonnegative(),
    durationDeltaMinutes: z.number().int().positive(),
  })
  .strict();
export type AllowedBookingAction = z.infer<typeof allowedBookingActionSchema>;

export const actionExecutionRequestSchema = z
  .object({
    tenantId: z.string().min(1),
    incidentKey: z.string().min(1),
    decisionHash: z.string().min(1),
    bookingKey: z.string().min(1),
    bookingVersion: z.number().int().positive(),
    sourceVersion: z.string().min(1),
    action: allowedBookingActionSchema,
    requestHash: sha256Schema,
    idempotencyKey: sha256Schema,
  })
  .strict();
export type ActionExecutionRequest = z.infer<
  typeof actionExecutionRequestSchema
>;

export const actionReceiptSchema = z
  .object({
    actionExecutionId: z.string().min(1),
    connector: z.literal("DEMONSTRATION_CONNECTOR"),
    idempotencyKey: sha256Schema,
    externalActionId: z.string().min(1),
    requestHash: sha256Schema,
    previousBookingVersion: z.number().int().positive(),
    resultingBookingVersion: z.number().int().positive(),
    actionType: z.literal("ADD_TASK"),
    status: z.literal("SUCCEEDED"),
    executedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type ActionReceipt = z.infer<typeof actionReceiptSchema>;

export interface ActionAuthorityInput {
  readonly tenantId: string;
  readonly incidentKey: string;
  readonly incidentStatus: IncidentStatus;
  readonly bookingKey: string;
  readonly storedBookingVersion: number;
  readonly currentBookingVersion: number;
  readonly storedDecisionHash: string;
  readonly currentDecisionHash: string;
  readonly storedSourceVersion: string;
  readonly currentSourceVersion: string;
  readonly requestConfirmedByCustomer: boolean;
  readonly commercialResponse: "APPROVE" | "DECLINE" | null;
  readonly decisionState:
    | "INCLUDED_CONTINUE"
    | "ADD_ON_APPROVAL_REQUIRED"
    | "TRADE_OFF_REQUIRED"
    | "NOT_SUPPORTED"
    | "SAFETY_ESCALATION";
  readonly supportState:
    | "SUPPORTED"
    | "PARTIALLY_SUPPORTED"
    | "CANNOT_VERIFY"
    | "SOURCE_CONFLICT"
    | "ESCALATED";
  readonly action: AllowedBookingAction;
}

export class ActionNotAuthorisedError extends Error {
  constructor(reason: string) {
    super(`Booking action is not authorised: ${reason}.`);
    this.name = "ActionNotAuthorisedError";
  }
}

const DEMO_ACTION: AllowedBookingAction = {
  type: "ADD_TASK",
  taskId: "balcony_deep_cleaning",
  priceDeltaMinor: 29_900,
  durationDeltaMinutes: 25,
};

export function assertActionAuthorised(input: ActionAuthorityInput): void {
  if (input.incidentStatus !== "ACTION_AUTHORISED")
    throw new ActionNotAuthorisedError("incident status is not current");
  if (!input.requestConfirmedByCustomer)
    throw new ActionNotAuthorisedError("customer did not confirm the request");
  if (input.commercialResponse !== "APPROVE")
    throw new ActionNotAuthorisedError("customer did not approve the change");
  if (input.storedBookingVersion !== input.currentBookingVersion)
    throw new ActionNotAuthorisedError("booking version changed");
  if (input.storedDecisionHash !== input.currentDecisionHash)
    throw new ActionNotAuthorisedError("decision changed");
  if (input.storedSourceVersion !== input.currentSourceVersion)
    throw new ActionNotAuthorisedError("source version changed");
  if (input.decisionState !== "ADD_ON_APPROVAL_REQUIRED")
    throw new ActionNotAuthorisedError("policy does not allow this action");
  if (input.supportState !== "SUPPORTED")
    throw new ActionNotAuthorisedError("decision is not fully supported");

  const action = allowedBookingActionSchema.parse(input.action);
  if (
    action.type !== DEMO_ACTION.type ||
    action.taskId !== DEMO_ACTION.taskId ||
    action.priceDeltaMinor !== DEMO_ACTION.priceDeltaMinor ||
    action.durationDeltaMinutes !== DEMO_ACTION.durationDeltaMinutes
  ) {
    throw new ActionNotAuthorisedError("action differs from the approved demo rule");
  }
}

function canonicalFields(fields: readonly string[]): string {
  return fields.map((field) => `${Buffer.byteLength(field, "utf8")}:${field}`).join("");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildActionExecutionRequest(
  input: ActionAuthorityInput,
): ActionExecutionRequest {
  assertActionAuthorised(input);
  const action = allowedBookingActionSchema.parse(input.action);
  const requestHash = sha256(
    canonicalFields([
      input.tenantId,
      input.incidentKey,
      input.bookingKey,
      String(input.currentBookingVersion),
      input.currentDecisionHash,
      input.currentSourceVersion,
      action.type,
      action.taskId,
      String(action.priceDeltaMinor),
      String(action.durationDeltaMinutes),
    ]),
  );
  const idempotencyKey = sha256(
    canonicalFields([
      input.tenantId,
      input.incidentKey,
      input.currentDecisionHash,
      action.type,
    ]),
  );

  return actionExecutionRequestSchema.parse({
    tenantId: input.tenantId,
    incidentKey: input.incidentKey,
    decisionHash: input.currentDecisionHash,
    bookingKey: input.bookingKey,
    bookingVersion: input.currentBookingVersion,
    sourceVersion: input.currentSourceVersion,
    action,
    requestHash,
    idempotencyKey,
  });
}

export const actionExecutionStatusSchema = z.enum([
  "PENDING",
  "SUCCEEDED",
  "RETRYABLE_FAILED",
  "PERMANENT_FAILED",
  "RECONCILIATION_REQUIRED",
]);
export type ActionExecutionStatus = z.infer<typeof actionExecutionStatusSchema>;
export type ActionRetryDecision =
  | "WAIT"
  | "RETURN_STORED_RECEIPT"
  | "RETRY"
  | "STOP"
  | "ESCALATE";

export function classifyActionRetry(
  status: ActionExecutionStatus,
): ActionRetryDecision {
  switch (status) {
    case "PENDING":
      return "WAIT";
    case "SUCCEEDED":
      return "RETURN_STORED_RECEIPT";
    case "RETRYABLE_FAILED":
      return "RETRY";
    case "PERMANENT_FAILED":
      return "STOP";
    case "RECONCILIATION_REQUIRED":
      return "ESCALATE";
  }
}
