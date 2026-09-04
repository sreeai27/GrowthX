import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { z } from "zod";

import { env } from "../../config/env";
import { createReviewedReplay, evaluateReplayAttempt, replayAnswerSchema } from "../../domain/replay";

export const replayViewSchema = z.union([
  z.object({ kind: z.literal("AVAILABLE") }).strict(),
  z.object({
    kind: z.literal("REPLAY"),
    replay: z.object({ id: z.string(), stimulusText: z.string(), reviewedAudioPath: z.string(), sourceId: z.string(), sourceVersion: z.string(), rubricVersion: z.string() }).strict(),
    attempts: z.array(z.object({ attemptNumber: z.number(), result: z.enum(["RETRY_REQUIRED", "DEMONSTRATED"]), correction: z.string().nullable() }).strict()),
    capability: z.object({ result: z.enum(["DEMONSTRATED", "NOT_YET_DEMONSTRATED"]), assistanceLevel: z.enum(["NONE", "ONE_RETRY"]), privateByDefault: z.literal(true), challenged: z.boolean(), sourceId: z.string(), sourceVersion: z.string(), rubricVersion: z.string(), flowVersion: z.string(), generatorModelId: z.string(), promptVersion: z.string(), evaluatorModelId: z.string(), evaluatorVersion: z.string(), createdAt: z.string() }).strict().nullable(),
  }).strict(),
]);
export type ReplayView = z.infer<typeof replayViewSchema>;
export type ReplayAccess = { publicRunId: string; browserTokenHash: string; incidentKey: string };

export interface ReplayGateway {
  get(access: ReplayAccess): Promise<ReplayView | null>;
  generate(access: ReplayAccess): Promise<ReplayView>;
  submit(access: ReplayAccess, answer: z.infer<typeof replayAnswerSchema>): Promise<ReplayView>;
  challenge(access: ReplayAccess): Promise<ReplayView>;
}

const getRef = makeFunctionReference<"mutation", ReplayAccess, unknown>("replays:get");
const generateRef = makeFunctionReference<"mutation", ReplayAccess, unknown>("replays:generate");
const submitRef = makeFunctionReference<"mutation", ReplayAccess & { answer: string }, unknown>("replays:submitAttempt");
const challengeRef = makeFunctionReference<"mutation", ReplayAccess, unknown>("replays:challenge");

function convexGateway(url: string): ReplayGateway {
  const client = new ConvexHttpClient(url);
  return {
    async get(access) { const value = await client.mutation(getRef, access); return value === null ? null : replayViewSchema.parse(value); },
    async generate(access) { return replayViewSchema.parse(await client.mutation(generateRef, access)); },
    async submit(access, answer) { return replayViewSchema.parse(await client.mutation(submitRef, { ...access, answer: replayAnswerSchema.parse(answer) })); },
    async challenge(access) { return replayViewSchema.parse(await client.mutation(challengeRef, access)); },
  };
}

const storedSchema = z.object({
  publicRunId: z.string(), incidentKey: z.string(), tokenHash: z.string(),
  attempts: z.array(z.object({ answer: replayAnswerSchema, result: z.enum(["RETRY_REQUIRED", "DEMONSTRATED"]), correction: z.string().nullable(), createdAt: z.string() }).strict()),
  capability: z.object({ result: z.enum(["DEMONSTRATED", "NOT_YET_DEMONSTRATED"]), assistanceLevel: z.enum(["NONE", "ONE_RETRY"]), privateByDefault: z.literal(true), challenged: z.boolean(), sourceId: z.string(), sourceVersion: z.string(), rubricVersion: z.string(), flowVersion: z.string().default("taskconfirm-v1"), generatorModelId: z.string().default("reviewed-fixture-v1"), promptVersion: z.string().default("taskconfirm-replay-prompt-v1"), evaluatorModelId: z.string().default("deterministic-rubric-v1"), evaluatorVersion: z.string().default("taskconfirm-replay-evaluator-v1"), createdAt: z.string() }).strict().nullable(),
}).strict();
const storeSchema = z.object({ replays: z.array(storedSchema) }).strict();
const runsSchema = z.object({ runs: z.array(z.object({ publicRunId: z.string(), browserTokenHash: z.string(), status: z.string(), resumeExpiresAt: z.string() }).passthrough()) }).passthrough();
const incidentsSchema = z.object({ incidents: z.array(z.object({ publicRunId: z.string(), incidentKey: z.string(), status: z.string() }).passthrough()) }).strict();

