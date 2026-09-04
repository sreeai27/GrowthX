import { describe, expect, it } from "vitest";

import {
  createReviewedReplay,
  evaluateReplayAttempt,
  validateReplayVariant,
  mapReplayTranscriptToAnswer,
} from "./replay";

describe("TaskConfirm replay", () => {
  it("changes the situation without changing its operational truth", () => {
    const replay = createReviewedReplay();
    expect(replay.stimulusText).not.toContain("Balcony ko deep clean");
    expect(replay.operationalTruth).toEqual({
      taskId: "balcony_deep_cleaning",
      decisionState: "ADD_ON_APPROVAL_REQUIRED",
      riskTier: 1,
      priceDeltaMinor: 29900,
      durationDeltaMinutes: 20,
      requiresCustomerApproval: true,
    });
    expect(replay.source).toEqual({ id: "taskconfirm-scope-policy", version: "1.0.0" });
    expect(replay.rubric.version).toBe("taskconfirm-replay-rubric-v1");
  });

  it("rejects generated variants that alter operational truth", () => {
    const original = createReviewedReplay();
    expect(validateReplayVariant(original, {
      ...original,
      operationalTruth: { ...original.operationalTruth, priceDeltaMinor: 0 },
    })).toEqual({ valid: false, reason: "PRICE_CHANGED" });
  });

  it("gives one focused correction and rejects dangerous false passes", () => {
    const replay = createReviewedReplay();
    expect(evaluateReplayAttempt(replay, "PROMISE_INCLUDED")).toMatchObject({
      result: "RETRY_REQUIRED",
      correction: expect.stringMatching(/booking|approval/i),
    });
    expect(evaluateReplayAttempt(replay, "OPEN_TASK_CONFIRM")).toMatchObject({
      result: "DEMONSTRATED",
      correction: null,
    });
    for (const answer of ["INVENT_PRICE", "CANCEL_BOOKING", "MARK_COMPLETE", "UNSAFE_CONTINUE", "BYPASS_APPROVAL"] as const)
      expect(evaluateReplayAttempt(replay, answer).result).toBe("RETRY_REQUIRED");
  });

  it("maps a voice transcript only to bounded actions", () => {
    expect(mapReplayTranscriptToAnswer("Pehle booking check karungi")).toBe("OPEN_TASK_CONFIRM");
    expect(mapReplayTranscriptToAnswer("I will quote a price")).toBe("INVENT_PRICE");
    expect(mapReplayTranscriptToAnswer("The booking includes it, start now")).toBe("BYPASS_APPROVAL");
  });
});
