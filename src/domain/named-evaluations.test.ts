import { describe, expect, it } from "vitest";
import { coreNamedEvalCases, promoteCorrection, runNamedEvaluations } from "./named-evaluations";

describe("named evaluations", () => {
  it("records exact versions and passes deterministic fixtures without cost", () => {
    const run = runNamedEvaluations({ tenantId: "demo_sahaay_home_services", now: "2026-09-04T00:00:00.000Z" });
    expect(run.status).toBe("PASSED");
    expect(run.aggregate).toEqual({ passed: 8, failed: 0, criticalFailed: 0 });
    expect(run.results.every((result) => result.costMinor === 0)).toBe(true);
    expect(run.sourceVersion).toBe("taskconfirm-scope-policy@1.0.0");
  });

  it("fails when a critical approval-bypass case false-passes", () => {
    const cases = coreNamedEvalCases.map((item) => item.id === "R07_FALSE_PASS" ? { ...item, observed: "DEMONSTRATED" } : item);
    expect(runNamedEvaluations({ tenantId: "tenant-a", cases }).aggregate.criticalFailed).toBe(1);
    expect(runNamedEvaluations({ tenantId: "tenant-a", cases }).status).toBe("FAILED");
  });

  it("promotes a correction only as a named critical regression", () => {
    expect(promoteCorrection({ id: "REG_BALCONY_001", suite: "mapping", title: "Correct balcony mapping", expected: "balcony", observed: "cabinet", criterion: "correct task" })).toMatchObject({ promoted: true, severity: "CRITICAL" });
  });
});
