import type { DataModelFromSchemaDefinition, DocumentByName, GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { ConvexError } from "convex/values";
import { DEMO_TENANT_ID } from "./fixtures";
import type schema from "./schema";

type Model = DataModelFromSchemaDefinition<typeof schema>;
type MutCtx = GenericMutationCtx<Model>;
type QueryCtx = GenericQueryCtx<Model>;
type ReadCtx = MutCtx | QueryCtx;
type Run = DocumentByName<Model, "demoRuns">;
type Access = { publicRunId: string; browserTokenHash: string };
const HASH = /^[a-f0-9]{64}$/;
const DAY = 86_400_000;

async function ownedRun(context: ReadCtx, args: Access) {
  if (!HASH.test(args.browserTokenHash)) return null;
  const run = await context.db.query("demoRuns").withIndex("by_tenant_public_run", (q) => q.eq("tenantId", DEMO_TENANT_ID).eq("publicRunId", args.publicRunId)).unique();
  return run && run.browserTokenHash === args.browserTokenHash && run.status !== "ABANDONED" && Date.parse(run.resumeExpiresAt) > Date.now() ? run : null;
}
const contactFor = (context: ReadCtx, run: Run) => context.db.query("demoContacts").withIndex("by_tenant_run", (q) => q.eq("tenantId", run.tenantId).eq("demoRunId", run._id)).unique();
const linkFor = (context: ReadCtx, run: Run) => context.db.query("demoResultLinks").withIndex("by_tenant_run", (q) => q.eq("tenantId", run.tenantId).eq("demoRunId", run._id)).unique();
async function hash(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
async function seal(value: string) {
  const secret = process.env.DEMO_CONTACT_ENCRYPTION_KEY;
  if (!secret && process.env.NODE_ENV === "production") throw new ConvexError("Contact delivery is unavailable.");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret ?? "test-only-private-demo-contact-key"));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]); const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)));
  return { contactCiphertext: encode(encrypted.slice(0, -16)), contactIv: encode(iv), contactAuthTag: encode(encrypted.slice(-16)) };
}
function parseContact(contact: string) {
  const email = contact.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { const [local, domain] = email.split("@"); return { type: "EMAIL" as const, value: email, masked: `${local![0]}***@${domain}` }; }
  let digits = contact.replace(/\D/g, ""); if (digits.length === 11 && digits[0] === "0") digits = digits.slice(1); if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (/^[6-9]\d{9}$/.test(digits)) return { type: "INDIAN_MOBILE" as const, value: `+91${digits}`, masked: `+91******${digits.slice(-4)}` };
  throw new ConvexError("Enter a valid email address or Indian mobile number.");
}
const daysFrom = (now: Date, days: number) => new Date(now.getTime() + days * DAY).toISOString();
function monthsFrom(now: Date) { const result = new Date(now); result.setUTCMonth(result.getUTCMonth() + 6); return result.toISOString(); }

async function finalSnapshot(context: ReadCtx, run: Run) {
  const incidents = await context.db.query("incidents").withIndex("by_tenant_booking", (q) => q.eq("tenantId", run.tenantId).eq("bookingKey", run.bookingKey)).collect(); const incident = incidents.find((item) => item.demoRunId === run._id);
  if (!incident || incident.status !== "VERIFIED") throw new ConvexError("A verified final result is not available.");
  const [interpretation, decision, confirmation, executions, completion] = await Promise.all([
    context.db.query("exceptionInterpretations").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).unique(),
    context.db.query("policyDecisions").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).unique(),
    context.db.query("confirmationRequests").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).unique(),
    context.db.query("actionExecutions").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).collect(),
    context.db.query("completionSummaries").withIndex("by_tenant_incident", (q) => q.eq("tenantId", run.tenantId).eq("incidentId", incident._id)).unique(),
  ]);
  const execution = executions.find((item) => item.status === "SUCCEEDED");
  if (!interpretation?.summary || !decision?.decisionState || !confirmation?.commercialResponse || completion?.verificationState !== "VERIFIED") throw new ConvexError("A structured final result is not available.");
  return { requestSummary: interpretation.summary, policyOutcome: { decisionState: decision.decisionState, supportState: decision.supportState, ...(decision.sourceKey ? { sourceKey: decision.sourceKey } : {}), ...(decision.sourceVersion ? { sourceVersion: decision.sourceVersion } : {}) }, customerDecision: confirmation.commercialResponse, finalReceipt: execution?.receipt ? { connector: execution.receipt.connector, externalActionId: execution.receipt.externalActionId, status: execution.receipt.status, executedAt: execution.receipt.executedAt } : null, verificationState: completion.verificationState };
}

