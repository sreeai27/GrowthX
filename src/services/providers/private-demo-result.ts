import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { Value } from "convex/values";
import { z } from "zod";

import { env } from "../../config/env";
import { redactDeliveryError } from "../../domain/private-demo-result";
import { normaliseDemoContact } from "../../domain/private-demo-result";
import {
  deliveryReceiptSchema,
  deliveryRequestSchema,
  getPrivateResultDeliveryProvider,
  type PrivateResultDeliveryProvider,
} from "./private-result-delivery";

const minimalState = <T extends string>(kind: T) =>
  z.object({ kind: z.literal(kind) }).strict();

export const privateResultSnapshotViewSchema = z
  .object({
    requestSummary: z.string().min(1),
    policyOutcome: z
      .object({
        decisionState: z.string().min(1),
        sourceKey: z.string().min(1),
        sourceVersion: z.string().min(1),
      })
      .strict(),
    customerDecision: z.enum(["APPROVE", "DECLINE", "NOT_REQUIRED"]),
    finalReceipt: z
      .object({
        connector: z.string().min(1),
        externalActionId: z.string().min(1),
        status: z.literal("SUCCEEDED"),
        executedAt: z.string().datetime(),
      })
      .strict(),
  })
  .strict();

const activeResultSchema = z
  .object({
    kind: z.literal("ACTIVE"),
    status: z.enum(["PENDING", "DELIVERY_FAILED", "DELIVERED"]),
    expiresAt: z.string().datetime(),
    maskedDisplay: z.string().min(1),
    snapshot: privateResultSnapshotViewSchema,
  })
  .strict();

export const privateResultPublicViewSchema = z.discriminatedUnion("kind", [
  activeResultSchema,
  minimalState("INVALID"),
  minimalState("EXPIRED"),
  minimalState("REVOKED"),
]);

export const privateResultCheckpointViewSchema = z
  .object({
    shouldShow: z.boolean(),
    state: z.enum(["AVAILABLE", "CAPTURED", "DISMISSED"]),
    maskedDisplay: z.string().min(1).nullable(),
    deliveryStatus: z
      .enum(["PENDING", "DELIVERY_FAILED", "DELIVERED"])
      .nullable(),
  })
  .strict();

export type PrivateResultPublicView = z.infer<
  typeof privateResultPublicViewSchema
>;
export type PrivateResultCheckpointView = z.infer<
  typeof privateResultCheckpointViewSchema
>;

export function projectPrivateResultPublicView(
  value: unknown,
): PrivateResultPublicView {
  return privateResultPublicViewSchema.parse(value);
}

interface DemoAccess extends Record<string, Value> {
  publicRunId: string;
  browserTokenHash: string;
}

const captureInputSchema = z
  .object({
    contact: z.string().min(1),
    invitationConsent: z.boolean(),
    origin: z.string().url(),
    stage: z.enum(["DECISION", "COMPLETION"]),
  })
  .strict();

const captureResultSchema = z
  .object({
    maskedDisplay: z.string().min(1),
    verificationState: z.literal("UNVERIFIED"),
  })
  .passthrough();

const reservationSchema = z
  .object({
    deliveryId: z.string().min(1),
    channel: z.enum(["EMAIL", "SMS"]),
    destinationEnvelope: z
      .object({ ciphertext: z.string(), iv: z.string(), authTag: z.string() })
      .strict(),
    expiresAt: z.string().datetime(),
  })
  .strict();

const completionSchema = z.object({ status: z.enum(["DELIVERED", "FAILED"]) }).strict();

export interface PrivateDemoResultGateway {
  getCheckpoint(
    access: DemoAccess,
    incidentKey: string,
    stage: "DECISION" | "COMPLETION",
  ): Promise<PrivateResultCheckpointView>;
  captureAndSend(
    access: DemoAccess,
    incidentKey: string,
    input: z.input<typeof captureInputSchema>,
  ): Promise<PrivateResultCheckpointView>;
  retryDelivery(
    access: DemoAccess,
    incidentKey: string,
    origin: string,
  ): Promise<PrivateResultCheckpointView>;
  dismissCheckpoint(
    access: DemoAccess,
    incidentKey: string,
    stage: "DECISION" | "COMPLETION",
  ): Promise<PrivateResultCheckpointView>;
  getByResultToken(token: string): Promise<PrivateResultPublicView>;
}

