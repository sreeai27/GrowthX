import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { env } from "../../../config/env";
import type { ContactRevealPurpose, StudioRole } from "../../../domain/studio-access";
import { studioTokenHash } from "../auth/session";
export type { StudioRole } from "../../../domain/studio-access";
export type StudioActor = { actorId: string; role: StudioRole; tenantId: string; sessionToken?: string };
export type RevealReason = ContactRevealPurpose;

export type MaskedContact = {
  contactId: string;
  maskedDisplay: string;
  channel: "EMAIL" | "MOBILE";
  invitationConsent: boolean;
  resultExpiresAt: string;
};

export type DeletionRequestView = {
  requestId: string;
  maskedDisplay: string;
  state: "PENDING" | "SECOND_REVIEW_REQUIRED" | "APPROVED";
  dueAt: string;
  requestedByActorId: string;
};

export interface StudioContactGateway {
  consumeSignIn(oneTimeToken: string, sessionToken: string): Promise<{ expiresAt: string } | null>;
  getSession(sessionToken: string): Promise<StudioActor | null>;
  listContacts(actor: StudioActor): Promise<MaskedContact[]>;
  getContact(actor: StudioActor, contactId: string): Promise<MaskedContact | null>;
  revealContact(input: StudioActor & { sessionToken?: string; contactId: string; reason: RevealReason | "" }): Promise<string>;
  listDeletions(actor: StudioActor): Promise<DeletionRequestView[]>;
  reviewDeletion(input: StudioActor & { requestId: string; decision: "APPROVE" | "REFUSE" | "UNCERTAIN"; reason: string }): Promise<void>;
  confirmDeletion(input: StudioActor & { requestId: string }): Promise<void>;
  executeDeletion(input: StudioActor & { requestId: string }): Promise<void>;
}

const contact = {
  contactId: "contact-asha",
  maskedDisplay: "a***a@example.com",
  channel: "EMAIL" as const,
  invitationConsent: true,
  resultExpiresAt: "2026-10-04T12:00:00.000Z",
};
const fixtureIssuedAt = Date.now();
const fixtureSessionPath = resolve(".demo-fixture/studio-sessions.json");
type FixtureSessions = { consumed: string[]; sessions: Record<string, StudioActor> };
async function readFixtureSessions(): Promise<FixtureSessions> {
  try { return JSON.parse(await readFile(fixtureSessionPath, "utf8")) as FixtureSessions; }
  catch { return { consumed: [], sessions: {} }; }
}
async function writeFixtureSessions(value: FixtureSessions) { await mkdir(dirname(fixtureSessionPath), { recursive: true }); await writeFile(fixtureSessionPath, JSON.stringify(value), "utf8"); }

function fixtureActor(token: string): StudioActor | null {
  const candidates: Array<[string | undefined, StudioActor]> = [
    [process.env.STUDIO_OPERATOR_TOKEN, { actorId: "operator-neha", role: "OPERATOR", tenantId }],
    [process.env.STUDIO_ADMIN_MEERA_TOKEN, { actorId: "admin-meera", role: "PLATFORM_ADMIN", tenantId }],
    [process.env.STUDIO_ADMIN_KABIR_TOKEN, { actorId: "admin-kabir", role: "PLATFORM_ADMIN", tenantId }],
  ];
  return candidates.find(([value]) => value === token)?.[1] ?? null;
}

export function createFixtureStudioContactGateway(): StudioContactGateway {
  return {
    async consumeSignIn(oneTimeToken, sessionToken) {
      const actor = fixtureActor(oneTimeToken);
      const store = await readFixtureSessions();
      if (!actor || store.consumed.includes(oneTimeToken) || Date.now() - fixtureIssuedAt >= 15 * 60 * 1000) return null;
      store.consumed.push(oneTimeToken); store.sessions[sessionToken] = { ...actor, sessionToken };
      await writeFixtureSessions(store);
      return { expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() };
    },
    async getSession(sessionToken) { return (await readFixtureSessions()).sessions[sessionToken] ?? null; },
    async listContacts(actor) {
      return actor.tenantId === "demo_sahaay_home_services" ? [contact] : [];
    },
    async getContact(actor, contactId) {
      return actor.tenantId === "demo_sahaay_home_services" && contactId === contact.contactId ? contact : null;
    },
    async revealContact(input) {
      if (input.role !== "PLATFORM_ADMIN") throw new Error("ADMIN_REQUIRED");
      if (!input.reason) throw new Error("REASON_REQUIRED");
      if (input.contactId !== contact.contactId || input.tenantId !== "demo_sahaay_home_services") throw new Error("NOT_FOUND");
      return "asha@example.com";
    },
    async listDeletions(actor) {
      if (actor.tenantId !== "demo_sahaay_home_services") return [];
      return [{ requestId: "deletion-uncertain", maskedDisplay: contact.maskedDisplay, state: "SECOND_REVIEW_REQUIRED", dueAt: "2026-09-11T12:00:00.000Z", requestedByActorId: "admin-meera" }];
    },
    async reviewDeletion(input) {
      if (input.role !== "PLATFORM_ADMIN") throw new Error("ADMIN_REQUIRED");
      if (input.requestId === "deletion-uncertain" && input.actorId === "admin-meera") throw new Error("DISTINCT_REVIEWER_REQUIRED");
    },
    async confirmDeletion(input) { if (input.role !== "PLATFORM_ADMIN") throw new Error("ADMIN_REQUIRED"); },
    async executeDeletion(input) { if (input.role !== "PLATFORM_ADMIN") throw new Error("ADMIN_REQUIRED"); },
  };
}

