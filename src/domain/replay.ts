import { z } from "zod";

export const replayAnswerSchema = z.enum([
  "OPEN_TASK_CONFIRM",
  "PROMISE_INCLUDED",
  "INVENT_PRICE",
  "CANCEL_BOOKING",
  "MARK_COMPLETE",
  "UNSAFE_CONTINUE",
  "BYPASS_APPROVAL",
]);
export type ReplayAnswer = z.infer<typeof replayAnswerSchema>;

const operationalTruthSchema = z.object({
  taskId: z.string().min(1),
  decisionState: z.enum(["INCLUDED_CONTINUE", "ADD_ON_APPROVAL_REQUIRED", "TRADE_OFF_REQUIRED", "NOT_SUPPORTED", "SAFETY_ESCALATION"]),
  riskTier: z.number().int().min(1).max(3),
  priceDeltaMinor: z.number().int().nonnegative(),
  durationDeltaMinutes: z.number().int().nonnegative(),
  requiresCustomerApproval: z.boolean(),
});

export const replaySchema = z.object({
  capabilityKey: z.literal("taskconfirm.scope_change.balcony"),
  stimulusText: z.string().min(1).max(400),
  retryStimulusText: z.string().min(1).max(400),
  workerInstructionHi: z.string().min(1).max(240),
  variationSummary: z.string().min(1).max(180),
  operationalTruth: operationalTruthSchema,
  source: z.object({ id: z.string(), version: z.string() }),
  rubric: z.object({
    version: z.literal("taskconfirm-replay-rubric-v1"),
    expectedAction: z.literal("OPEN_TASK_CONFIRM"),
  }),
  generator: z.object({
    provider: z.string(),
    modelId: z.string(),
    promptVersion: z.string(),
  }),
  reviewedAudioPath: z.string(),
});
export type Replay = z.infer<typeof replaySchema>;

export function createReviewedReplay(): Replay {
  return replaySchema.parse({
    capabilityKey: "taskconfirm.scope_change.balcony",
    stimulusText: "Didi, balcony wale area ko achchhe se scrub bhi kar dena. Jo package hai usme ho jayega na?",
    retryStimulusText: "Balcony ka extra deep scrub karna hai. Pehle se booking mein nahi dikh raha—ab kya karogi?",
    workerInstructionHi: "सही अगला कदम चुनें। कीमत या अनुमति का अनुमान न लगाएँ।",
    variationSummary: "Changed wording and surface detail; preserved the approved add-on state.",
    operationalTruth: {
      taskId: "balcony_deep_cleaning",
      decisionState: "ADD_ON_APPROVAL_REQUIRED",
      riskTier: 1,
      priceDeltaMinor: 29_900,
      durationDeltaMinutes: 20,
      requiresCustomerApproval: true,
    },
    source: { id: "taskconfirm-scope-policy", version: "1.0.0" },
    rubric: { version: "taskconfirm-replay-rubric-v1", expectedAction: "OPEN_TASK_CONFIRM" },
    generator: { provider: "REVIEWED_FIXTURE", modelId: "reviewed-fixture-v1", promptVersion: "taskconfirm-replay-prompt-v1" },
    reviewedAudioPath: "/audio/taskconfirm-balcony-reviewed.wav",
  });
}

type ValidationReason = "TASK_CHANGED" | "POLICY_STATE_CHANGED" | "RISK_CHANGED" | "PRICE_CHANGED" | "DURATION_CHANGED" | "APPROVAL_CHANGED" | "SOURCE_CHANGED" | "RUBRIC_CHANGED";

export function validateReplayVariant(original: Replay, candidate: Replay): { valid: true } | { valid: false; reason: ValidationReason } {
  const checks: Array<[boolean, ValidationReason]> = [
    [candidate.operationalTruth.taskId === original.operationalTruth.taskId, "TASK_CHANGED"],
    [candidate.operationalTruth.decisionState === original.operationalTruth.decisionState, "POLICY_STATE_CHANGED"],
    [candidate.operationalTruth.riskTier === original.operationalTruth.riskTier, "RISK_CHANGED"],
    [candidate.operationalTruth.priceDeltaMinor === original.operationalTruth.priceDeltaMinor, "PRICE_CHANGED"],
    [candidate.operationalTruth.durationDeltaMinutes === original.operationalTruth.durationDeltaMinutes, "DURATION_CHANGED"],
    [candidate.operationalTruth.requiresCustomerApproval === original.operationalTruth.requiresCustomerApproval, "APPROVAL_CHANGED"],
    [candidate.source.id === original.source.id && candidate.source.version === original.source.version, "SOURCE_CHANGED"],
    [candidate.rubric.version === original.rubric.version && candidate.rubric.expectedAction === original.rubric.expectedAction, "RUBRIC_CHANGED"],
  ];
  const failed = checks.find(([valid]) => !valid);
  return failed ? { valid: false, reason: failed[1] } : { valid: true };
}

export function evaluateReplayAttempt(replay: Replay, answer: ReplayAnswer) {
  if (answer === replay.rubric.expectedAction)
    return { result: "DEMONSTRATED" as const, correction: null, criterionScores: { recognisedException: true, checkedBooking: true, preservedApproval: true, stayedSafe: true } };
  return {
    result: "RETRY_REQUIRED" as const,
    correction: "Check the booking in TaskConfirm and get the required customer approval before promising the work.",
    criterionScores: { recognisedException: false, checkedBooking: false, preservedApproval: false, stayedSafe: answer !== "UNSAFE_CONTINUE" },
  };
}

export function mapReplayTranscriptToAnswer(transcript: string): ReplayAnswer {
  const text = transcript.toLocaleLowerCase("en-IN");
  if (/cancel|रद्द/.test(text)) return "CANCEL_BOOKING";
  if (/complete|पूरा/.test(text)) return "MARK_COMPLETE";
  if (/price|कीमत|₹|rupee/.test(text)) return "INVENT_PRICE";
  if (/without approval|बिना मंज़ूरी|बिना मंजूरी|start now|included.*start/.test(text)) return "BYPASS_APPROVAL";
  if (/taskconfirm|booking.*(?:check|जाँच|जांच)|(?:check|जाँच|जांच).*booking/.test(text)) return "OPEN_TASK_CONFIRM";
  return "PROMISE_INCLUDED";
}
