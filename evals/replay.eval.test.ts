import { describe, expect, it } from "vitest";

import { createReviewedReplay, evaluateReplayAttempt, mapReplayTranscriptToAnswer, validateReplayVariant } from "../src/domain/replay";
import { resolveReplaySpeech } from "../src/services/providers/replay-speech-provider";
import { replayEvalCases } from "./replay-suite";

describe("replay false-pass prevention", () => {
  for (const fixture of replayEvalCases) it(fixture.id, () => {
    expect(evaluateReplayAttempt(createReviewedReplay(), fixture.answer).result).toBe(fixture.expected);
  });

  it("R08_CHANGED_RETRY_STAYS_EQUIVALENT", () => {
    const replay = createReviewedReplay();
    expect(replay.retryStimulusText).not.toBe(replay.stimulusText);
    expect(replay.operationalTruth.decisionState).toBe("ADD_ON_APPROVAL_REQUIRED");
  });

  it("R09_REJECTS_GENERATED_POLICY_CHANGE", () => {
    const replay = createReviewedReplay();
    expect(validateReplayVariant(replay, { ...replay, operationalTruth: { ...replay.operationalTruth, requiresCustomerApproval: false } })).toEqual({ valid: false, reason: "APPROVAL_CHANGED" });
  });

  it("R10_SPEECH_FAILURE_USES_REVIEWED_FIXTURE", async () => {
    await expect(resolveReplaySpeech("practice", async () => { throw new Error("provider failed"); })).resolves.toMatchObject({ source: "REVIEWED_FALLBACK" });
  });

  it("R11_VOICE_MENTIONING_BOOKING_CANNOT_HIDE_APPROVAL_BYPASS", () => {
    expect(evaluateReplayAttempt(createReviewedReplay(), mapReplayTranscriptToAnswer("The booking includes it, start now")).result).toBe("RETRY_REQUIRED");
  });
});
