import { describe, expect, it } from "vitest";
import { buildReleaseEvidence } from "../../scripts/release-evidence.mjs";

describe("release evidence", () => {
  it("keeps useful release facts while excluding private fixture data", () => {
    const evidence = buildReleaseEvidence({
      commit: "abc123", generatedAt: "2026-09-04T12:00:00.000Z",
      fixtures: { runs: [{ publicRunId: "run-safe", status: "COMPLETED", browserTokenHash: "secret-token" }], contact: "visitor@example.test", rawTranscript: "private words", receipt: { connector: "DEMONSTRATION_CONNECTOR", externalActionId: "ACT-DEMO-123" } },
      evalStore: { runs: [{ runKey: "eval-safe", aggregate: { passed: 1, failed: 1 }, results: [{ latencyMs: 12, costMinor: 0 }] }] },
    });
    expect(evidence).toMatchObject({ status: "LOCAL_EVIDENCE_ONLY", demoRuns: [{ publicRunId: "run-safe", status: "COMPLETED" }], receipts: [{ connector: "DEMONSTRATION_CONNECTOR", receiptId: "ACT-DEMO-123" }], evaluations: { runId: "eval-safe", passed: 1, failed: 1 }, operations: [{ latencyMs: 12, estimatedCostMinor: 0 }], gates: { consecutiveRuns: "PASSED_LOCALLY_2026-09-05", productionBuild: "PASSED_LOCALLY_TURBOPACK_2026-09-05" } });
    expect(JSON.stringify(evidence)).not.toMatch(/secret-token|visitor@example|private words|browserTokenHash|rawTranscript/i);
  });
});
