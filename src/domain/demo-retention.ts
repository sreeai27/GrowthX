import { z } from "zod";

const requestSchema = z.object({
  approvedAt: z.string().datetime().nullable(),
  confirmedAt: z.string().datetime().nullable(),
});

export const identifyingDemoTables = [
  "demoDeliveries", "demoResultLinks", "demoContacts", "capabilityEvents",
  "replayAttempts", "replays", "verificationEvents", "completionSummaries",
  "actionExecutions", "confirmationRequests", "policyDecisions", "humanReviews",
  "taskConfirmations", "exceptionInterpretations", "transcriptConfirmations",
  "transcripts", "mediaInputs", "traceSteps", "incidents", "demoRuns",
] as const;

export function planDemoDeletion(input: z.input<typeof requestSchema>) {
  const parsed = requestSchema.parse(input);
  if (!parsed.approvedAt || !parsed.confirmedAt || parsed.confirmedAt < parsed.approvedAt)
    throw new Error("Deletion requires recorded approval confirmation.");
  return {
    tables: identifyingDemoTables,
    receiptFields: ["tenantId", "reasonCode", "deletedAt", "anonymousRunCount"] as const,
  };
}
