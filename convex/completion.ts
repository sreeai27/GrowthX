import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { getForCustomerHandler, getHandler, respondAsCustomerHandler, submitWorkerSummaryHandler } from "./completionSupport";

const workerArgs = { publicRunId: v.string(), browserTokenHash: v.string(), incidentKey: v.string() };
const completionInput = v.object({
  bookingVersion: v.number(),
  taskStates: v.array(v.object({
    taskId: v.string(),
    state: v.union(v.literal("COMPLETE"), v.literal("BLOCKED")),
  })),
  note: v.optional(v.string()),
});
const customerInput = v.object({
  response: v.union(v.literal("ACKNOWLEDGE"), v.literal("RAISE_ISSUE")),
  note: v.optional(v.string()),
});

export const get = mutation({ args: workerArgs, handler: getHandler });
export const submitWorkerSummary = mutation({ args: { ...workerArgs, input: completionInput }, handler: submitWorkerSummaryHandler });
export const getForCustomer = mutation({ args: { tokenHash: v.string() }, handler: getForCustomerHandler });
export const respondAsCustomer = mutation({ args: { tokenHash: v.string(), input: customerInput }, handler: respondAsCustomerHandler });
