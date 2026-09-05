import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { Blob } from "node:buffer";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const seed = makeFunctionReference<"mutation", Record<string, never>>("seed:seedDemo");
const start = makeFunctionReference<"mutation", Record<string, string>>("incidents:startTaskConfirm");
const persist = makeFunctionReference<"mutation", Record<string, unknown>>("incidentAudio:persistTranscript");
const removeExpired = makeFunctionReference<"mutation", { now: string }>("incidentAudio:deleteExpiredRawAudio");

describe("incident voice evidence", () => {
  it("deletes expired raw audio without deleting transcript evidence", async () => {
    const database = convexTest(schema, modules);
    await database.mutation(seed, {});
    const access = {
      publicRunId: "run_voice_owner",
      browserTokenHash: "a".repeat(64),
      incidentKey: "inc_voice_123",
    };
    await database.run((context) =>
      context.db.insert("demoRuns", {
        tenantId: "demo_sahaay_home_services",
        publicRunId: access.publicRunId,
        browserTokenHash: access.browserTokenHash,
        status: "ACTIVE",
        bookingKey: "DEMO-4821",
        startedAt: "2026-09-03T00:00:00.000Z",
        lastActiveAt: "2026-09-03T00:00:00.000Z",
        resumeExpiresAt: "2099-09-05T00:00:00.000Z",
      }),
    );
    await database.mutation(start, access);
    const storageId = await database.run((context) => {
      // jsdom's Blob type lacks arrayBuffer; convex-test requires Node's runtime Blob.
      const audio = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
      return context.storage.store(audio as unknown as globalThis.Blob);
    });
    await database.mutation(persist, {
      ...access,
      storageId,
      mimeType: "audio/webm",
      byteLength: 3,
      durationMs: 8_000,
      expiresAt: "2026-09-04T00:00:00.000Z",
      transcript: {
        transcript: "बालकनी को deep clean करना है",
        detectedLanguage: "hi-IN",
        languageLabel: "Hindi–English mix",
        quality: "USABLE",
        provider: "fixture",
        model: "fixture-saaras-v3",
      },
    });
    await expect(database.mutation(removeExpired, { now: "2026-09-04T00:00:01.000Z" })).resolves.toEqual({ deleted: 1 });
    const evidence = await database.run(async (context) => ({
      media: await context.db.query("mediaInputs").first(),
      transcript: await context.db.query("transcripts").first(),
      trace: (await context.db.query("traceSteps").collect()).at(-1),
    }));
    expect(evidence.media).toMatchObject({ rawAudioDeletedAt: "2026-09-04T00:00:01.000Z" });
    expect(evidence.media).not.toHaveProperty("rawAudioStorageId");
    expect(evidence.transcript).toMatchObject({ rawTranscript: "बालकनी को deep clean करना है", provider: "fixture" });
    expect(evidence.trace).toMatchObject({ stage: "voice_transcribed" });
  });
});
