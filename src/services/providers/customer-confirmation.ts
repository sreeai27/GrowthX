import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { Value } from "convex/values";
import { z } from "zod";

import { env } from "../../config/env";
import {
  applyCustomerResponse,
  evaluateConfirmationAccess,
} from "../../domain/customer-confirmation";
import {
  buildConfirmationSnapshot,
  validateConfirmationCreation,
} from "../../domain/customer-confirmation-snapshot";
import { workerPolicyDecisionViewSchema } from "./worker-policy-decision";

const confirmationStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "DECLINED",
  "REQUEST_MISMATCH",
  "EXPIRED",
  "REVOKED",
  "STALE",
]);

export const confirmationSnapshotSchema = z
  .object({
    bookingKey: z.literal("DEMO-4821"),
    serviceName: z.string().min(1),
    includedTasks: z.array(
      z.object({ taskId: z.string().min(1), displayName: z.string().min(1) }).strict(),
    ),
    resultingTasks: z.array(
      z.object({ taskId: z.string().min(1), displayName: z.string().min(1) }).strict(),
    ),
    taskId: z.string().min(1),
    taskDisplayName: z.string().min(1),
    decisionState: z.literal("ADD_ON_APPROVAL_REQUIRED"),
    durationDeltaMinutes: z.number().int(),
    priceDeltaMinor: z.number().int().nonnegative(),
    currency: z.string().min(1),
    removableTaskIds: z.array(z.string().min(1)),
    sourceKey: z.string().min(1),
    sourceTitle: z.string().min(1),
    sourceVersion: z.string().min(1),
  })
  .strict();

export const workerConfirmationViewSchema = z
  .object({
    status: confirmationStatusSchema,
    expiresAt: z.string().datetime(),
    requestConfirmed: z.boolean(),
    commercialResponse: z.enum(["APPROVE", "DECLINE"]).nullable(),
    respondedAt: z.string().datetime().nullable(),
    snapshot: confirmationSnapshotSchema,
  })
  .strict();

const activeCustomerViewSchema = z
  .object({
    kind: z.literal("ACTIVE"),
    requestConfirmed: z.boolean(),
    snapshot: confirmationSnapshotSchema,
    expiresAt: z.string().datetime(),
  })
  .strict();
const minimalPublicState = <T extends string>(kind: T) =>
  z.object({ kind: z.literal(kind) }).strict();

export const customerConfirmationViewSchema = z.discriminatedUnion("kind", [
  activeCustomerViewSchema,
  minimalPublicState("INVALID"),
  minimalPublicState("EXPIRED"),
  minimalPublicState("STALE"),
  z
    .object({
      kind: z.literal("ALREADY_USED"),
      status: z.enum(["APPROVED", "DECLINED", "REQUEST_MISMATCH"]),
    })
    .strict(),
]);

const createdSchema = z
  .object({
    status: confirmationStatusSchema,
    created: z.boolean(),
    expiresAt: z.string().datetime(),
  })
  .strict();
const confirmRequestResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ACTIVE"), requestConfirmed: z.literal(true) }).strict(),
  z
    .object({ kind: z.literal("RECORDED"), status: z.literal("REQUEST_MISMATCH") })
    .strict(),
  minimalPublicState("EXPIRED"),
  minimalPublicState("STALE"),
]);
const responseResultSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.enum(["RECORDED", "IDEMPOTENT"]),
      status: z.enum(["APPROVED", "DECLINED"]),
    })
    .strict(),
  minimalPublicState("EXPIRED"),
  minimalPublicState("STALE"),
]);

export type WorkerConfirmationView = z.infer<typeof workerConfirmationViewSchema>;
export type CustomerConfirmationView = z.infer<typeof customerConfirmationViewSchema>;
export type ConfirmationSnapshot = z.infer<typeof confirmationSnapshotSchema>;

interface WorkerAccess extends Record<string, Value> {
  readonly publicRunId: string;
  readonly browserTokenHash: string;
  readonly incidentKey: string;
}

