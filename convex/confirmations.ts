import { v } from "convex/values";

import { mutation } from "./_generated/server";
import {
  confirmRequestHandler,
  createConfirmationHandler,
  getForCustomerHandler,
  getForWorkerHandler,
  respondHandler,
} from "./confirmationSupport";

const workerArgs = {
  publicRunId: v.string(),
  browserTokenHash: v.string(),
  incidentKey: v.string(),
};

export const create = mutation({
  args: {
    ...workerArgs,
    tokenHash: v.string(),
    completionTokenHash: v.string(),
    expiresAt: v.string(),
  },
  handler: createConfirmationHandler,
});

export const getForCustomer = mutation({
  args: { tokenHash: v.string() },
  handler: getForCustomerHandler,
});

export const confirmRequest = mutation({
  args: {
    tokenHash: v.string(),
    answer: v.union(v.literal("YES"), v.literal("MISMATCH")),
  },
  handler: confirmRequestHandler,
});

export const respond = mutation({
  args: {
    tokenHash: v.string(),
    response: v.union(v.literal("APPROVE"), v.literal("DECLINE")),
  },
  handler: respondHandler,
});

export const getForWorker = mutation({
  args: workerArgs,
  handler: getForWorkerHandler,
});