const getCheckpointRef = makeFunctionReference<"query", Record<string, Value>, unknown>(
  "privateDemoResults:getCheckpoint",
);
const captureRef = makeFunctionReference<"mutation", Record<string, Value>, unknown>(
  "privateDemoResults:captureContact",
);
const reserveRef = makeFunctionReference<"mutation", Record<string, Value>, unknown>(
  "privateDemoResults:reserveDelivery",
);
const completeRef = makeFunctionReference<"mutation", Record<string, Value>, unknown>(
  "privateDemoResults:completeDelivery",
);
const dismissRef = makeFunctionReference<"mutation", Record<string, Value>, unknown>(
  "privateDemoResults:dismissCheckpoint",
);
const getResultRef = makeFunctionReference<"query", { tokenHash: string }, unknown>(
  "privateDemoResults:getByResultToken",
);

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function decryptDestination(envelope: z.infer<typeof reservationSchema>["destinationEnvelope"]) {
  const configured = env.server.demoContactEncryptionKey;
  if (!configured && process.env.NODE_ENV === "production")
    throw new Error("Private result contact decryption is not configured.");
  const key = createHash("sha256").update(configured ?? "test-only-private-demo-contact-key").digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

function convexGateway(
  convexUrl: string,
  getProvider: () => PrivateResultDeliveryProvider,
): PrivateDemoResultGateway {
  const client = new ConvexHttpClient(convexUrl);

  async function deliver(access: DemoAccess, reservation: z.infer<typeof reservationSchema>, rawResultToken: string, origin: string) {
    try {
      const receipt = deliveryReceiptSchema.parse(
        await getProvider().send(
          deliveryRequestSchema.parse({
            channel: reservation.channel,
            destination: decryptDestination(reservation.destinationEnvelope),
            resultUrl: new URL(`/result/${rawResultToken}`, origin).toString(),
            expiresAt: reservation.expiresAt,
          }),
        ),
      );
      completionSchema.parse(
        await client.mutation(completeRef, {
          ...access,
          deliveryId: reservation.deliveryId,
          status: "DELIVERED",
          provider: receipt.provider,
          providerMessageId: receipt.providerMessageId,
          acceptedAt: receipt.acceptedAt,
        }),
      );
    } catch (error) {
      const redacted = redactDeliveryError(error);
      completionSchema.parse(
        await client.mutation(completeRef, {
          ...access,
          deliveryId: reservation.deliveryId,
          status: "FAILED",
          errorCode: redacted.code,
          errorMessage: redacted.message,
        }),
      );
    }
    return privateResultCheckpointViewSchema.parse(
        await client.query(getCheckpointRef, { ...access, stage: "COMPLETION" }),
    );
  }

  return {
    async getCheckpoint(access, incidentKey, stage) {
      return privateResultCheckpointViewSchema.parse(
        await client.query(getCheckpointRef, { ...access, stage }),
      );
    },
    async captureAndSend(access, incidentKey, rawInput) {
      const input = captureInputSchema.parse(rawInput);
      captureResultSchema.parse(
        await client.mutation(captureRef, {
          ...access,
          contact: input.contact,
          invitationConsent: input.invitationConsent,
        }),
      );
      if (input.stage === "COMPLETION") {
        return this.retryDelivery(access, incidentKey, input.origin);
      }
      return privateResultCheckpointViewSchema.parse(
        await client.query(getCheckpointRef, { ...access, stage: input.stage }),
      );
    },
    async retryDelivery(access, incidentKey, origin) {
      const rawResultToken = randomBytes(32).toString("base64url");
      const reservation = reservationSchema.parse(
        await client.mutation(reserveRef, {
          ...access,
          browserRateKey: access.browserTokenHash,
          resultTokenHash: tokenHash(rawResultToken),
        }),
      );
      return deliver(access, reservation, rawResultToken, z.string().url().parse(origin));
    },
    async dismissCheckpoint(access, incidentKey, stage) {
      await client.mutation(dismissRef, { ...access, stage });
      return privateResultCheckpointViewSchema.parse(
        await client.query(getCheckpointRef, { ...access, stage }),
      );
    },
    async getByResultToken(token) {
      return privateResultPublicViewSchema.parse(
        await client.query(getResultRef, { tokenHash: tokenHash(token) }),
      );
    },
  };
}

const fixtureLocks = new Map<string, Promise<void>>();
type FixtureRecord = {
  publicRunId: string; incidentKey: string; type: "EMAIL" | "INDIAN_MOBILE";
  maskedDisplay: string; contactLookupHash: string; contactCiphertext: string;
  contactIv: string; contactAuthTag: string; invitationConsent: boolean;
  decisionDismissed: boolean; completionDismissed: boolean;
  tokenHash?: string; expiresAt?: string; snapshot?: z.infer<typeof privateResultSnapshotViewSchema>;
  deliveries: Array<{ attemptedAt: string; browserRateKey: string; status: "PENDING" | "DELIVERED" | "FAILED"; receipt?: z.infer<typeof deliveryReceiptSchema>; error?: ReturnType<typeof redactDeliveryError> }>;
};
type FixturePrivateStore = { records: FixtureRecord[]; dismissals?: Array<{ publicRunId: string; incidentKey: string; stage: "DECISION" | "COMPLETION" }> };

async function fixtureRead(path: string): Promise<FixturePrivateStore> {
  try { return z.object({ records: z.array(z.any()) }).parse(JSON.parse(await readFile(path, "utf8"))) as FixturePrivateStore; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { records: [], dismissals: [] }; throw error; }
}
async function fixtureWrite(path: string, value: FixturePrivateStore) {
  const previous = fixtureLocks.get(path) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(async () => {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  });
  fixtureLocks.set(path, pending); try { await pending; } finally { if (fixtureLocks.get(path) === pending) fixtureLocks.delete(path); }
}
function fixtureSeal(value: string) {
  const key = createHash("sha256").update(env.server.demoContactEncryptionKey ?? "test-only-private-demo-contact-key").digest();
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { contactCiphertext: ciphertext.toString("base64"), contactIv: iv.toString("base64"), contactAuthTag: cipher.getAuthTag().toString("base64") };
}
async function readJson(path: string) { try { return JSON.parse(await readFile(path, "utf8")) as unknown; } catch { return {}; } }

export function fixturePrivateDemoResultGateway(
  basePath: string,
  provider: PrivateResultDeliveryProvider = getPrivateResultDeliveryProvider("test"),
): PrivateDemoResultGateway {
  const path = resolve(`${basePath}.private-results`);
  const owned = async (access: DemoAccess) => {
    const parsed = z.object({ runs: z.array(z.object({ publicRunId: z.string(), browserTokenHash: z.string(), status: z.string() }).passthrough()) }).safeParse(await readJson(resolve(basePath)));
    return parsed.success && parsed.data.runs.some((run) => run.publicRunId === access.publicRunId && run.browserTokenHash === access.browserTokenHash && run.status === "ACTIVE");
  };
  const gateway: PrivateDemoResultGateway = {
    async getCheckpoint(access, incidentKey, stage) {
      if (!(await owned(access))) throw new Error("Demo run is unavailable.");
      const store = await fixtureRead(path); const record = store.records.find((x) => x.publicRunId === access.publicRunId && x.incidentKey === incidentKey);
      if (store.dismissals?.some((x) => x.publicRunId === access.publicRunId && x.incidentKey === incidentKey && x.stage === stage)) return { shouldShow: false, state: "DISMISSED", maskedDisplay: null, deliveryStatus: null };
      if (!record) return { shouldShow: true, state: "AVAILABLE", maskedDisplay: null, deliveryStatus: null };
      if (stage === "DECISION" && record.decisionDismissed) return { shouldShow: false, state: "DISMISSED", maskedDisplay: null, deliveryStatus: null };
      if (stage === "COMPLETION" && record.completionDismissed) return { shouldShow: false, state: "DISMISSED", maskedDisplay: null, deliveryStatus: null };
      const latest = record.deliveries.at(-1)?.status;
      return { shouldShow: false, state: "CAPTURED", maskedDisplay: record.maskedDisplay, deliveryStatus: latest === "FAILED" ? "DELIVERY_FAILED" : latest ?? null };
    },
    async captureAndSend(access, incidentKey, raw) {
      const input = captureInputSchema.parse(raw); if (!(await owned(access))) throw new Error("Demo run is unavailable.");
      const store = await fixtureRead(path); const existing = store.records.find((x) => x.publicRunId === access.publicRunId && x.incidentKey === incidentKey);
      const contact = normaliseDemoContact({ contact: input.contact });
      if (existing && existing.contactLookupHash !== tokenHash(contact.normalised)) throw new Error("This run already has a different result contact.");
      if (!existing) store.records.push({ publicRunId: access.publicRunId, incidentKey, type: contact.type, maskedDisplay: contact.maskedDisplay, contactLookupHash: tokenHash(contact.normalised), ...fixtureSeal(contact.normalised), invitationConsent: input.invitationConsent, decisionDismissed: false, completionDismissed: false, deliveries: [] });
      await fixtureWrite(path, store);
      if (input.stage === "COMPLETION") return gateway.retryDelivery(access, incidentKey, input.origin);
      return { shouldShow: false, state: "CAPTURED", maskedDisplay: contact.maskedDisplay, deliveryStatus: null };
    },
    async retryDelivery(access, incidentKey, origin) {
      if (!(await owned(access))) throw new Error("Demo run is unavailable.");
      const store = await fixtureRead(path); const record = store.records.find((x) => x.publicRunId === access.publicRunId && x.incidentKey === incidentKey); if (!record) throw new Error("Private result is unavailable.");
      const now = Date.now();
      if (record.deliveries.filter((x) => x.browserRateKey === access.browserTokenHash && Date.parse(x.attemptedAt) > now - 3_600_000).length >= 3) throw new Error("BROWSER_HOURLY_LIMIT");
      if (store.records.flatMap((x) => x.contactLookupHash === record.contactLookupHash ? x.deliveries : []).filter((x) => Date.parse(x.attemptedAt) > now - 86_400_000).length >= 5) throw new Error("CONTACT_DAILY_LIMIT");
      const completions = z.object({ summaries: z.array(z.object({ publicRunId: z.string(), incidentKey: z.string(), agreement: z.object({ receipt: z.object({ connector: z.string(), externalActionId: z.string(), executedAt: z.string() }).nullable() }).passthrough(), verification: z.object({ state: z.string() }).passthrough() }).passthrough()) }).parse(await readJson(resolve(`${basePath}.completions`)));
      const completion = completions.summaries.find((item) => item.publicRunId === access.publicRunId && item.incidentKey === incidentKey);
      if (completion?.verification.state !== "VERIFIED" || !completion.agreement.receipt) throw new Error("A verified final result is not available.");
      const confirmations = z.object({ requests: z.array(z.object({ publicRunId: z.string(), incidentKey: z.string(), commercialResponse: z.enum(["APPROVE", "DECLINE"]).nullable() }).passthrough()) }).parse(await readJson(resolve(`${basePath}.confirmations`)));
      const confirmation = confirmations.requests.find((item) => item.publicRunId === access.publicRunId && item.incidentKey === incidentKey);
      const incidents = z.object({ incidents: z.array(z.object({ publicRunId: z.string(), incidentKey: z.string(), confirmedText: z.string().nullable(), policyDecision: z.object({ outcome: z.object({ decisionState: z.string().optional() }).passthrough(), authority: z.object({ sourceKey: z.string(), version: z.string() }).nullable() }).passthrough().nullable().optional() }).passthrough()) }).parse(await readJson(resolve(`${basePath}.incidents`)));
      const incident = incidents.incidents.find((item) => item.publicRunId === access.publicRunId && item.incidentKey === incidentKey);
      const decision = incident?.policyDecision; const receipt = completion.agreement.receipt;
      record.snapshot = privateResultSnapshotViewSchema.parse({ requestSummary: incident?.confirmedText ?? "Confirmed TaskConfirm request", policyOutcome: { decisionState: decision?.outcome.decisionState ?? "ADD_ON_APPROVAL_REQUIRED", sourceKey: decision?.authority?.sourceKey ?? "taskconfirm-demo-policy", sourceVersion: decision?.authority?.version ?? "v1" }, customerDecision: confirmation?.commercialResponse ?? "NOT_REQUIRED", finalReceipt: { connector: receipt.connector, externalActionId: receipt.externalActionId, status: "SUCCEEDED", executedAt: receipt.executedAt } });
      const rawToken = randomBytes(32).toString("base64url"); record.tokenHash = tokenHash(rawToken); record.expiresAt = new Date(now + 7 * 86_400_000).toISOString();
      const attempt: FixtureRecord["deliveries"][number] = { attemptedAt: new Date(now).toISOString(), browserRateKey: access.browserTokenHash, status: "PENDING" }; record.deliveries.push(attempt); await fixtureWrite(path, store);
      try { attempt.receipt = deliveryReceiptSchema.parse(await provider.send({ channel: record.type === "EMAIL" ? "EMAIL" : "SMS", destination: decryptDestination({ ciphertext: record.contactCiphertext, iv: record.contactIv, authTag: record.contactAuthTag }), resultUrl: new URL(`/result/${rawToken}`, origin).toString(), expiresAt: record.expiresAt })); attempt.status = "DELIVERED"; }
      catch (error) { attempt.status = "FAILED"; attempt.error = redactDeliveryError(error); }
      await fixtureWrite(path, store); return { shouldShow: false, state: "CAPTURED", maskedDisplay: record.maskedDisplay, deliveryStatus: attempt.status === "FAILED" ? "DELIVERY_FAILED" : attempt.status };
    },
    async dismissCheckpoint(access, incidentKey, stage) {
      if (!(await owned(access))) throw new Error("Demo run is unavailable."); const store = await fixtureRead(path);
      const record = store.records.find((x) => x.publicRunId === access.publicRunId && x.incidentKey === incidentKey);
      if (record) { if (stage === "DECISION") record.decisionDismissed = true; else record.completionDismissed = true; }
      else { store.dismissals ??= []; if (!store.dismissals.some((x) => x.publicRunId === access.publicRunId && x.incidentKey === incidentKey && x.stage === stage)) store.dismissals.push({ publicRunId: access.publicRunId, incidentKey, stage }); }
      await fixtureWrite(path, store); return { shouldShow: false, state: "DISMISSED", maskedDisplay: null, deliveryStatus: null };
    },
    async getByResultToken(rawToken) {
      const store = await fixtureRead(path); const record = store.records.find((x) => x.tokenHash === tokenHash(rawToken));
      if (!record?.snapshot || !record.expiresAt) return { kind: "INVALID" }; if (Date.parse(record.expiresAt) <= Date.now()) return { kind: "EXPIRED" };
      const status = record.deliveries.at(-1)?.status; return privateResultPublicViewSchema.parse({ kind: "ACTIVE", status: status === "DELIVERED" ? "DELIVERED" : status === "FAILED" ? "DELIVERY_FAILED" : "PENDING", expiresAt: record.expiresAt, maskedDisplay: record.maskedDisplay, snapshot: record.snapshot });
    },
  };
  return gateway;
}

export function getPrivateDemoResultGateway(): PrivateDemoResultGateway {
  if (env.features.fixtureMode) {
    return fixturePrivateDemoResultGateway(env.fixtureStorePath ?? ".demo-fixture/runs.json");
  }
  if (!env.public?.convexUrl) {
    throw new Error("Private demo results require NEXT_PUBLIC_CONVEX_URL.");
  }
  return convexGateway(
    env.public.convexUrl,
    () => getPrivateResultDeliveryProvider(process.env.NODE_ENV),
  );
}