const tenantId = "demo_sahaay_home_services";
const consumeRef = makeFunctionReference<"mutation", { tenantId: string; tokenHash: string; sessionTokenHash: string }, { expiresAt: string } | null>("studioAccess:consumeSignInLink");
const sessionRef = makeFunctionReference<"query", { tenantId: string; sessionTokenHash: string }, { displayName: string; actorIdentityId: string; role: StudioRole; expiresAt: string } | null>("studioAccess:getSession");
const contactsRef = makeFunctionReference<"query", { tenantId: string; sessionTokenHash: string }, Array<{ contactId: string; type: "EMAIL" | "INDIAN_MOBILE"; maskedDisplay: string; createdAt: string }>>("studioAccess:listMaskedContacts");
const revealRef = makeFunctionReference<"mutation", { tenantId: string; sessionTokenHash: string; contactId: string; purpose: ContactRevealPurpose }, { contact: string } | null>("studioAccess:revealContact");
const deletionsRef = makeFunctionReference<"query", { tenantId: string; sessionTokenHash: string }, Array<{ deletionRequestId: string; contactId: string; status: string; dueAt: string; requestedBy: string }>>("studioAccess:listDeletionRequests");
const reviewRef = makeFunctionReference<"mutation", { tenantId: string; sessionTokenHash: string; deletionRequestId: string; decision: "APPROVE" | "REFUSE" | "UNCERTAIN"; reason: string; now: string }, unknown>("demoRetention:reviewDeletion");
const confirmRef = makeFunctionReference<"mutation", { tenantId: string; sessionTokenHash: string; deletionRequestId: string; now: string }, unknown>("demoRetention:confirmDeletion");
const executeRef = makeFunctionReference<"mutation", { sessionTokenHash: string; deletionRequestId: string; now: string }, unknown>("demoRetention:executeApprovedDeletion");

function createConvexStudioGateway(url: string): StudioContactGateway {
  const client = new ConvexHttpClient(url);
  return {
    consumeSignIn: (oneTimeToken, sessionToken) => client.mutation(consumeRef, { tenantId, tokenHash: studioTokenHash(oneTimeToken), sessionTokenHash: studioTokenHash(sessionToken) }),
    async getSession(sessionToken) { const value = await client.query(sessionRef, { tenantId, sessionTokenHash: studioTokenHash(sessionToken) }); return value ? { actorId: value.actorIdentityId, role: value.role, tenantId, sessionToken } : null; },
    async listContacts(actor) { const rows = await client.query(contactsRef, { tenantId: actor.tenantId, sessionTokenHash: studioTokenHash(actor.sessionToken ?? "") }); return rows.map((row) => ({ contactId: row.contactId, maskedDisplay: row.maskedDisplay, channel: row.type === "EMAIL" ? "EMAIL" : "MOBILE", invitationConsent: false, resultExpiresAt: new Date(Date.parse(row.createdAt) + 30 * 86_400_000).toISOString() })); },
    async getContact(actor, contactId) { return (await this.listContacts(actor)).find((item) => item.contactId === contactId) ?? null; },
    async revealContact(input) { if (!input.reason) throw new Error("REASON_REQUIRED"); const value = await client.mutation(revealRef, { tenantId: input.tenantId, sessionTokenHash: studioTokenHash(input.sessionToken ?? ""), contactId: input.contactId, purpose: input.reason }); if (!value) throw new Error("ADMIN_REQUIRED"); return value.contact; },
    async listDeletions(actor) { const rows = await client.query(deletionsRef, { tenantId: actor.tenantId, sessionTokenHash: studioTokenHash(actor.sessionToken ?? "") }); return rows.map((row) => ({ requestId: row.deletionRequestId, maskedDisplay: `Contact ${row.contactId.slice(-6)}`, state: row.status === "APPROVED" ? "APPROVED" : row.status === "UNCERTAIN" || row.status === "REFUSED" ? "SECOND_REVIEW_REQUIRED" : "PENDING", dueAt: row.dueAt, requestedByActorId: row.requestedBy })); },
    async reviewDeletion(input) { await client.mutation(reviewRef, { tenantId: input.tenantId, sessionTokenHash: studioTokenHash(input.sessionToken ?? ""), deletionRequestId: input.requestId, decision: input.decision, reason: input.reason, now: new Date().toISOString() }); },
    async confirmDeletion(input) { await client.mutation(confirmRef, { tenantId: input.tenantId, sessionTokenHash: studioTokenHash(input.sessionToken ?? ""), deletionRequestId: input.requestId, now: new Date().toISOString() }); },
    async executeDeletion(input) { await client.mutation(executeRef, { sessionTokenHash: studioTokenHash(input.sessionToken ?? ""), deletionRequestId: input.requestId, now: new Date().toISOString() }); },
  };
}

export function getStudioContactGateway(): StudioContactGateway {
  if (env.features.fixtureMode) return createFixtureStudioContactGateway();
  if (!env.public?.convexUrl) throw new Error("Studio access requires NEXT_PUBLIC_CONVEX_URL.");
  return createConvexStudioGateway(env.public.convexUrl);
}
