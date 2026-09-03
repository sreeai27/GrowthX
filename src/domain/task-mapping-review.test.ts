import { describe, expect, it } from "vitest";

import { reviewMappedTaskCandidates } from "./task-mapping-review";

describe("reviewMappedTaskCandidates", () => {
  it("forces a supplied high-risk candidate to human review", () => {
    expect(
      reviewMappedTaskCandidates(
        {
          candidates: [{
            taskId: "live_wire",
            displayName: "Untrusted label",
            matchReason: "The report mentions a live wire.",
          }],
          shouldAbstain: false,
          abstentionReason: null,
        },
        [{
          taskId: "live_wire",
          displayName: "Exposed live wire",
          riskTier: 3,
          active: true,
        }],
      ),
    ).toEqual({
      candidates: [],
      requiresReview: true,
      reviewReason: "HIGH_RISK_TASK",
    });
  });
});
