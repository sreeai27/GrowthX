import { ConvexError, v } from "convex/values";
import type { DataModelFromSchemaDefinition, DocumentByName, GenericMutationCtx, TableNamesInDataModel } from "convex/server";

import { planDemoDeletion } from "../src/domain/demo-retention";
import { retentionDisposition } from "../src/domain/studio-access";
import { demonstrationDeletionConfirmationProvider } from "../src/services/providers/deletion-confirmation";
import { internalMutation, mutation } from "./_generated/server";
import type schema from "./schema";

type Model = DataModelFromSchemaDefinition<typeof schema>;
type MutationContext = GenericMutationCtx<Model>;

const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
async function decryptDeletionContact(ciphertext: string, iv: string, authTag: string) {
  const secret = process.env.DEMO_CONTACT_ENCRYPTION_KEY;
  if (!secret && process.env.NODE_ENV === "production") throw new ConvexError("Deletion confirmation is unavailable.");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret ?? "test-only-private-demo-contact-key"));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const encrypted = new Uint8Array([...decode(ciphertext), ...decode(authTag)]);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv) }, key, encrypted));
}

async function deleteWhere<Table extends TableNamesInDataModel<Model>>(
  context: MutationContext,
  table: Table,
  matches: (row: DocumentByName<Model, Table>) => boolean,
) {
  const rows = await context.db.query(table).collect();
  for (const row of rows) {
    if (matches(row)) await context.db.delete(row._id);
  }
  return rows.filter(matches).length;
}

async function deleteRun(context: MutationContext, runId: string, tenantId: string) {
  const incidents = (await context.db.query("incidents").collect()).filter(
    (row) => row.tenantId === tenantId && String(row.demoRunId) === runId,
  );
  const incidentIds = new Set(incidents.map((row) => String(row._id)));
  const belongsToIncident = (row: { tenantId: string; incidentId: unknown }) =>
    row.tenantId === tenantId && incidentIds.has(String(row.incidentId));

  for (const table of ["verificationEvents", "capabilityEvents", "replayAttempts", "completionSummaries", "actionExecutions", "confirmationRequests", "policyDecisions", "taskConfirmations", "humanReviews", "exceptionInterpretations", "transcriptConfirmations", "transcripts", "traceSteps"] as const) {
    await deleteWhere(context, table, belongsToIncident);
  }
  const media = (await context.db.query("mediaInputs").collect()).filter((row) => belongsToIncident(row));
  for (const row of media) {
    if (row.rawAudioStorageId) await context.storage.delete(row.rawAudioStorageId);
    await context.db.delete(row._id);
  }
  await deleteWhere(context, "replays", belongsToIncident);

  const contacts = (await context.db.query("demoContacts").collect()).filter(
    (row) => row.tenantId === tenantId && String(row.demoRunId) === runId,
  );
  const contactIds = new Set(contacts.map((row) => String(row._id)));
  const accessEvents = (await context.db.query("contactAccessEvents").collect()).filter(
    (row) => row.tenantId === tenantId && contactIds.has(String(row.contactId)),
  );
  for (const event of accessEvents) {
    await context.db.insert("anonymizedContactAccessEvents", {
      tenantId, purpose: event.purpose, occurredAt: event.occurredAt, anonymizedAt: new Date().toISOString(),
    });
    await context.db.delete(event._id);
  }
  const deletionRequests = (await context.db.query("deletionRequests").collect()).filter(
    (row) => row.tenantId === tenantId && String(row.demoRunId) === runId,
  );
  const deletionRequestIds = new Set(deletionRequests.map((row) => String(row._id)));
  await deleteWhere(context, "deletionReviews", (row) =>
    row.tenantId === tenantId && deletionRequestIds.has(String(row.deletionRequestId)),
  );
  for (const row of deletionRequests) await context.db.delete(row._id);
  await deleteWhere(context, "demoDeliveries", (row) =>
    row.tenantId === tenantId && String(row.demoRunId) === runId,
  );
  await deleteWhere(context, "demoResultLinks", (row) =>
    row.tenantId === tenantId && String(row.demoRunId) === runId,
  );
  for (const row of contacts) await context.db.delete(row._id);
  for (const incident of incidents) await context.db.delete(incident._id);
  await context.db.delete(runId as never);
}

