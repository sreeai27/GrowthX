import { describe, expect, it } from "vitest";
import { coreNamedEvalCases, runNamedEvaluations } from "../src/domain/named-evaluations";

describe("named release gate", () => {
  it("passes every offline named suite with exact version evidence", () => {
    const run = runNamedEvaluations({ tenantId: "release-gate", now: "2026-09-04T00:00:00.000Z" });
    expect(new Set(run.results.map((result) => result.suite))).toEqual(new Set(["deterministic", "speech", "mapping", "explanation", "replay"]));
    expect(run).toMatchObject({ status: "PASSED", aggregate: { criticalFailed: 0 }, modelId: "reviewed-fixture-v1" });
  });

  it("fails closed when a critical criterion is bypassed", () => {
    const compromised = coreNamedEvalCases.map((testCase) => testCase.id === "D03_APPROVAL_BYPASS" ? { ...testCase, observed: "ALLOWED" } : testCase);
    expect(runNamedEvaluations({ tenantId: "release-gate", cases: compromised })).toMatchObject({ status: "FAILED", aggregate: { criticalFailed: 1 } });
  });
});
