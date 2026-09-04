import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createFilePublicTraceGateway, createFixturePublicTraceGateway, type PublicTraceGateway } from "./public-trace";

const ownedTrace = {
  traceId: "trace-owned",
  title: "Current TaskConfirm run",
  outcome: "Run started",
  scenario: "TASK_CONFIRM" as const,
  stages: [{ sequence: 1, label: "Run started", actor: "SYSTEM" as const, status: "COMPLETED" as const, summary: "A private demo run was started.", versions: { flow: "taskconfirm-v1" } }],
};

describe("public trace provider boundary", () => {
  it("returns the owned run and rejects another browser token", async () => {
    const gateway = createFixturePublicTraceGateway([
      { publicRunId: "run_owned", browserTokenHash: "a".repeat(64), trace: ownedTrace },
    ]);

    expect(await gateway.getCurrent({ publicRunId: "run_owned", browserTokenHash: "a".repeat(64) })).toEqual(ownedTrace);
    expect(await gateway.getCurrent({ publicRunId: "run_owned", browserTokenHash: "b".repeat(64) })).toBeNull();
  });

  it("returns only exact curated IDs and exposes no list operation", async () => {
    const gateway: PublicTraceGateway = createFixturePublicTraceGateway([]);

    expect(await gateway.getCurated("included")).not.toBeNull();
    expect(await gateway.getCurated("unknown-example")).toBeNull();
    expect("list" in gateway).toBe(false);
  });

  it("reads fixture-mode current data only for the exact run and token", async () => {
    const directory = await mkdtemp(join(tmpdir(), "public-trace-"));
    const path = join(directory, "runs.json");
    await writeFile(path, JSON.stringify({ runs: [{ publicRunId: "run_file", browserTokenHash: "c".repeat(64), status: "ACTIVE", resumeExpiresAt: "2099-01-01T00:00:00.000Z" }] }));
    await writeFile(`${path}.incidents`, JSON.stringify({ incidents: [{ publicRunId: "run_file", incidentKey: "inc_12345678", status: "DECISION_READY", flowVersion: "taskconfirm-v1" }] }));
    const gateway = createFilePublicTraceGateway(path);

    expect(await gateway.getCurrent({ publicRunId: "run_file", browserTokenHash: "c".repeat(64) })).toMatchObject({ outcome: "DECISION_READY" });
    expect(await gateway.getCurrent({ publicRunId: "run_file", browserTokenHash: "d".repeat(64) })).toBeNull();
  });
});
