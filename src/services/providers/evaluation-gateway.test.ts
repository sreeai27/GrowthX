import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { promoteCorrection, runNamedEvaluations } from "../../domain/named-evaluations";
import { createFileEvaluationGateway } from "./evaluation-gateway";

describe("evaluation gateway", () => {
  it("isolates stored runs and promoted cases by tenant", async () => {
    const gateway = createFileEvaluationGateway(join(await mkdtemp(join(tmpdir(), "evals-")), "store.json"));
    await gateway.saveRun(runNamedEvaluations({ tenantId: "tenant-a", now: "2026-09-04T00:00:00.000Z" }));
    expect(await gateway.latestRun("tenant-a")).not.toBeNull();
    expect(await gateway.latestRun("tenant-b")).toBeNull();
    await gateway.promote("tenant-a", promoteCorrection({ id: "REG_001", suite: "mapping", title: "Correction", expected: "a", observed: "b", criterion: "task" }));
    expect(await gateway.promoted("tenant-a")).toHaveLength(1);
    expect(await gateway.promoted("tenant-b")).toHaveLength(0);
  });
});
