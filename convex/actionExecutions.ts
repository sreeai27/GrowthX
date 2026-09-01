import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { makeFunctionReference } from "convex/server";
import { actionExecutionRequestSchema, actionReceiptSchema } from "../src/domain/action-execution";
import { z } from "zod";
import { executeMockConnectorHandler, failHandler, finalizeHandler, reserveHandler } from "./actionExecutionSupport";

const actionExecutionViewSchema = z.object({
  status: z.enum(["PENDING", "SUCCEEDED", "RETRYABLE_FAILED", "PERMANENT_FAILED", "RECONCILIATION_REQUIRED"]),
  attemptCount: z.number().int().positive(),
  receipt: actionReceiptSchema.pick({
    connector: true,
    externalActionId: true,
    previousBookingVersion: true,
    resultingBookingVersion: true,
    status: true,
    executedAt: true,
  }).nullable(),
  error: z.object({ code: z.string(), message: z.string() }).strict().nullable(),
}).strict();

const reserveRef = makeFunctionReference<"mutation", { tokenHash: string }, unknown>("actionExecutions:reserve");
const finalizeRef = makeFunctionReference<"mutation", { tokenHash: string; receipt: unknown }, unknown>("actionExecutions:finalize");
const failRef = makeFunctionReference<"mutation", { tokenHash: string; code: string; message: string; retryable: boolean }, unknown>("actionExecutions:fail");
const executeConnectorRef = makeFunctionReference<"mutation", { request: unknown }, unknown>("actionExecutions:executeMockConnector");

export const reserve = internalMutation({ args: { tokenHash: v.string() }, handler: reserveHandler });
export const finalize = internalMutation({ args: { tokenHash: v.string(), receipt: v.any() }, handler: finalizeHandler });
export const fail = internalMutation({ args: { tokenHash: v.string(), code: v.string(), message: v.string(), retryable: v.boolean() }, handler: failHandler });
export const executeMockConnector = internalMutation({ args: { request: v.any() }, handler: executeMockConnectorHandler });

export const execute = action({
  args: { tokenHash: v.string() },
  handler: async (context, { tokenHash }) => {
    const reservation = z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("EXECUTE"), request: actionExecutionRequestSchema }).strict(),
      z.object({ kind: z.literal("STORED"), execution: actionExecutionViewSchema }).strict(),
    ]).parse(await context.runMutation(reserveRef, { tokenHash }));
    if (reservation.kind === "STORED") return actionExecutionViewSchema.parse(reservation.execution);
    const request = actionExecutionRequestSchema.parse(reservation.request);
    let receipt;
    try {
      receipt = actionReceiptSchema.parse(await context.runMutation(executeConnectorRef, { request }));
    } catch (error) {
      return actionExecutionViewSchema.parse(await context.runMutation(failRef, {
        tokenHash,
        code: "INVALID_CONNECTOR_RESULT",
        message: error instanceof Error ? error.message : "The connector returned an invalid result.",
        retryable: false,
      }));
    }
    try {
      return actionExecutionViewSchema.parse(await context.runMutation(finalizeRef, { tokenHash, receipt }));
    } catch (error) {
      return actionExecutionViewSchema.parse(await context.runMutation(failRef, {
        tokenHash,
        code: "FINALIZATION_PENDING",
        message: error instanceof Error ? error.message : "The stored connector result still needs reconciliation.",
        retryable: true,
      }));
    }
  },
});
