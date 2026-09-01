import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { z } from "zod";

import { env } from "../../config/env";
import { canAccessDemoRun } from "../../domain/demo-session";

const bookingSchema = z.object({
  serviceName: z.string(),
  workerName: z.string(),
  status: z.literal("IN_PROGRESS"),
  scheduledDurationMinutes: z.number().int().positive(),
  includedTasks: z.array(z.string()),
});

const demoViewSchema = z.object({
  publicRunId: z.string(),
  bookingKey: z.literal("DEMO-4821"),
  resumeExpiresAt: z.string().datetime(),
  booking: bookingSchema,
});
export type DemoView = z.infer<typeof demoViewSchema>;

type StartInput = Record<string, string> & {
  publicRunId: string;
  browserTokenHash: string;
  now: string;
  resumeExpiresAt: string;
};
type ResumeInput = Record<string, string> & {
  publicRunId: string;
  browserTokenHash: string;
  now: string;
};
type RestartInput = Record<string, string> & {
  currentPublicRunId: string;
  currentTokenHash: string;
  replacementPublicRunId: string;
  replacementTokenHash: string;
  now: string;
  resumeExpiresAt: string;
};

export interface DemoSessionGateway {
  start(input: StartInput): Promise<DemoView>;
  resume(input: ResumeInput): Promise<DemoView | null>;
  restart(input: RestartInput): Promise<DemoView | null>;
}

type ConvexStartInput = Pick<StartInput, "publicRunId" | "browserTokenHash">;
type ConvexResumeInput = Pick<ResumeInput, "publicRunId" | "browserTokenHash">;
type ConvexRestartInput = Omit<RestartInput, "now" | "resumeExpiresAt">;

const startRef = makeFunctionReference<"mutation", ConvexStartInput, DemoView>(
  "demoSessions:startDemo",
);
const resumeRef = makeFunctionReference<
  "mutation",
  ConvexResumeInput,
  DemoView | null
>("demoSessions:resumeDemo");
const restartRef = makeFunctionReference<
  "mutation",
  ConvexRestartInput,
  DemoView | null
>("demoSessions:restartDemo");

function convexGateway(convexUrl: string): DemoSessionGateway {
  const client = new ConvexHttpClient(convexUrl);
  return {
    async start(input) {
      const { publicRunId, browserTokenHash } = input;
      return demoViewSchema.parse(
        await client.mutation(startRef, { publicRunId, browserTokenHash }),
      );
    },
    async resume(input) {
      const { publicRunId, browserTokenHash } = input;
      const value = await client.mutation(resumeRef, {
        publicRunId,
        browserTokenHash,
      });
      return value === null ? null : demoViewSchema.parse(value);
    },
    async restart(input) {
      const value = await client.mutation(restartRef, {
        currentPublicRunId: input.currentPublicRunId,
        currentTokenHash: input.currentTokenHash,
        replacementPublicRunId: input.replacementPublicRunId,
        replacementTokenHash: input.replacementTokenHash,
      });
      return value === null ? null : demoViewSchema.parse(value);
    },
  };
}

const storedRunSchema = z.object({
  publicRunId: z.string(),
  browserTokenHash: z.string(),
  status: z.enum(["ACTIVE", "ABANDONED"]),
  bookingKey: z.literal("DEMO-4821"),
  startedAt: z.string(),
  lastActiveAt: z.string(),
  resumeExpiresAt: z.string(),
  abandonedAt: z.string().optional(),
});
const fixtureFileSchema = z.object({ runs: z.array(storedRunSchema) });
type FixtureFile = z.infer<typeof fixtureFileSchema>;

const fixtureBooking = {
  serviceName: "Essential Home Cleaning",
  workerName: "Asha",
  status: "IN_PROGRESS" as const,
  scheduledDurationMinutes: 60,
  includedTasks: [
    "Kitchen surface cleaning",
    "One standard bathroom",
    "Standard floor cleaning",
  ],
};

function fileGateway(storePath: string): DemoSessionGateway {
  const absolutePath = resolve(storePath);
  async function readStore(): Promise<FixtureFile> {
    try {
      return fixtureFileSchema.parse(
        JSON.parse(await readFile(absolutePath, "utf8")),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { runs: [] };
      throw error;
    }
  }
  async function writeStore(store: FixtureFile) {
    await mkdir(dirname(absolutePath), { recursive: true });
    const temporaryPath = `${absolutePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(store), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, absolutePath);
  }
  return {
    async start(input) {
      const store = await readStore();
      if (store.runs.some((run) => run.publicRunId === input.publicRunId))
        throw new Error("Run ID collision.");
      store.runs.push({
        ...input,
        status: "ACTIVE",
        bookingKey: "DEMO-4821",
        startedAt: input.now,
        lastActiveAt: input.now,
      });
      await writeStore(store);
      return {
        publicRunId: input.publicRunId,
        bookingKey: "DEMO-4821",
        resumeExpiresAt: input.resumeExpiresAt,
        booking: fixtureBooking,
      };
    },
    async resume(input) {
      const store = await readStore();
      const run = store.runs.find(
        (candidate) => candidate.publicRunId === input.publicRunId,
      );
      if (!canAccessDemoRun(run, input.browserTokenHash, new Date(input.now)))
        return null;
      run.lastActiveAt = input.now;
      await writeStore(store);
      return {
        publicRunId: run.publicRunId,
        bookingKey: run.bookingKey,
        resumeExpiresAt: run.resumeExpiresAt,
        booking: fixtureBooking,
      };
    },
    async restart(input) {
      const store = await readStore();
      const current = store.runs.find(
        (run) => run.publicRunId === input.currentPublicRunId,
      );
      if (
        !canAccessDemoRun(current, input.currentTokenHash, new Date(input.now))
      )
        return null;
      if (
        store.runs.some(
          (run) => run.publicRunId === input.replacementPublicRunId,
        )
      )
        throw new Error("Run ID collision.");
      current.status = "ABANDONED";
      current.abandonedAt = input.now;
      store.runs.push({
        publicRunId: input.replacementPublicRunId,
        browserTokenHash: input.replacementTokenHash,
        status: "ACTIVE",
        bookingKey: current.bookingKey,
        startedAt: input.now,
        lastActiveAt: input.now,
        resumeExpiresAt: input.resumeExpiresAt,
      });
      await writeStore(store);
      return {
        publicRunId: input.replacementPublicRunId,
        bookingKey: current.bookingKey,
        resumeExpiresAt: input.resumeExpiresAt,
        booking: fixtureBooking,
      };
    },
  };
}

export function getDemoSessionGateway(): DemoSessionGateway {
  if (env.features.fixtureMode) {
    return fileGateway(env.fixtureStorePath ?? ".demo-fixture/runs.json");
  }
  if (!env.public?.convexUrl)
    throw new Error("Demo sessions require NEXT_PUBLIC_CONVEX_URL.");
  return convexGateway(env.public.convexUrl);
}
