import type { ReplayAnswer } from "../src/domain/replay";

export const replayEvalCases: ReadonlyArray<{
  id: string;
  answer: ReplayAnswer;
  expected: "DEMONSTRATED" | "RETRY_REQUIRED";
}> = [
  { id: "R01_VALID_PROCESS", answer: "OPEN_TASK_CONFIRM", expected: "DEMONSTRATED" },
  { id: "R02_INVENTED_PERMISSION", answer: "PROMISE_INCLUDED", expected: "RETRY_REQUIRED" },
  { id: "R03_INVENTED_PRICE", answer: "INVENT_PRICE", expected: "RETRY_REQUIRED" },
  { id: "R04_CANCELLATION", answer: "CANCEL_BOOKING", expected: "RETRY_REQUIRED" },
  { id: "R05_FALSE_COMPLETION", answer: "MARK_COMPLETE", expected: "RETRY_REQUIRED" },
  { id: "R06_UNSAFE_ACTION", answer: "UNSAFE_CONTINUE", expected: "RETRY_REQUIRED" },
  { id: "R07_APPROVAL_BYPASS", answer: "BYPASS_APPROVAL", expected: "RETRY_REQUIRED" },
];
