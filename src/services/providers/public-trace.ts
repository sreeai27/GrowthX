import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { Value } from "convex/values";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

import { publicTraceSchema, type PublicTrace } from "../../domain/public-trace";
import { curatedPublicTraces, type CuratedPublicTraceId } from "../../domain/public-trace-fixtures";
import { env } from "../../config/env";

export type PublicTraceAccess = { publicRunId: string; browserTokenHash: string };
export interface PublicTraceGateway {
  getCurrent(access: PublicTraceAccess): Promise<PublicTrace | null>;
  getCurated(exampleId: string): Promise<PublicTrace | null>;
}

const currentRef = makeFunctionReference<"query", Record<string, Value>, unknown>("publicTrace:getCurrent");

export function createFixturePublicTraceGateway(records: ReadonlyArray<PublicTraceAccess & { trace: unknown }>): PublicTraceGateway {
  return {
    async getCurrent(access) {
      const owned = records.find((record) => record.publicRunId === access.publicRunId && record.browserTokenHash === access.browserTokenHash);
      return owned ? publicTraceSchema.parse(owned.trace) : null;
    },
    async getCurated(exampleId) {
      return Object.hasOwn(curatedPublicTraces, exampleId) ? publicTraceSchema.parse(curatedPublicTraces[exampleId as CuratedPublicTraceId]) : null;
    },
  };
}

const fixtureRunsSchema = z.object({ runs: z.array(z.object({ publicRunId: z.string(), browserTokenHash: z.string(), status: z.string(), resumeExpiresAt: z.string() }).passthrough()) }).passthrough();
const fixtureIncidentsSchema = z.object({ incidents: z.array(z.object({ publicRunId: z.string(), incidentKey: z.string(), status: z.string(), flowVersion: z.string().optional(), policyDecision: z.object({ outcome: z.object({ decisionState: z.string().optional() }).passthrough(), authority: z.object({ sourceKey: z.string(), version: z.string() }).nullable().optional(), provenance: z.object({ modelId: z.string().optional(), flowVersion: z.string().optional(), promptVersion: z.string().optional() }).passthrough().optional() }).passthrough().nullable().optional() }).passthrough()) }).passthrough();

export function createFilePublicTraceGateway(basePath: string): PublicTraceGateway {
  const curatedGateway = createFixturePublicTraceGateway([]);
  return {
    async getCurrent(access) {
      let runs: z.infer<typeof fixtureRunsSchema>;
      try { runs = fixtureRunsSchema.parse(JSON.parse(await readFile(resolve(basePath), "utf8"))); } catch { return null; }
      const run = runs.runs.find((item) => item.publicRunId === access.publicRunId && item.browserTokenHash === access.browserTokenHash && item.status === "ACTIVE" && Date.parse(item.resumeExpiresAt) > Date.now());
      if (!run) return null;
      let incident: z.infer<typeof fixtureIncidentsSchema>["incidents"][number] | undefined;
      try { incident = fixtureIncidentsSchema.parse(JSON.parse(await readFile(resolve(`${basePath}.incidents`), "utf8"))).incidents.find((item) => item.publicRunId === run.publicRunId); } catch { /* A newly started run has no incident yet. */ }
      const decision = incident?.policyDecision;
      return publicTraceSchema.parse({
        traceId: `trace-${run.publicRunId}`,
        title: "Current TaskConfirm run",
        outcome: decision?.outcome.decisionState ?? incident?.status ?? "Run started",
        scenario: "TASK_CONFIRM",
        stages: [{
          sequence: 1,
          label: decision ? "Policy decision" : incident ? "Incident progress" : "Run started",
          actor: "SYSTEM",
          status: incident?.status === "AWAITING_HUMAN_REVIEW" ? "ESCALATED" : "COMPLETED",
          summary: decision?.outcome.decisionState ? `The source-backed outcome is ${decision.outcome.decisionState.toLowerCase().replaceAll("_", " ")}.` : incident ? `The incident is ${incident.status.toLowerCase().replaceAll("_", " ")}.` : "A private demo run was started.",
          ...(decision?.authority ? { source: { id: decision.authority.sourceKey, version: decision.authority.version } } : {}),
          versions: { flow: decision?.provenance?.flowVersion ?? incident?.flowVersion ?? "taskconfirm-v1", ...(decision?.provenance?.modelId ? { model: decision.provenance.modelId } : {}), ...(decision?.provenance?.promptVersion ? { prompt: decision.provenance.promptVersion } : {}) },
        }],
      });
    },
    getCurated: curatedGateway.getCurated,
  };
}

function createConvexPublicTraceGateway(url: string): PublicTraceGateway {
  const client = new ConvexHttpClient(url);
  return {
    async getCurrent(access) {
      const result = await client.query(currentRef, access);
      return result === null ? null : publicTraceSchema.parse(result);
    },
    async getCurated(exampleId) {
      return Object.hasOwn(curatedPublicTraces, exampleId) ? publicTraceSchema.parse(curatedPublicTraces[exampleId as CuratedPublicTraceId]) : null;
    },
  };
}

export function getPublicTraceGateway(): PublicTraceGateway {
  if (env.features.fixtureMode) return createFilePublicTraceGateway(env.fixtureStorePath ?? ".demo-fixture/runs.json");
  if (!env.public?.convexUrl) throw new Error("Public Trace requires NEXT_PUBLIC_CONVEX_URL.");
  return createConvexPublicTraceGateway(env.public.convexUrl);
}
