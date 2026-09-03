import { describe, expect, it } from "vitest";

import { voiceEvalCases } from "./voice-suite";

describe("named voice evaluation registry", () => {
  it("contains 12 unique, explicit recovery and language cases", () => {
    expect(voiceEvalCases).toHaveLength(12);
    expect(new Set(voiceEvalCases.map((testCase) => testCase.id)).size).toBe(12);
    expect(voiceEvalCases.map((testCase) => testCase.expected)).toEqual(
      expect.arrayContaining([
        "TRANSCRIPT",
        "TRANSCRIPT_ONLY",
        "UNUSABLE_AUDIO",
        "RETRY_RECOMMENDED",
        "INVALID_PROVIDER_OUTPUT",
        "TIMEOUT",
        "TYPE_INSTEAD",
        "REVIEWED_PRESET",
      ]),
    );
  });

  it.each(voiceEvalCases)("$id has a named expected outcome", (testCase) => {
    expect(testCase.id).toMatch(/^V\d{2}_[A-Z_]+$/);
    expect(testCase.expected.length).toBeGreaterThan(2);
  });
});