function fixtureGateway(storePath: string): ReplayGateway {
  const base = resolve(storePath), incidentPath = resolve(`${storePath}.incidents`), replayPath = resolve(`${storePath}.replays`);
  async function read(path: string) { return JSON.parse(await readFile(path, "utf8")) as unknown; }
  async function load() { try { return storeSchema.parse(await read(replayPath)); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { replays: [] }; throw error; } }
  async function save(value: unknown) { await mkdir(dirname(replayPath), { recursive: true }); const temp = `${replayPath}.${process.pid}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify(value), { encoding: "utf8", mode: 0o600 }); await rename(temp, replayPath); }
  async function available(access: ReplayAccess) {
    const runs = runsSchema.parse(await read(base)), incidents = incidentsSchema.parse(await read(incidentPath));
    const active = runs.runs.some(run => run.publicRunId === access.publicRunId && run.browserTokenHash === access.browserTokenHash && run.status === "ACTIVE" && Date.parse(run.resumeExpiresAt) > Date.now());
    return active && incidents.incidents.some(incident => incident.publicRunId === access.publicRunId && incident.incidentKey === access.incidentKey && incident.status === "VERIFIED");
  }
  function project(stored: z.infer<typeof storedSchema>): ReplayView {
    const replay = createReviewedReplay();
    return replayViewSchema.parse({ kind: "REPLAY", replay: { id: `${stored.publicRunId}:${stored.incidentKey}`, stimulusText: stored.attempts.length ? replay.retryStimulusText : replay.stimulusText, reviewedAudioPath: replay.reviewedAudioPath, sourceId: replay.source.id, sourceVersion: replay.source.version, rubricVersion: replay.rubric.version }, attempts: stored.attempts.map((attempt, index) => ({ attemptNumber: index + 1, result: attempt.result, correction: attempt.correction })), capability: stored.capability });
  }
  async function owned(access: ReplayAccess) { const store = await load(); return { store, stored: store.replays.find(item => item.publicRunId === access.publicRunId && item.incidentKey === access.incidentKey && item.tokenHash === access.browserTokenHash) }; }
  return {
    async get(access) { if (!(await available(access))) return null; const { stored } = await owned(access); return stored ? project(stored) : { kind: "AVAILABLE" }; },
    async generate(access) { if (!(await available(access))) throw new Error("Replay requires a verified incident."); const { store, stored } = await owned(access); if (stored) return project(stored); const created = storedSchema.parse({ publicRunId: access.publicRunId, incidentKey: access.incidentKey, tokenHash: access.browserTokenHash, attempts: [], capability: null }); store.replays.push(created); await save(store); return project(created); },
    async submit(access, rawAnswer) { if (!(await available(access))) throw new Error("Replay requires a verified incident."); const { store, stored } = await owned(access); if (!stored) throw new Error("Replay is unavailable."); if (stored.capability || stored.attempts.length >= 2) return project(stored); const answer = replayAnswerSchema.parse(rawAnswer), evaluation = evaluateReplayAttempt(createReviewedReplay(), answer), now = new Date().toISOString(), attemptNumber = stored.attempts.length + 1; stored.attempts.push({ answer, result: evaluation.result, correction: evaluation.correction, createdAt: now }); if (evaluation.result === "DEMONSTRATED" || attemptNumber === 2) { const replay = createReviewedReplay(); stored.capability = { result: evaluation.result === "DEMONSTRATED" ? "DEMONSTRATED" : "NOT_YET_DEMONSTRATED", assistanceLevel: attemptNumber === 1 ? "NONE" : "ONE_RETRY", privateByDefault: true, challenged: false, sourceId: replay.source.id, sourceVersion: replay.source.version, rubricVersion: replay.rubric.version, flowVersion: "taskconfirm-v1", generatorModelId: replay.generator.modelId, promptVersion: replay.generator.promptVersion, evaluatorModelId: "deterministic-rubric-v1", evaluatorVersion: "taskconfirm-replay-evaluator-v1", createdAt: now }; } await save(store); return project(stored); },
    async challenge(access) { const { store, stored } = await owned(access); if (!stored?.capability) throw new Error("Capability event is unavailable."); stored.capability.challenged = true; await save(store); return project(stored); },
  };
}

export function getReplayGateway(): ReplayGateway {
  if (env.features.fixtureMode) return fixtureGateway(env.fixtureStorePath ?? ".demo-fixture/runs.json");
  if (!env.public?.convexUrl) throw new Error("Replay requires NEXT_PUBLIC_CONVEX_URL.");
  return convexGateway(env.public.convexUrl);
}
