import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const issue = makeFunctionReference<"mutation", { tenantId: string; emailHash: string; tokenHash: string }, { expiresAt: string } | null>("studioAccess:issueSignInLink");
const consume = makeFunctionReference<"mutation", { tenantId: string; tokenHash: string; sessionTokenHash: string }, { expiresAt: string } | null>("studioAccess:consumeSignInLink");
const session = makeFunctionReference<"query", { tenantId: string; sessionTokenHash: string }, unknown>("studioAccess:getSession");
const list = makeFunctionReference<"query", { tenantId: string; sessionTokenHash: string }, Array<{ maskedDisplay: string }>>("studioAccess:listMaskedContacts");
const reveal = makeFunctionReference<"mutation", { tenantId: string; sessionTokenHash: string; contactId: string; purpose: "RESULT_DELIVERY" }, unknown>("studioAccess:revealContact");

const TENANT = "demo_sahaay_home_services";

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
async function encryptedContact(value: string) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("test-only-private-demo-contact-key"));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)));
  return { contactCiphertext: encode(encrypted.slice(0, -16)), contactIv: encode(iv), contactAuthTag: encode(encrypted.slice(-16)) };
}

async function seedUser(database: ReturnType<typeof convexTest>, role: "OPERATOR" | "PLATFORM_ADMIN", suffix: string) {
  return database.run((ctx) => ctx.db.insert("studioUsers", { tenantId: TENANT, identityId: `identity-${suffix}`, emailHash: `email-${suffix}`, displayName: suffix, role, status: "ACTIVE", createdAt: new Date().toISOString() }));
}

describe("studio access persistence boundary", () => {
  it("enforces allowlisting and rejects one-time-link replay", async () => {
    const db = convexTest(schema, modules);
    await seedUser(db, "OPERATOR", "operator");
    expect(await db.mutation(issue, { tenantId: TENANT, emailHash: "unknown", tokenHash: "link-x" })).toBeNull();
    expect(await db.mutation(issue, { tenantId: TENANT, emailHash: "email-operator", tokenHash: "link-1" })).not.toBeNull();
    expect(await db.mutation(consume, { tenantId: TENANT, tokenHash: "link-1", sessionTokenHash: "session-1" })).not.toBeNull();
    expect(await db.mutation(consume, { tenantId: TENANT, tokenHash: "link-1", sessionTokenHash: "session-2" })).toBeNull();
  });

  it("rejects expired and cross-tenant sessions", async () => {
    const db = convexTest(schema, modules);
    const userId = await seedUser(db, "OPERATOR", "operator");
    await db.run((ctx) => ctx.db.insert("studioSessions", { tenantId: TENANT, studioUserId: userId, sessionTokenHash: "expired", expiresAt: "2020-01-01T00:00:00.000Z", createdAt: "2019-01-01T00:00:00.000Z", lastActiveAt: "2019-01-01T00:00:00.000Z" }));
    expect(await db.query(session, { tenantId: TENANT, sessionTokenHash: "expired" })).toBeNull();
    expect(await db.query(session, { tenantId: "another-tenant", sessionTokenHash: "expired" })).toBeNull();
  });

  it("returns only masked contacts to operators and audits administrator reveals", async () => {
    const db = convexTest(schema, modules);
    const operatorId = await seedUser(db, "OPERATOR", "operator");
    const adminOneId = await seedUser(db, "PLATFORM_ADMIN", "admin-one");
    const adminTwoId = await seedUser(db, "PLATFORM_ADMIN", "admin-two");
    const now = new Date().toISOString();
    const envelope = await encryptedContact("reviewer@example.com");
    const contactId = await db.run(async (ctx) => {
      const runId = await ctx.db.insert("demoRuns", { tenantId: TENANT, publicRunId: "run-studio", browserTokenHash: "browser", status: "ACTIVE", bookingKey: "DEMO-4821", startedAt: now, lastActiveAt: now, resumeExpiresAt: "2099-01-01T00:00:00.000Z" });
      return ctx.db.insert("demoContacts", { tenantId: TENANT, demoRunId: runId, type: "EMAIL", ...envelope, contactLookupHash: "lookup", maskedDisplay: "r***@example.com", verificationState: "UNVERIFIED", deliveryPurposeExpiresAt: "2099-01-01T00:00:00.000Z", invitationConsent: false, createdAt: now, updatedAt: now });
    });
    for (const [id, token] of [[operatorId, "operator-session"], [adminOneId, "admin-one-session"], [adminTwoId, "admin-two-session"]] as const) {
      await db.run((ctx) => ctx.db.insert("studioSessions", { tenantId: TENANT, studioUserId: id, sessionTokenHash: token, expiresAt: "2099-01-01T00:00:00.000Z", createdAt: now, lastActiveAt: now }));
    }
    expect(await db.query(list, { tenantId: TENANT, sessionTokenHash: "operator-session" })).toEqual([expect.objectContaining({ maskedDisplay: "r***@example.com" })]);
    expect(await db.mutation(reveal, { tenantId: TENANT, sessionTokenHash: "operator-session", contactId, purpose: "RESULT_DELIVERY" })).toBeNull();
    expect(await db.mutation(reveal, { tenantId: TENANT, sessionTokenHash: "admin-one-session", contactId, purpose: "RESULT_DELIVERY" })).toEqual({ type: "EMAIL", contact: "reviewer@example.com" });
    const events = await db.run((ctx) => ctx.db.query("contactAccessEvents").collect());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ studioUserId: adminOneId, purpose: "RESULT_DELIVERY" });
    expect(adminTwoId).not.toBe(adminOneId);
  });
});
