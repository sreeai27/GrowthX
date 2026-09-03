import { describe, expect, it, vi } from "vitest";

import {
  createOpenAiTaskMappingProvider,
  type TaskMappingInput,
} from "./task-mapping-provider";

const input: TaskMappingInput = {
  confirmedReport: "Balcony ko deep clean karna hai",
  booking: { serviceName: "Sahaay Home Cleaning", includedTaskIds: [] },
  catalogueSource: {
    sourceId: "task-catalog",
    sourceVersion: "task-catalog-v1",
  },
  catalogue: [
    {
      taskId: "balcony_deep_cleaning",
      displayName: "Balcony deep cleaning",
      riskTier: 1,
    },
  ],
};

function response(output: unknown) {
  return new Response(
    JSON.stringify({
      id: "resp_1",
      model: "gpt-5-mini-2025-08-07",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify(output) }],
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const validOutput = {
  summary: "Customer requested balcony deep cleaning.",
  candidates: [
    {
      taskId: "balcony_deep_cleaning",
      matchReason: "The confirmed report names balcony deep cleaning.",
    },
  ],
  ambiguity: {
    isAmbiguous: false,
    missingFields: [],
    conflictingClaims: [],
  },
  riskSignals: [],
  shouldAbstain: false,
  abstentionReason: null,
};

describe("TaskMappingProvider", () => {
  it("returns only validated supplied catalogue candidates with trace versions", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(validOutput));

    const result = await createOpenAiTaskMappingProvider({
      apiKey: "secret",
      fetcher,
      model: "gpt-5.6-terra",
    }).mapReport(input);

    expect(result).toEqual({
      ...validOutput,
      candidates: [
        {
          taskId: "balcony_deep_cleaning",
          displayName: "Balcony deep cleaning",
          matchReason: "The confirmed report names balcony deep cleaning.",
        },
      ],
      flowVersion: "taskconfirm-mapping-v1",
      promptVersion: "taskconfirm-mapper-v1",
      modelId: "gpt-5-mini-2025-08-07",
      sourceId: "task-catalog",
      sourceVersion: "task-catalog-v1",
      providerMetadata: {
        provider: "openai",
        attemptCount: 1,
        latencyMs: expect.any(Number),
        inputTokens: null,
        outputTokens: null,
        estimatedCostMinor: null,
        failureCode: null,
      },
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("M07_INVENTED_TASK_ID retries once, then returns a safe abstention", async () => {
    const invented = {
      ...validOutput,
      candidates: [
        { taskId: "invented_task", matchReason: "Not in the catalogue." },
      ],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(invented))
      .mockResolvedValueOnce(response(invented));

    const result = await createOpenAiTaskMappingProvider({
      apiKey: "secret",
      fetcher,
      model: "gpt-5.6-terra",
    }).mapReport(input);

    expect(result).toMatchObject({
      candidates: [],
      shouldAbstain: true,
      abstentionReason: "INVALID_PROVIDER_OUTPUT",
      flowVersion: "taskconfirm-mapping-v1",
      promptVersion: "taskconfirm-mapper-v1",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[1]?.body).toContain("invented_task");
    expect(fetcher.mock.calls[1]?.[1]?.body).toContain(
      "Mapping referenced a task outside the supplied catalogue.",
    );
  });

  it("M08_SCHEMA_FAILURE retries once, then returns a safe abstention", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ summary: "Missing required fields" }));

    const result = await createOpenAiTaskMappingProvider({
      apiKey: "secret",
      fetcher,
      model: "gpt-5.6-terra",
    }).mapReport(input);

    expect(result).toMatchObject({
      candidates: [],
      shouldAbstain: true,
      abstentionReason: "INVALID_PROVIDER_OUTPUT",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("records a redacted validation failure when the repair succeeds", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ summary: "Invalid first output" }))
      .mockResolvedValueOnce(response(validOutput));

    const result = await createOpenAiTaskMappingProvider({
      apiKey: "secret",
      fetcher,
      model: "gpt-5.6-terra",
    }).mapReport(input);

    expect(result.providerMetadata).toMatchObject({
      attemptCount: 2,
      failureCode: "INVALID_PROVIDER_OUTPUT_REPAIRED",
    });
  });
});
