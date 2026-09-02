import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { captureContactHandler, completeDeliveryHandler, dismissCheckpointHandler, getByResultTokenHandler, getCheckpointHandler, reserveDeliveryHandler } from "./privateDemoResultSupport";

const access = { publicRunId: v.string(), browserTokenHash: v.string() };
export const getCheckpoint = query({ args: { ...access, stage: v.union(v.literal("DECISION"), v.literal("COMPLETION")) }, handler: getCheckpointHandler });
export const dismissCheckpoint = mutation({ args: { ...access, stage: v.union(v.literal("DECISION"), v.literal("COMPLETION")) }, handler: dismissCheckpointHandler });
export const captureContact = mutation({ args: { ...access, contact: v.string(), invitationConsent: v.boolean() }, handler: captureContactHandler });
export const reserveDelivery = mutation({ args: { ...access, browserRateKey: v.string(), resultTokenHash: v.string() }, handler: reserveDeliveryHandler });
export const completeDelivery = mutation({ args: { ...access, deliveryId: v.id("demoDeliveries"), status: v.union(v.literal("DELIVERED"), v.literal("FAILED")), provider: v.optional(v.string()), providerMessageId: v.optional(v.string()), acceptedAt: v.optional(v.string()), errorCode: v.optional(v.string()), errorMessage: v.optional(v.string()) }, handler: completeDeliveryHandler });
export const getByResultToken = query({ args: { tokenHash: v.string() }, handler: getByResultTokenHandler });