async function expireHandler(
  context: MutationContext,
  args: { now?: string; batchLimit?: number },
) {
  const now = args.now ? new Date(args.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new ConvexError("A valid UTC expiry time is required.");
  const batchLimit = Math.max(1, Math.min(args.batchLimit ?? 25, 100));
  const retainedInvitations = await context.db.query("retainedInvitations").collect();
  for (const invitation of retainedInvitations) {
    if (invitation.expiresAt <= now.toISOString()) await context.db.delete(invitation._id);
  }
  const runs = (await context.db.query("demoRuns").collect())
    .filter((run) => retentionDisposition({ createdAt: run.startedAt, now }).disposition === "DELETE_PERSONAL_DATA")
    .slice(0, batchLimit);
  for (const run of runs) {
    const contacts = (await context.db.query("demoContacts").collect()).filter(
      (contact) => contact.tenantId === run.tenantId && contact.demoRunId === run._id,
    );
    for (const contact of contacts) {
      if (!contact.invitationConsent || !contact.invitationExpiresAt || contact.invitationExpiresAt <= now.toISOString() || contact.invitationSentAt) continue;
      const existing = await context.db.query("retainedInvitations").withIndex("by_tenant_contact_hash", (q) => q.eq("tenantId", contact.tenantId).eq("contactLookupHash", contact.contactLookupHash)).unique();
      if (!existing && contact.consentVersion && contact.consentedAt) {
        await context.db.insert("retainedInvitations", {
          tenantId: contact.tenantId, type: contact.type, contactCiphertext: contact.contactCiphertext,
          contactIv: contact.contactIv, contactAuthTag: contact.contactAuthTag, contactLookupHash: contact.contactLookupHash,
          maskedDisplay: contact.maskedDisplay, consentVersion: contact.consentVersion, consentedAt: contact.consentedAt,
          expiresAt: contact.invitationExpiresAt, retainedAt: now.toISOString(),
        });
      }
    }
    await deleteRun(context, String(run._id), run.tenantId);
    await context.db.insert("retentionReceipts", {
      tenantId: run.tenantId,
      receiptType: "EXPIRY",
      anonymousRecordCount: 1,
      completedAt: now.toISOString(),
    });
  }
  return { deletedRuns: runs.length, anonymousRunCount: runs.length };
}

async function requireAdmin(context: MutationContext, tenantId: string, sessionTokenHash: string, now: string) {
  const session = await context.db.query("studioSessions").withIndex("by_session_token_hash", (q) => q.eq("sessionTokenHash", sessionTokenHash)).unique();
  if (!session || session.tenantId !== tenantId || session.revokedAt || session.expiresAt <= now) throw new ConvexError("NOT_AUTHORISED");
  const actor = await context.db.get(session.studioUserId);
  if (!actor || actor.tenantId !== tenantId || actor.role !== "PLATFORM_ADMIN" || actor.status !== "ACTIVE") throw new ConvexError("NOT_AUTHORISED");
  return actor;
}

export const expirePublicDemoRuns = internalMutation({
  args: { now: v.optional(v.string()), batchLimit: v.optional(v.number()) },
  handler: expireHandler,
});

export const reviewDeletion = mutation({
  args: {
    tenantId: v.string(), sessionTokenHash: v.string(), deletionRequestId: v.id("deletionRequests"),
    decision: v.union(v.literal("APPROVE"), v.literal("REFUSE"), v.literal("UNCERTAIN")), reason: v.string(), now: v.string(),
  },
  handler: async (context, args) => {
    const actor = await requireAdmin(context, args.tenantId, args.sessionTokenHash, args.now);
    const request = await context.db.get(args.deletionRequestId);
    if (!request || request.tenantId !== args.tenantId || !args.reason.trim()) throw new ConvexError("A review reason is required.");
    const reviews = (await context.db.query("deletionReviews").withIndex("by_tenant_request", (q) => q.eq("tenantId", args.tenantId)).collect())
      .filter((review) => review.deletionRequestId === request._id);
    if (request.status === "PENDING") {
      await context.db.insert("deletionReviews", { tenantId: args.tenantId, deletionRequestId: request._id, reviewerUserId: actor._id, decision: args.decision, reason: args.reason.trim(), reviewedAt: args.now });
      const status = args.decision === "APPROVE" ? "APPROVED" as const : args.decision === "UNCERTAIN" ? "UNCERTAIN" as const : "REFUSED" as const;
      await context.db.patch(request._id, { status, updatedAt: args.now });
      return { status };
    }
    if (request.status !== "UNCERTAIN" && request.status !== "REFUSED") throw new ConvexError("This deletion request cannot be reviewed.");
    if (reviews.length !== 1) throw new ConvexError("This deletion request cannot be reviewed again.");
    if (reviews[0]?.reviewerUserId === actor._id) throw new ConvexError("A different platform administrator must perform the second review.");
    if (args.decision === "UNCERTAIN") throw new ConvexError("Second review must approve or refuse the request.");
    await context.db.insert("deletionReviews", { tenantId: args.tenantId, deletionRequestId: request._id, reviewerUserId: actor._id, decision: args.decision, reason: args.reason.trim(), reviewedAt: args.now });
    const status = args.decision === "APPROVE" ? "APPROVED" as const : "REFUSED" as const;
    await context.db.patch(request._id, { status, updatedAt: args.now });
    return { status };
  },
});

export const confirmDeletion = mutation({
  args: { tenantId: v.string(), sessionTokenHash: v.string(), deletionRequestId: v.id("deletionRequests"), now: v.string() },
  handler: async (context, args) => {
    await requireAdmin(context, args.tenantId, args.sessionTokenHash, args.now);
    const request = await context.db.get(args.deletionRequestId);
    if (!request || request.tenantId !== args.tenantId || request.status !== "APPROVED") throw new ConvexError("Deletion approval is not ready for confirmation.");
    const contact = await context.db.get(request.contactId);
    if (!contact || contact.tenantId !== args.tenantId) throw new ConvexError("Deletion contact is unavailable for confirmation.");
    const receipt = await demonstrationDeletionConfirmationProvider.send({
      deletionRequestId: String(request._id), channel: contact.type,
      destination: await decryptDeletionContact(contact.contactCiphertext, contact.contactIv, contact.contactAuthTag), deliveredAt: args.now,
    });
    if (receipt.status !== "DELIVERED") throw new ConvexError("Deletion confirmation was not delivered.");
    await context.db.patch(request._id, {
      status: "APPROVED_FOR_DELETION", approvalConfirmedAt: receipt.deliveredAt,
      confirmationProvider: receipt.provider, confirmationReceiptId: receipt.providerMessageId, confirmationStatus: receipt.status, updatedAt: args.now,
    });
    return { status: "APPROVED_FOR_DELETION" as const, confirmedAt: receipt.deliveredAt, receiptId: receipt.providerMessageId };
  },
});

export const executeApprovedDeletion = mutation({
  args: { sessionTokenHash: v.string(), deletionRequestId: v.id("deletionRequests"), now: v.string() },
  handler: async (context, args) => {
    const session = await context.db.query("studioSessions").withIndex("by_session_token_hash", (q) => q.eq("sessionTokenHash", args.sessionTokenHash)).unique();
    if (!session) throw new ConvexError("NOT_AUTHORISED");
    const actor = await requireAdmin(context, session.tenantId, args.sessionTokenHash, args.now);
    const request = await context.db.get(args.deletionRequestId);
    if (!actor || actor.role !== "PLATFORM_ADMIN" || !request || request.tenantId !== session.tenantId) throw new ConvexError("NOT_AUTHORISED");
    if (request.status !== "APPROVED_FOR_DELETION") throw new ConvexError("Deletion is not approved for execution.");
    if (!request.confirmationProvider || !request.confirmationReceiptId) throw new ConvexError("Deletion confirmation has no delivery receipt.");
    planDemoDeletion({ approvedAt: request.updatedAt, confirmedAt: request.approvalConfirmedAt ?? null });
    await deleteRun(context, String(request.demoRunId), request.tenantId);
    await context.db.insert("retentionReceipts", {
      tenantId: request.tenantId,
      receiptType: "DELETION",
      anonymousRecordCount: 1,
      completedAt: args.now,
      confirmationProvider: request.confirmationProvider,
      confirmationReceiptId: request.confirmationReceiptId,
      confirmationStatus: "DELIVERED",
    });
    return { deletedRuns: 1, anonymousRunCount: 1 };
  },
});
