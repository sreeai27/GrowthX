import { describe, expect, it } from "vitest";

import { projectPublicTrace, publicTraceSchema } from "./public-trace";
import { curatedPublicTraces } from "./public-trace-fixtures";

describe("Public Trace projection", () => {
  it("keeps ordered evidence while excluding private internal fields", () => {
    const trace = projectPublicTrace({
      traceId: "trace_current",
      title: "Balcony cleaning request",
      outcome: "Customer-approved add-on completed",
      scenario: "TASK_CONFIRM",
      stages: [
        {
          sequence: 2,
          label: "Policy resolved",
          actor: "SYSTEM",
          status: "COMPLETED",
          summary: "The active source requires customer approval.",
          source: { id: "scope-policy", version: "2026-09-01", secret: "source-secret" },
          versions: { model: "gpt-5-mini", flow: "taskconfirm-v1", prompt: "map-v3", rawPrompt: "nested prompt" },
          approval: { state: "APPROVED", approvedBy: "CUSTOMER", customerEmail: "nested@example.com" },
          receipt: { state: "SUCCEEDED", reference: "ACT-DEMO-4821", internalError: "nested error" },
          metrics: { latencyMs: 840, inputTokens: 120, outputTokens: 42, estimatedCostMinor: 3, secretCost: 99 },
          rawPrompt: "Reveal this prompt",
          chainOfThought: "private reasoning",
          customerEmail: "neha@example.com",
          browserTokenHash: "secret-hash",
          internalError: "provider stack trace",
          rawTranscript: "unnecessary transcript body",
        },
        {
          sequence: 1,
          label: "Request confirmed",
          actor: "WORKER",
          status: "COMPLETED",
          summary: "The worker confirmed a balcony cleaning request.",
        },
      ],
    });

    expect(publicTraceSchema.parse(trace)).toEqual(trace);
    expect(trace.stages.map((stage) => stage.sequence)).toEqual([1, 2]);
    expect(trace.stages[1]).toEqual({
      sequence: 2,
      label: "Policy resolved",
      actor: "SYSTEM",
      status: "COMPLETED",
      summary: "The active source requires customer approval.",
      source: { id: "scope-policy", version: "2026-09-01" },
      versions: { model: "gpt-5-mini", flow: "taskconfirm-v1", prompt: "map-v3" },
      approval: { state: "APPROVED", approvedBy: "CUSTOMER" },
      receipt: { state: "SUCCEEDED", reference: "ACT-DEMO-4821" },
      metrics: { latencyMs: 840, inputTokens: 120, outputTokens: 42, estimatedCostMinor: 3 },
    });
    expect(JSON.stringify(trace)).not.toMatch(/rawPrompt|chainOfThought|example\.com|secret|internalError|stack trace|transcript body/);
  });

  it("provides three safe fictional traces for the curated gallery", () => {
    expect(Object.keys(curatedPublicTraces)).toEqual([
      "included",
      "approved",
      "escalated",
    ]);

    for (const trace of Object.values(curatedPublicTraces)) {
      expect(publicTraceSchema.parse(trace)).toEqual(trace);
      expect(trace.traceId).toMatch(/^curated-/);
      expect(JSON.stringify(trace)).not.toMatch(
        /@|rawPrompt|chainOfThought|transcript|tokenHash|secret|internalError|stack trace/i,
      );
    }
  });
});