export async function getCheckpointHandler(context: QueryCtx, args: Access & { stage: "DECISION" | "COMPLETION" }) {
  const run = await ownedRun(context, args);
  if (!run) return { state: "DISMISSED" as const, shouldShow: false, maskedDisplay: null, deliveryStatus: null };
  const contact = await contactFor(context, run);
  const dismissed = args.stage === "DECISION" ? run.firstCheckpointDismissedAt : run.secondCheckpointDismissedAt;
  if (!contact) return dismissed
    ? { state: "DISMISSED" as const, shouldShow: false, maskedDisplay: null, deliveryStatus: null }
    : { state: "AVAILABLE" as const, shouldShow: true, maskedDisplay: null, deliveryStatus: null };
  const deliveries = await context.db.query("demoDeliveries").withIndex("by_tenant_run", (q) => q.eq("tenantId", run.tenantId).eq("demoRunId", run._id)).collect();
  const latest = deliveries.sort((left, right) => right.attemptedAt.localeCompare(left.attemptedAt))[0];
  return {
    state: "CAPTURED" as const,
    shouldShow: false,
    maskedDisplay: contact.maskedDisplay,
    deliveryStatus: latest?.status === "FAILED" ? "DELIVERY_FAILED" as const : latest?.status ?? null,
  };
}
export async function dismissCheckpointHandler(context: MutCtx, args: Access & { stage: "DECISION" | "COMPLETION" }) { const run = await ownedRun(context, args); if (!run) throw new ConvexError("Demo run is unavailable."); const key = args.stage === "DECISION" ? "firstCheckpointDismissedAt" : "secondCheckpointDismissedAt"; if (!run[key]) await context.db.patch(run._id, { [key]: new Date().toISOString() }); return { kind: "DISMISSED" as const, stage: args.stage }; }
export async function captureContactHandler(context: MutCtx, args: Access & { contact: string; invitationConsent: boolean }) {
  const run = await ownedRun(context, args); if (!run) throw new ConvexError("Demo run is unavailable."); const parsed = parseContact(args.contact); const lookup = await hash(`demo-contact-v1:${parsed.value}`); const existing = await contactFor(context, run);
  if (existing) { if (existing.contactLookupHash !== lookup) throw new ConvexError("This run already has a different result contact."); return { kind: "CAPTURED" as const, maskedDisplay: existing.maskedDisplay, verificationState: "UNVERIFIED" as const }; }
  const now = new Date(); const at = now.toISOString(); await context.db.insert("demoContacts", { tenantId: run.tenantId, demoRunId: run._id, type: parsed.type, ...(await seal(parsed.value)), contactLookupHash: lookup, maskedDisplay: parsed.masked, verificationState: "UNVERIFIED", deliveryPurposeExpiresAt: daysFrom(now, 30), invitationConsent: args.invitationConsent, ...(args.invitationConsent ? { consentVersion: "account-invitation-v1", consentedAt: at, invitationExpiresAt: monthsFrom(now) } : {}), createdAt: at, updatedAt: at });
  return { kind: "CAPTURED" as const, maskedDisplay: parsed.masked, verificationState: "UNVERIFIED" as const };
}
export async function reserveDeliveryHandler(context: MutCtx, args: Access & { browserRateKey: string; resultTokenHash: string }) {
  if (!HASH.test(args.resultTokenHash)) throw new ConvexError("Invalid result token hash."); const run = await ownedRun(context, args); if (!run) throw new ConvexError("Demo run is unavailable."); const contact = await contactFor(context, run); if (!contact) throw new ConvexError("Result contact is unavailable."); let link = await linkFor(context, run); const now = new Date();
  if (!link) { const id = await context.db.insert("demoResultLinks", { tenantId: run.tenantId, demoRunId: run._id, contactId: contact._id, tokenHash: args.resultTokenHash, resultSnapshot: await finalSnapshot(context, run), expiresAt: daysFrom(now, 7), deleteAfter: daysFrom(now, 30), status: "ACTIVE", createdAt: now.toISOString(), updatedAt: now.toISOString() }); link = await context.db.get(id); }
  if (!link || link.status !== "ACTIVE") throw new ConvexError("Private result is unavailable."); const attempts = await context.db.query("demoDeliveries").collect();
  if (attempts.filter((item) => item.tenantId === run.tenantId && item.browserRateKey === args.browserRateKey && Date.parse(item.attemptedAt) > now.getTime() - 3_600_000).length >= 3) throw new ConvexError("BROWSER_HOURLY_LIMIT");
  if (attempts.filter((item) => item.tenantId === run.tenantId && item.contactRateKey === contact.contactLookupHash && Date.parse(item.attemptedAt) > now.getTime() - DAY).length >= 5) throw new ConvexError("CONTACT_DAILY_LIMIT");
  const deliveryId = await context.db.insert("demoDeliveries", { tenantId: run.tenantId, demoRunId: run._id, contactId: contact._id, resultLinkId: link._id, channel: contact.type === "EMAIL" ? "EMAIL" : "SMS", status: "PENDING", browserRateKey: args.browserRateKey, contactRateKey: contact.contactLookupHash, attemptedAt: now.toISOString(), updatedAt: now.toISOString() });
  return { kind: "RESERVED" as const, deliveryId, channel: contact.type === "EMAIL" ? "EMAIL" as const : "SMS" as const, destinationEnvelope: { ciphertext: contact.contactCiphertext, iv: contact.contactIv, authTag: contact.contactAuthTag }, expiresAt: link.expiresAt };
}
export async function completeDeliveryHandler(context: MutCtx, args: Access & { deliveryId: DocumentByName<Model, "demoDeliveries">["_id"]; status: "DELIVERED" | "FAILED"; provider?: string; providerMessageId?: string; acceptedAt?: string; errorCode?: string; errorMessage?: string }) { const run = await ownedRun(context, args); const delivery = await context.db.get(args.deliveryId); if (!run || !delivery || delivery.tenantId !== run.tenantId || delivery.demoRunId !== run._id || delivery.status !== "PENDING") throw new ConvexError("Delivery attempt is unavailable."); const updatedAt = new Date().toISOString(); await context.db.patch(delivery._id, args.status === "DELIVERED" ? { status: "DELIVERED", provider: args.provider, providerMessageId: args.providerMessageId, acceptedAt: args.acceptedAt, updatedAt } : { status: "FAILED", errorCode: args.errorCode, errorMessage: args.errorMessage, updatedAt }); return { kind: args.status }; }
export async function getByResultTokenHandler(context: QueryCtx, args: { tokenHash: string }) {
  if (!HASH.test(args.tokenHash)) return { kind: "INVALID" as const };
  const link = await context.db.query("demoResultLinks").withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash)).unique();
  if (!link) return { kind: "INVALID" as const };
  if (link.status === "REVOKED") return { kind: "REVOKED" as const };
  if (Date.parse(link.expiresAt) <= Date.now()) return { kind: "EXPIRED" as const };
  const run = await context.db.get(link.demoRunId);
  const contact = await context.db.get(link.contactId);
  if (!run || !contact || run.tenantId !== link.tenantId || contact.tenantId !== link.tenantId || contact.demoRunId !== run._id || run.status === "ABANDONED") return { kind: "INVALID" as const };
  const deliveries = await context.db.query("demoDeliveries").withIndex("by_tenant_run", (q) => q.eq("tenantId", link.tenantId).eq("demoRunId", run._id)).collect();
  const latest = deliveries.sort((left, right) => right.attemptedAt.localeCompare(left.attemptedAt))[0];
  return {
    kind: "ACTIVE" as const,
    status: latest?.status === "FAILED" ? "DELIVERY_FAILED" as const : latest?.status ?? "PENDING" as const,
    expiresAt: link.expiresAt,
    maskedDisplay: contact.maskedDisplay,
    snapshot: link.resultSnapshot,
  };
}
