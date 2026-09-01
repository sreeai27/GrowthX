import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const seedDemo = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { inserted: boolean }
>("seed:seedDemo");
const startDemo = makeFunctionReference<
  "mutation",
  {
    publicRunId: string;
    browserTokenHash: string;
  },
  { publicRunId: string; bookingKey: string; resumeExpiresAt: string }
>("demoSessions:startDemo");
const resumeDemo = makeFunctionReference<
  "mutation",
  { publicRunId: string; browserTokenHash: string },
  { publicRunId: string; bookingKey: string; resumeExpiresAt: string } | null
>("demoSessions:resumeDemo");
const restartDemo = makeFunctionReference<
  "mutation",
  {
    currentPublicRunId: string;
    currentTokenHash: string;
    replacementPublicRunId: string;
    replacementTokenHash: string;
  },
  { publicRunId: string; bookingKey: string; resumeExpiresAt: string } | null
>("demoSessions:restartDemo");

describe("persistent demo sessions", () => {
  it("starts a run against the seeded booking without accepting a tenant ID", async () => {
    const database = convexTest(schema, modules);
    await database.mutation(seedDemo, {});

    const started = await database.mutation(startDemo, {
      publicRunId: "run_public_123",
      browserTokenHash: "a".repeat(64),
    });

    expect(started).toEqual(
      expect.objectContaining({
        publicRunId: "run_public_123",
        bookingKey: "DEMO-4821",
        resumeExpiresAt: expect.any(String),
      }),
    );
  });

  it("resumes the seeded booking and updates activity before expiry", async () => {
    const database = convexTest(schema, modules);
    await database.mutation(seedDemo, {});
    await database.mutation(startDemo, {
      publicRunId: "run_public_123",
      browserTokenHash: "a".repeat(64),
    });

    expect(
      await database.mutation(resumeDemo, {
        publicRunId: "run_public_123",
        browserTokenHash: "a".repeat(64),
      }),
    ).toEqual(
      expect.objectContaining({
        publicRunId: "run_public_123",
        bookingKey: "DEMO-4821",
        resumeExpiresAt: expect.any(String),
      }),
    );
  });

  it("returns no data for an invalid token", async () => {
    const database = convexTest(schema, modules);
    await database.mutation(seedDemo, {});
    await database.mutation(startDemo, {
      publicRunId: "run_public_123",
      browserTokenHash: "a".repeat(64),
    });
    expect(
      await database.mutation(resumeDemo, {
        publicRunId: "run_public_123",
        browserTokenHash: "b".repeat(64),
      }),
    ).toBeNull();
  });

  it("returns no data after expiry", async () => {
    const database = convexTest(schema, modules);
    await database.run((context) =>
      context.db.insert("demoRuns", {
        tenantId: "demo_sahaay_home_services",
        publicRunId: "run_expired_123",
        browserTokenHash: "a".repeat(64),
        status: "ACTIVE",
        bookingKey: "DEMO-4821",
        startedAt: "2020-01-01T00:00:00.000Z",
        lastActiveAt: "2020-01-01T00:00:00.000Z",
        resumeExpiresAt: "2020-01-02T00:00:00.000Z",
      }),
    );
    expect(
      await database.mutation(resumeDemo, {
        publicRunId: "run_expired_123",
        browserTokenHash: "a".repeat(64),
      }),
    ).toBeNull();
  });

  it("cannot resume a matching run from another tenant", async () => {
    const database = convexTest(schema, modules);
    await database.run((context) =>
      context.db.insert("demoRuns", {
        tenantId: "another_tenant",
        publicRunId: "run_public_123",
        browserTokenHash: "a".repeat(64),
        status: "ACTIVE",
        bookingKey: "OTHER-1",
        startedAt: "2026-09-01T10:00:00.000Z",
        lastActiveAt: "2026-09-01T10:00:00.000Z",
        resumeExpiresAt: "2026-09-02T10:00:00.000Z",
      }),
    );
    expect(
      await database.mutation(resumeDemo, {
        publicRunId: "run_public_123",
        browserTokenHash: "a".repeat(64),
      }),
    ).toBeNull();
  });

  it("atomically abandons the current run and creates its replacement", async () => {
    const database = convexTest(schema, modules);
    await database.mutation(seedDemo, {});
    await database.mutation(startDemo, {
      publicRunId: "run_public_first",
      browserTokenHash: "a".repeat(64),
    });

    expect(
      await database.mutation(restartDemo, {
        currentPublicRunId: "run_public_first",
        currentTokenHash: "a".repeat(64),
        replacementPublicRunId: "run_public_second",
        replacementTokenHash: "b".repeat(64),
      }),
    ).toEqual(
      expect.objectContaining({
        publicRunId: "run_public_second",
        bookingKey: "DEMO-4821",
        resumeExpiresAt: expect.any(String),
      }),
    );
    expect(
      await database.mutation(resumeDemo, {
        publicRunId: "run_public_first",
        browserTokenHash: "a".repeat(64),
      }),
    ).toBeNull();
  });
});
