import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  getPolicyDecisionHandler,
  resolvePolicyDecisionHandler,
} from "./policyDecisionSupport";

const accessArgs = {
  publicRunId: v.string(),
  browserTokenHash: v.string(),
  incidentKey: v.string(),
};

export const resolvePolicyDecision = mutation({
  args: accessArgs,
  handler: resolvePolicyDecisionHandler,
});

export const getPolicyDecision = query({
  args: accessArgs,
  handler: getPolicyDecisionHandler,
});
