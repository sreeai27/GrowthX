import { describe, expect, it } from "vitest";

import { demoBooking, demoTasks } from "../convex/fixtures";
import {
  createOpenAiTaskMappingProvider,
  createReviewedTaskMappingProvider,
} from "../src/services/providers/task-mapping-provider";
import { taskMappingEvalCases } from "./task-mapping-suite";

function openAiResponse(output: unknown) {
  return new Response(JSON.stringify({
    model: "gpt-eval",
    output: [{
      type: "message",
      content: [{ type: "output_text", text: JSON.stringify(output) }],
    }],
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("named TaskConfirm mapping evaluations", () => {
  for (const fixture of taskMappingEvalCases) {
    it(fixture.id, async () => {
      const provider = "providerOutput" in fixture
        ? createOpenAiTaskMappingProvider({
            apiKey: "eval-key",
            model: "gpt-eval",
            fetcher: async () => openAiResponse(fixture.providerOutput),
          })
        : createReviewedTaskMappingProvider();
      const result = await provider.mapReport({
        confirmedReport: fixture.input,
        booking: {
          serviceName: demoBooking.serviceName,
          includedTaskIds: demoBooking.includedTaskIds,
        },
        catalogueSource: {
          sourceId: "task-catalog",
          sourceVersion: demoBooking.catalogVersion,
        },
        catalogue: demoTasks.map(({ taskId, displayName, riskTier }) => ({
          taskId,
          displayName,
          riskTier,
        })),
      });

      expect(result.candidates.map(({ taskId }) => taskId)).toEqual(
        fixture.expectedTaskIds,
      );
      if (fixture.expected === "AMBIGUOUS")
        expect(result.ambiguity.isAmbiguous).toBe(true);
      if (fixture.expected === "ABSTAIN")
        expect(result).toMatchObject({
          shouldAbstain: true,
          abstentionReason: "NO_CATALOGUE_MATCH",
        });
      if (fixture.expected === "SAFETY_REVIEW")
        expect(result).toMatchObject({
          shouldAbstain: true,
          riskSignals: ["HIGH_RISK_TASK"],
        });
      if (fixture.expected === "CANDIDATE_ONLY") {
        expect(result.shouldAbstain).toBe(false);
        expect(result).not.toHaveProperty("priceDeltaMinor");
        expect(result).not.toHaveProperty("durationDeltaMinutes");
        expect(result).not.toHaveProperty("decisionState");
      }
      if (fixture.expected === "PROVIDER_REJECT")
        expect(result).toMatchObject({
          shouldAbstain: true,
          abstentionReason: "INVALID_PROVIDER_OUTPUT",
        });
    });
  }
});