interface CreateInput extends WorkerAccess {
  readonly tokenHash: string;
  readonly expiresAt: string;
}

export interface CustomerConfirmationGateway {
  createConfirmation(input: CreateInput): Promise<z.infer<typeof createdSchema>>;
  getWorkerConfirmation(input: WorkerAccess): Promise<WorkerConfirmationView | null>;
  getCustomerConfirmation(tokenHash: string): Promise<CustomerConfirmationView>;
  confirmCustomerRequest(
    tokenHash: string,
    answer: "YES" | "MISMATCH",
  ): Promise<z.infer<typeof confirmRequestResultSchema>>;
  respondToConfirmation(
    tokenHash: string,
    response: "APPROVE" | "DECLINE",
  ): Promise<z.infer<typeof responseResultSchema>>;
}

const createRef = makeFunctionReference<"mutation", CreateInput, unknown>(
  "confirmations:create",
);
const getWorkerRef = makeFunctionReference<"mutation", WorkerAccess, unknown>(
  "confirmations:getForWorker",
);
const getCustomerRef = makeFunctionReference<
  "mutation",
  { tokenHash: string },
  unknown
>("confirmations:getForCustomer");
const confirmRequestRef = makeFunctionReference<
  "mutation",
  { tokenHash: string; answer: "YES" | "MISMATCH" },
  unknown
>("confirmations:confirmRequest");
const respondRef = makeFunctionReference<
  "mutation",
  { tokenHash: string; response: "APPROVE" | "DECLINE" },
  unknown
>("confirmations:respond");

function convexGateway(convexUrl: string): CustomerConfirmationGateway {
  const client = new ConvexHttpClient(convexUrl);
  return {
    async createConfirmation(input) {
      return createdSchema.parse(await client.mutation(createRef, input));
    },
    async getWorkerConfirmation(input) {
      const result = await client.mutation(getWorkerRef, input);
      return result === null ? null : workerConfirmationViewSchema.parse(result);
    },
    async getCustomerConfirmation(tokenHash) {
      return customerConfirmationViewSchema.parse(
        await client.mutation(getCustomerRef, { tokenHash }),
      );
    },
    async confirmCustomerRequest(tokenHash, answer) {
      return confirmRequestResultSchema.parse(
        await client.mutation(confirmRequestRef, { tokenHash, answer }),
      );
    },
    async respondToConfirmation(tokenHash, response) {
      return responseResultSchema.parse(
        await client.mutation(respondRef, { tokenHash, response }),
      );
    },
  };
}

const fixtureRequestSchema = workerConfirmationViewSchema.extend({
  publicRunId: z.string().min(1),
  incidentKey: z.string().min(1),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  bookingVersion: z.number().int().positive(),
  decisionHash: z.string().min(1),
  sourceVersion: z.string().min(1),
  createdAt: z.string().datetime(),
});
type FixtureStore = { requests: Array<z.infer<typeof fixtureRequestSchema>> };
const legacyFixtureStoreSchema = z.object({
  requests: z.array(
    fixtureRequestSchema
      .extend({ tokenPrefix: z.string().optional() })
      .transform(({ tokenPrefix, ...request }) => {
        void tokenPrefix;
        return request;
      }),
  ),
});

export function parseConfirmationFixtureStore(raw: unknown): {
  store: FixtureStore;
  migrated: boolean;
} {
  const store = legacyFixtureStoreSchema.parse(raw);
  const migrated =
    typeof raw === "object" &&
    raw !== null &&
    "requests" in raw &&
    Array.isArray(raw.requests) &&
    raw.requests.some(
      (request) =>
        typeof request === "object" && request !== null && "tokenPrefix" in request,
    );
  return { store, migrated };
}
const fixtureIncidentSchema = z.object({
  publicRunId: z.string().min(1),
  incidentKey: z.string().min(1),
  status: z.string().min(1),
  policyDecision: workerPolicyDecisionViewSchema.nullable().optional(),
}).passthrough();
const fixtureIncidentsSchema = z.object({ incidents: z.array(fixtureIncidentSchema) });
const fixtureRunsSchema = z.object({
  runs: z.array(
    z.object({
      publicRunId: z.string(),
      browserTokenHash: z.string(),
      status: z.enum(["ACTIVE", "ABANDONED"]),
      resumeExpiresAt: z.string().datetime(),
    }).passthrough(),
  ),
});

