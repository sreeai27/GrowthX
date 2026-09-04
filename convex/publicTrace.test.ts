import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const seedDemo = makeFunctionReference<"mutation", Record<string, never>, { inserted: boolean }>("seed:seedDemo");
const startDemo = makeFunctionReference<"mutation", { publicRunId: string; browserTokenHash: string }, unknown>("demoSessions:startDemo");
const getCurrent = makeFunctionReference<"query", { publicRunId: string; browserTokenHash: string }, unknown>("publicTrace:getCurrent");

describe("public trace ownership", () => {
  it("returns only the current browser-owned run", async () => {
    const database = convexTest(schema, modules);
    await database.mutation(seedDemo, {});
    await database.mutation(startDemo, { publicRunId: "run_trace_owner", browserTokenHash: "a".repeat(64) });

    expect(await database.query(getCurrent, { publicRunId: "run_trace_owner", browserTokenHash: "a".repeat(64) })).not.toBeNull();
    expect(await database.query(getCurrent, { publicRunId: "run_trace_owner", browserTokenHash: "b".repeat(64) })).toBeNull();
  });
});
