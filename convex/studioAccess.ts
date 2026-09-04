import { v } from "convex/values";

import {
  authoriseStudioAction,
  consumeOneTimeLink,
  issueOneTimeLink,
} from "../src/domain/studio-access";
import { mutation, query } from "./_generated/server";

const TENANT_ID = "demo_sahaay_home_services";

const decode = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
async function decryptContact(ciphertext: string, iv: string, authTag: string) {
  const secret = process.env.DEMO_CONTACT_ENCRYPTION_KEY;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("Contact reveal is unavailable.");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret ?? "test-only-private-demo-contact-key"));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const encrypted = new Uint8Array([...decode(ciphertext), ...decode(authTag)]);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv) }, key, encrypted));
}

const sessionArgs = {
  tenantId: v.string(),
  sessionTokenHash: v.string(),
};

// The repository's generated Convex shim has no DataModel type until deployment codegen runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function activeSession(ctx: any, tenantId: string, sessionTokenHash: string) {
  const session = await ctx.db
    .query("studioSessions")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_session_token_hash", (q: any) => q.eq("sessionTokenHash", sessionTokenHash))
    .unique();
  if (!session || session.tenantId !== tenantId || session.revokedAt || Date.parse(session.expiresAt) <= Date.now()) return null;
  const user = await ctx.db.get(session.studioUserId);
  if (!user || user.tenantId !== tenantId || user.status !== "ACTIVE") return null;
  return { session, user };
}

export const issueSignInLink = mutation({
  args: { tenantId: v.string(), emailHash: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    if (args.tenantId !== TENANT_ID) return null;
    const user = await ctx.db.query("studioUsers").withIndex("by_tenant_email_hash", (q) => q.eq("tenantId", args.tenantId)).filter((q) => q.eq(q.field("emailHash"), args.emailHash)).unique();
    if (!user || user.status !== "ACTIVE") return null;
    const issued = issueOneTimeLink({ tokenHash: args.tokenHash, now: new Date() });
    await ctx.db.insert("studioSignInLinks", { tenantId: args.tenantId, studioUserId: user._id, tokenHash: issued.tokenHash, expiresAt: issued.expiresAt, createdAt: issued.issuedAt });
    return { expiresAt: issued.expiresAt };
  },
});

export const consumeSignInLink = mutation({
  args: { tenantId: v.string(), tokenHash: v.string(), sessionTokenHash: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db.query("studioSignInLinks").withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash)).unique();
    if (!link || link.tenantId !== args.tenantId) return null;
    const user = await ctx.db.get(link.studioUserId);
    if (!user || user.tenantId !== args.tenantId || user.status !== "ACTIVE") return null;
    const decision = consumeOneTimeLink({ link: { tokenHash: link.tokenHash, issuedAt: link.createdAt, expiresAt: link.expiresAt, consumedAt: link.consumedAt }, tokenHash: args.tokenHash, now: new Date() });
    if (!decision.authorised) return null;
    await ctx.db.patch(link._id, { consumedAt: decision.consumedAt });
    await ctx.db.insert("studioSessions", { tenantId: args.tenantId, studioUserId: link.studioUserId, sessionTokenHash: args.sessionTokenHash, expiresAt: decision.sessionExpiresAt, createdAt: decision.consumedAt, lastActiveAt: decision.consumedAt });
    return {
      tenantId: user.tenantId,
      actorIdentityId: user.identityId,
      displayName: user.displayName,
      role: user.role,
      sessionTokenHash: args.sessionTokenHash,
      expiresAt: decision.sessionExpiresAt,
    };
  },
});

export const getSession = query({
  args: sessionArgs,
  handler: async (ctx, args) => {
    const auth = await activeSession(ctx, args.tenantId, args.sessionTokenHash);
    return auth ? {
      tenantId: auth.user.tenantId,
      actorIdentityId: auth.user.identityId,
      displayName: auth.user.displayName,
      role: auth.user.role,
      expiresAt: auth.session.expiresAt,
    } : null;
  },
});

export const listMaskedContacts = query({
  args: sessionArgs,
  handler: async (ctx, args) => {
    const auth = await activeSession(ctx, args.tenantId, args.sessionTokenHash);
    if (!auth || !authoriseStudioAction({ role: auth.user.role, action: "VIEW_MASKED_CONTACTS" }).authorised) return [];
    const contacts = await ctx.db.query("demoContacts").withIndex("by_tenant_run", (q) => q.eq("tenantId", args.tenantId)).collect();
    return contacts.map((contact) => ({ contactId: contact._id, type: contact.type, maskedDisplay: contact.maskedDisplay, createdAt: contact.createdAt }));
  },
});

export const revealContact = mutation({
  args: { ...sessionArgs, contactId: v.id("demoContacts"), purpose: v.union(v.literal("RESULT_DELIVERY"), v.literal("ACCOUNT_INVITATION")) },
  handler: async (ctx, args) => {
    const auth = await activeSession(ctx, args.tenantId, args.sessionTokenHash);
    if (!auth || !authoriseStudioAction({ role: auth.user.role, action: "REVEAL_CONTACT", purpose: args.purpose }).authorised) return null;
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.tenantId !== args.tenantId) return null;
    await ctx.db.insert("contactAccessEvents", { tenantId: args.tenantId, studioUserId: auth.user._id, contactId: contact._id, purpose: args.purpose, occurredAt: new Date().toISOString() });
    return { type: contact.type, contact: await decryptContact(contact.contactCiphertext, contact.contactIv, contact.contactAuthTag) };
  },
});

export const requestDeletion = mutation({
  args: { ...sessionArgs, contactId: v.id("demoContacts"), evidence: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const auth = await activeSession(ctx, args.tenantId, args.sessionTokenHash);
    if (!auth || !authoriseStudioAction({ role: auth.user.role, action: "REVIEW_DELETION" }).authorised) return null;
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.tenantId !== args.tenantId || !args.evidence.trim() || !args.reason.trim()) return null;
    const now = new Date();
    return await ctx.db.insert("deletionRequests", { tenantId: args.tenantId, contactId: contact._id, demoRunId: contact.demoRunId, requestedBy: auth.user.identityId, requestEvidence: args.evidence.trim(), requestReason: args.reason.trim(), status: "PENDING", dueAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() });
  },
});

export const listDeletionRequests = query({
  args: sessionArgs,
  handler: async (ctx, args) => {
    const auth = await activeSession(ctx, args.tenantId, args.sessionTokenHash);
    if (!auth || !authoriseStudioAction({ role: auth.user.role, action: "REVIEW_DELETION" }).authorised) return [];
    const requests = await ctx.db.query("deletionRequests").withIndex("by_tenant_status", (q) => q.eq("tenantId", args.tenantId)).collect();
    return Promise.all(requests.map(async (request) => {
      const reviews = await ctx.db.query("deletionReviews").withIndex("by_tenant_request", (q) => q.eq("tenantId", args.tenantId)).filter((q) => q.eq(q.field("deletionRequestId"), request._id)).collect();
      const reviewerIdentityIds = await Promise.all(reviews.map(async (review) => (await ctx.db.get(review.reviewerUserId))?.identityId ?? "REMOVED_REVIEWER"));
      return {
        deletionRequestId: request._id,
        contactId: request.contactId,
        status: request.status,
        dueAt: request.dueAt,
        evidenceSummary: request.requestEvidence.slice(0, 160),
        reason: request.requestReason ?? null,
        requestedBy: request.requestedBy,
        reviewerIdentityIds,
      };
    }));
  },
});
