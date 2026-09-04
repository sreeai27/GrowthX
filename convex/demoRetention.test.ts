import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const expireRuns = makeFunctionReference<
  "mutation",
  { now: string; batchLimit: number },
  { deletedRuns: number; anonymousRunCount: number }
>("demoRetention:expirePublicDemoRuns");
const executeDeletion = makeFunctionReference<
  "mutation",
  { sessionTokenHash: string; deletionRequestId: string; now: string },
  { deletedRuns: number; anonymousRunCount: number }
>("demoRetention:executeApprovedDeletion");
const reviewDeletion = makeFunctionReference<
  "mutation",
  { tenantId: string; sessionTokenHash: string; deletionRequestId: string; decision: "APPROVE" | "REFUSE" | "UNCERTAIN"; reason: string; now: string },
  { status: string }
>("demoRetention:reviewDeletion");
const confirmDeletion = makeFunctionReference<
  "mutation",
  { tenantId: string; sessionTokenHash: string; deletionRequestId: string; now: string },
  { status: string; confirmedAt: string }
>("demoRetention:confirmDeletion");

describe("public demo retention execution", () => {
  it("deletes an entire 30-day-old run and returns only anonymous counts", async () => {
    const database = convexTest(schema, modules);
    await database.run(async (context) => {
      const runId = await context.db.insert("demoRuns", {
        tenantId: "demo_sahaay_home_services",
        publicRunId: "run_expired_retention",
        browserTokenHash: "secret-browser-hash",
        status: "COMPLETED",
        bookingKey: "DEMO-4821",
        startedAt: "2026-07-01T00:00:00.000Z",
        lastActiveAt: "2026-07-01T00:00:00.000Z",
        resumeExpiresAt: "2026-07-02T00:00:00.000Z",
      });
      const contactId = await context.db.insert("demoContacts", {
        tenantId: "demo_sahaay_home_services",
        demoRunId: runId,
        type: "EMAIL",
        contactCiphertext: "private-contact",
        contactIv: "private-iv",
        contactAuthTag: "private-tag",
        contactLookupHash: "private-contact-hash",
        maskedDisplay: "s***@example.test",
        verificationState: "UNVERIFIED",
        deliveryPurposeExpiresAt: "2026-07-31T00:00:00.000Z",
        invitationConsent: true,
        consentVersion: "consent-v1",
        consentedAt: "2026-07-01T00:00:00.000Z",
        invitationExpiresAt: "2026-07-31T00:00:00.000Z",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      });
      await context.db.insert("demoResultLinks", {
        tenantId: "demo_sahaay_home_services",
        demoRunId: runId,
        contactId,
        tokenHash: "private-result-token",
        resultSnapshot: {
          requestSummary: "private request",
          policyOutcome: { decisionState: "INCLUDED_CONTINUE", supportState: "SUPPORTED" },
          customerDecision: "NONE",
          finalReceipt: null,
          verificationState: "VERIFIED",
        },
        expiresAt: "2026-07-31T00:00:00.000Z",
        deleteAfter: "2026-07-31T00:00:00.000Z",
        status: "ACTIVE",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      });
    });

    const result = await database.mutation(expireRuns, {
      now: "2026-08-01T00:00:00.000Z",
      batchLimit: 10,
    });

    expect(result).toEqual({ deletedRuns: 1, anonymousRunCount: 1 });
    expect(JSON.stringify(result)).not.toMatch(/run_expired|secret|contact/i);
    const remaining = await database.run(async (context) => ({
      runs: await context.db.query("demoRuns").collect(),
      contacts: await context.db.query("demoContacts").collect(),
      links: await context.db.query("demoResultLinks").collect(),
    }));
    expect(remaining).toEqual({ runs: [], contacts: [], links: [] });
  });

  it("requires confirmed approval and will not bypass an uncertain second review", async () => {
    const database = convexTest(schema, modules);
    const seeded = await database.run(async (context) => {
      const userId = await context.db.insert("studioUsers", {
        tenantId: "demo_sahaay_home_services", identityId: "admin-meera", emailHash: "admin-hash",
        displayName: "Meera", role: "PLATFORM_ADMIN", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z",
      });
      await context.db.insert("studioSessions", {
        tenantId: "demo_sahaay_home_services", studioUserId: userId, sessionTokenHash: "session-hash",
        expiresAt: "2026-09-05T20:00:00.000Z", createdAt: "2026-09-05T10:00:00.000Z", lastActiveAt: "2026-09-05T10:00:00.000Z",
      });
      const secondUserId = await context.db.insert("studioUsers", {
        tenantId: "demo_sahaay_home_services", identityId: "admin-kabir", emailHash: "admin-two-hash",
        displayName: "Kabir", role: "PLATFORM_ADMIN", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z",
      });
      await context.db.insert("studioSessions", {
        tenantId: "demo_sahaay_home_services", studioUserId: secondUserId, sessionTokenHash: "second-session-hash",
        expiresAt: "2026-09-05T20:00:00.000Z", createdAt: "2026-09-05T10:00:00.000Z", lastActiveAt: "2026-09-05T10:00:00.000Z",
      });
      const runId = await context.db.insert("demoRuns", {
        tenantId: "demo_sahaay_home_services", publicRunId: "delete-me", browserTokenHash: "browser-hash", status: "ACTIVE",
        bookingKey: "DEMO-4821", startedAt: "2026-09-01T00:00:00.000Z", lastActiveAt: "2026-09-01T00:00:00.000Z", resumeExpiresAt: "2026-09-02T00:00:00.000Z",
      });
      const contactId = await context.db.insert("demoContacts", {
        tenantId: "demo_sahaay_home_services", demoRunId: runId, type: "EMAIL", contactCiphertext: "private", contactIv: "iv", contactAuthTag: "tag", contactLookupHash: "lookup", maskedDisplay: "m***@example.test", verificationState: "UNVERIFIED", deliveryPurposeExpiresAt: "2026-10-01T00:00:00.000Z", invitationConsent: false, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
      });
      const requestId = await context.db.insert("deletionRequests", {
        tenantId: "demo_sahaay_home_services", contactId, demoRunId: runId, requestedBy: "visitor", requestEvidence: "email request", status: "PENDING", dueAt: "2026-09-08T00:00:00.000Z", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-05T11:00:00.000Z",
      });
      return { requestId };
    });
    const base = { tenantId: "demo_sahaay_home_services", deletionRequestId: seeded.requestId, now: "2026-09-05T12:00:00.000Z" };
    await expect(database.mutation(reviewDeletion, { ...base, sessionTokenHash: "session-hash", decision: "UNCERTAIN", reason: "Evidence needs another review." })).resolves.toEqual({ status: "UNCERTAIN" });
    await expect(database.mutation(reviewDeletion, { ...base, sessionTokenHash: "session-hash", decision: "APPROVE", reason: "Trying my own second review." })).rejects.toThrow("different platform administrator");
    await expect(database.mutation(reviewDeletion, { ...base, sessionTokenHash: "second-session-hash", decision: "APPROVE", reason: "Evidence confirms the visitor request." })).resolves.toEqual({ status: "APPROVED" });
    await expect(database.mutation(confirmDeletion, { ...base, sessionTokenHash: "second-session-hash" })).resolves.toEqual({ status: "APPROVED_FOR_DELETION", confirmedAt: base.now });
    const confirmed = await database.run((context) => context.db.get(seeded.requestId));
    expect(confirmed).toMatchObject({ status: "APPROVED_FOR_DELETION", approvalConfirmedAt: base.now });
    const args = { sessionTokenHash: "session-hash", deletionRequestId: seeded.requestId, now: base.now };
    await expect(database.mutation(executeDeletion, args)).resolves.toEqual({ deletedRuns: 1, anonymousRunCount: 1 });
  });

  it("permits only one reasoned review of a refusal", async () => {
    const database = convexTest(schema, modules);
    const ids = await database.run(async (context) => {
      const users = [];
      for (const [identityId, token] of [["admin-one", "one-token"], ["admin-two", "two-token"]] as const) {
        const userId = await context.db.insert("studioUsers", { tenantId: "tenant", identityId, emailHash: `${identityId}-hash`, displayName: identityId, role: "PLATFORM_ADMIN", status: "ACTIVE", createdAt: "2026-09-01T00:00:00.000Z" });
        await context.db.insert("studioSessions", { tenantId: "tenant", studioUserId: userId, sessionTokenHash: token, expiresAt: "2026-09-06T00:00:00.000Z", createdAt: "2026-09-01T00:00:00.000Z", lastActiveAt: "2026-09-01T00:00:00.000Z" });
        users.push(userId);
      }
      const runId = await context.db.insert("demoRuns", { tenantId: "tenant", publicRunId: "refusal-run", browserTokenHash: "hash", status: "ACTIVE", bookingKey: "B", startedAt: "2026-09-01T00:00:00.000Z", lastActiveAt: "2026-09-01T00:00:00.000Z", resumeExpiresAt: "2026-09-02T00:00:00.000Z" });
      const contactId = await context.db.insert("demoContacts", { tenantId: "tenant", demoRunId: runId, type: "EMAIL", contactCiphertext: "c", contactIv: "i", contactAuthTag: "a", contactLookupHash: "h", maskedDisplay: "x***", verificationState: "UNVERIFIED", deliveryPurposeExpiresAt: "2026-10-01T00:00:00.000Z", invitationConsent: false, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" });
      const requestId = await context.db.insert("deletionRequests", { tenantId: "tenant", contactId, demoRunId: runId, requestedBy: "visitor", requestEvidence: "request", status: "PENDING", dueAt: "2026-09-08T00:00:00.000Z", createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" });
      return { requestId };
    });
    const base = { tenantId: "tenant", deletionRequestId: ids.requestId, now: "2026-09-05T12:00:00.000Z" };
    await database.mutation(reviewDeletion, { ...base, sessionTokenHash: "one-token", decision: "REFUSE", reason: "Identity evidence did not match." });
    await expect(database.mutation(reviewDeletion, { ...base, sessionTokenHash: "two-token", decision: "REFUSE", reason: "Second review confirms the mismatch." })).resolves.toEqual({ status: "REFUSED" });
    await expect(database.mutation(reviewDeletion, { ...base, sessionTokenHash: "one-token", decision: "APPROVE", reason: "Attempt another review." })).rejects.toThrow("cannot be reviewed");
  });
});