function fixtureGateway(storePath: string): CustomerConfirmationGateway {
  const requestsPath = resolve(`${storePath}.confirmations`);
  const incidentsPath = resolve(`${storePath}.incidents`);
  async function readRequests(): Promise<FixtureStore> {
    try {
      const raw: unknown = JSON.parse(await readFile(requestsPath, "utf8"));
      const { store, migrated } = parseConfirmationFixtureStore(raw);
      if (migrated) {
        await writeRequests(store);
      }
      return store;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { requests: [] };
      throw error;
    }
  }
  async function writeRequests(store: FixtureStore) {
    await mkdir(dirname(requestsPath), { recursive: true });
    const temporary = `${requestsPath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(store), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, requestsPath);
  }
  async function readIncidents() {
    return fixtureIncidentsSchema.parse(
      JSON.parse(await readFile(incidentsPath, "utf8")),
    );
  }
  async function writeIncidents(store: z.infer<typeof fixtureIncidentsSchema>) {
    const temporary = `${incidentsPath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(store), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, incidentsPath);
  }
  async function activeWorker(input: WorkerAccess) {
    const store = fixtureRunsSchema.parse(
      JSON.parse(await readFile(resolve(storePath), "utf8")),
    );
    return store.runs.some(
      (run) =>
        run.publicRunId === input.publicRunId &&
        run.browserTokenHash === input.browserTokenHash &&
        run.status === "ACTIVE" &&
        Date.parse(run.resumeExpiresAt) > Date.now(),
    );
  }
  async function currentDecision(request: FixtureStore["requests"][number]) {
    const store = await readIncidents();
    const incident = store.incidents.find(
      (candidate) =>
        candidate.publicRunId === request.publicRunId &&
        candidate.incidentKey === request.incidentKey,
    );
    return { store, incident, decision: incident?.policyDecision ?? null };
  }
  async function access(request: FixtureStore["requests"][number]) {
    const { incident, decision } = await currentDecision(request);
    const result = evaluateConfirmationAccess({
      now: new Date().toISOString(),
      expiresAt: request.expiresAt,
      status: request.status,
      requestConfirmed: request.requestConfirmed,
      storedBookingVersion: request.bookingVersion,
      currentBookingVersion: decision?.booking.bookingVersion ?? -1,
      storedDecisionHash: request.decisionHash,
      currentDecisionHash: decision?.decisionHash ?? "__missing__",
      storedSourceVersion: request.sourceVersion,
      currentSourceVersion: decision?.authority?.version ?? "__missing__",
    });
    return result.kind === "ACTIVE" && incident?.status !== "AWAITING_CUSTOMER"
      ? ({ kind: "STALE", status: "STALE" } as const)
      : result;
  }
  function workerView(request: FixtureStore["requests"][number]) {
    return workerConfirmationViewSchema.parse({
      status: request.status,
      expiresAt: request.expiresAt,
      requestConfirmed: request.requestConfirmed,
      commercialResponse: request.commercialResponse,
      respondedAt: request.respondedAt,
      snapshot: request.snapshot,
    });
  }
  function createdView(request: FixtureStore["requests"][number]) {
    return createdSchema.parse({
      status: request.status,
      created: false,
      expiresAt: request.expiresAt,
    });
  }
  function publicView(
    request: FixtureStore["requests"][number],
    result: ReturnType<typeof evaluateConfirmationAccess>,
  ): CustomerConfirmationView {
    if (result.kind === "ACTIVE") {
      return customerConfirmationViewSchema.parse({
        kind: "ACTIVE",
        requestConfirmed: request.requestConfirmed,
        snapshot: request.snapshot,
        expiresAt: request.expiresAt,
      });
    }
    if (result.kind === "ALREADY_USED") {
      return { kind: "ALREADY_USED", status: result.status };
    }
    return { kind: result.kind === "EXPIRED" ? "EXPIRED" : "STALE" };
  }
  return {
    async createConfirmation(input) {
      if (!(await activeWorker(input))) throw new Error("Incident is unavailable.");
      const incidentStore = await readIncidents();
      const incident = incidentStore.incidents.find(
        (candidate) =>
          candidate.publicRunId === input.publicRunId &&
          candidate.incidentKey === input.incidentKey,
      );
      const decision = incident?.policyDecision;
      if (!incident || !decision) throw new Error("Policy decision is unavailable.");
      const store = await readRequests();
      const existing = store.requests.find(
        (request) =>
          request.publicRunId === input.publicRunId &&
          request.incidentKey === input.incidentKey,
      );
      if (existing) return createdView(existing);
      if (store.requests.some((request) => request.tokenHash === input.tokenHash)) {
        throw new Error("Confirmation token collision.");
      }
      if (!decision.authority) throw new Error("Decision does not support customer confirmation.");
      const createdAt = new Date().toISOString();
      const expiresAt = validateConfirmationCreation({
        createdAt,
        requestedExpiresAt: input.expiresAt,
        tokenHash: input.tokenHash,
        incidentStatus: incident.status,
        supportState: decision.outcome.supportState,
        decisionState: decision.outcome.decisionState ?? "",
        requiresCustomer:
          decision.outcome.requirements.customerRequestConfirmation ||
          decision.outcome.requirements.customerCommercialApproval,
      });
      const snapshot = buildConfirmationSnapshot({
        bookingKey: decision.booking.bookingKey,
        serviceName: decision.booking.serviceName,
        includedTaskIds: decision.booking.includedTasks.map((task) => task.taskId),
        catalogue: decision.booking.includedTasks,
        selectedTask: decision.selectedTask,
        durationDeltaMinutes: decision.outcome.durationDeltaMinutes,
        priceDeltaMinor: decision.outcome.priceDeltaMinor,
        currency: decision.outcome.currency ?? "INR",
        removableTaskIds: decision.outcome.removableTaskIds,
        source: decision.authority,
      });
      const request = fixtureRequestSchema.parse({
        publicRunId: input.publicRunId,
        incidentKey: input.incidentKey,
        tokenHash: input.tokenHash,
        status: "PENDING",
        expiresAt,
        requestConfirmed: false,
        commercialResponse: null,
        respondedAt: null,
        snapshot,
        bookingVersion: decision.booking.bookingVersion,
        decisionHash: decision.decisionHash,
        sourceVersion: decision.authority.version,
        createdAt,
      });
      store.requests.push(request);
      incident.status = "AWAITING_CUSTOMER";
      await Promise.all([writeRequests(store), writeIncidents(incidentStore)]);
      return createdSchema.parse({
        status: request.status,
        created: true,
        expiresAt: request.expiresAt,
      });
    },
    async getWorkerConfirmation(input) {
      if (!(await activeWorker(input))) return null;
      const store = await readRequests();
      const request = store.requests.find(
        (candidate) =>
          candidate.publicRunId === input.publicRunId &&
          candidate.incidentKey === input.incidentKey,
      );
      if (!request) return null;
      const result = await access(request);
      if (result.kind === "EXPIRED" || result.kind === "STALE") {
        request.status = result.kind;
        await writeRequests(store);
      }
      return workerView(request);
    },
    async getCustomerConfirmation(tokenHash) {
      const store = await readRequests();
      const request = store.requests.find(
        (candidate) => candidate.tokenHash === tokenHash,
      );
      if (!request) return { kind: "INVALID" };
      const result = await access(request);
      if (result.kind === "EXPIRED" || result.kind === "STALE") {
        request.status = result.kind;
        await writeRequests(store);
      }
      return publicView(request, result);
    },
    async confirmCustomerRequest(tokenHash, answer) {
      const store = await readRequests();
      const request = store.requests.find((candidate) => candidate.tokenHash === tokenHash);
      if (!request) throw new Error("Confirmation request is invalid.");
      const relation = await currentDecision(request);
      const result = applyCustomerResponse({
        now: new Date().toISOString(), expiresAt: request.expiresAt,
        status: request.status, requestConfirmed: request.requestConfirmed,
        storedBookingVersion: request.bookingVersion,
        currentBookingVersion: relation.decision?.booking.bookingVersion ?? -1,
        storedDecisionHash: request.decisionHash,
        currentDecisionHash: relation.decision?.decisionHash ?? "__missing__",
        storedSourceVersion: request.sourceVersion,
        currentSourceVersion: relation.decision?.authority?.version ?? "__missing__",
        requestedResponse: answer === "YES" ? "CONFIRM_REQUEST" : "REPORT_MISMATCH",
      });
      if (result.kind === "REJECTED") {
        if (result.reason === "ALREADY_USED") throw new Error("Confirmation request is already used.");
        if (result.reason === "REQUEST_NOT_CONFIRMED") {
          throw new Error("Customer request confirmation is unavailable.");
        }
        request.status = result.reason;
        await writeRequests(store);
        return confirmRequestResultSchema.parse({ kind: result.reason });
      }
      request.requestConfirmed = result.requestConfirmed;
      request.status = result.status;
      request.respondedAt = answer === "MISMATCH" ? new Date().toISOString() : null;
      if (relation.incident) relation.incident.status = result.incidentStatus;
      await Promise.all([writeRequests(store), writeIncidents(relation.store)]);
      return confirmRequestResultSchema.parse(
        answer === "YES"
          ? { kind: "ACTIVE", requestConfirmed: true }
          : { kind: "RECORDED", status: "REQUEST_MISMATCH" },
      );
    },
    async respondToConfirmation(tokenHash, response) {
      const store = await readRequests();
      const request = store.requests.find((candidate) => candidate.tokenHash === tokenHash);
      if (!request) throw new Error("Confirmation request is invalid.");
      const relation = await currentDecision(request);
      const result = applyCustomerResponse({
        now: new Date().toISOString(), expiresAt: request.expiresAt,
        status: request.status, requestConfirmed: request.requestConfirmed,
        storedBookingVersion: request.bookingVersion,
        currentBookingVersion: relation.decision?.booking.bookingVersion ?? -1,
        storedDecisionHash: request.decisionHash,
        currentDecisionHash: relation.decision?.decisionHash ?? "__missing__",
        storedSourceVersion: request.sourceVersion,
        currentSourceVersion: relation.decision?.authority?.version ?? "__missing__",
        requestedResponse: response,
      });
      if (result.kind === "REJECTED") {
        if (result.reason === "REQUEST_NOT_CONFIRMED") throw new Error("Customer must confirm the request first.");
        if (result.reason === "ALREADY_USED") throw new Error("Confirmation request is already used.");
        request.status = result.reason;
        await writeRequests(store);
        return responseResultSchema.parse({ kind: result.reason });
      }
      if (result.kind === "RECORDED") {
        request.status = result.status;
        request.commercialResponse = response;
        request.respondedAt = new Date().toISOString();
        if (relation.incident) relation.incident.status = result.incidentStatus;
        await Promise.all([writeRequests(store), writeIncidents(relation.store)]);
      }
      return responseResultSchema.parse({ kind: result.kind, status: result.status });
    },
  };
}

export function getCustomerConfirmationGateway(): CustomerConfirmationGateway {
  if (env.features.fixtureMode) {
    return fixtureGateway(env.fixtureStorePath ?? ".demo-fixture/runs.json");
  }
  if (!env.public?.convexUrl) {
    throw new Error("Customer confirmations require NEXT_PUBLIC_CONVEX_URL.");
  }
  return convexGateway(env.public.convexUrl);
}
