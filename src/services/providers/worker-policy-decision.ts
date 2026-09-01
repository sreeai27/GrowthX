import { z } from "zod";

const taskSummarySchema = z.object({
  taskId: z.string().min(1),
  displayName: z.string().min(1),
});

const allowedPolicyActionSchema = z.enum([
  "CONTINUE_BOOKED_WORK",
  "REPORT_POLICY_ERROR",
  "REQUEST_CUSTOMER_APPROVAL",
  "CONTINUE_ORIGINAL_BOOKING",
  "REQUEST_CUSTOMER_TRADE_OFF",
  "REQUEST_HUMAN_REVIEW",
  "STOP_AFFECTED_WORK",
  "CONTACT_SUPERVISOR",
]);

export const workerPolicyDecisionViewSchema = z
  .object({
    incidentKey: z.string().min(1),
    status: z.enum(["DECISION_READY", "AWAITING_HUMAN_REVIEW"]),
    booking: z.object({
      bookingKey: z.literal("DEMO-4821"),
      bookingVersion: z.number().int().positive(),
      serviceName: z.string().min(1),
      scheduledDurationMinutes: z.number().int().nonnegative(),
      remainingDurationMinutes: z.number().int().nonnegative().default(0),
      catalogVersion: z.string().min(1),
      includedTasks: z.array(taskSummarySchema),
    }),
    selectedTask: taskSummarySchema.extend({
      catalogVersion: z.string().min(1),
    }),
    outcome: z.object({
      decisionState: z
        .enum([
          "INCLUDED_CONTINUE",
          "ADD_ON_APPROVAL_REQUIRED",
          "TRADE_OFF_REQUIRED",
          "NOT_SUPPORTED",
          "SAFETY_ESCALATION",
        ])
        .optional(),
      supportState: z.enum([
        "SUPPORTED",
        "PARTIALLY_SUPPORTED",
        "CANNOT_VERIFY",
        "SOURCE_CONFLICT",
        "ESCALATED",
      ]),
      durationDeltaMinutes: z.number().int().optional(),
      priceDeltaMinor: z.number().int().nonnegative().optional(),
      currency: z.string().min(1).optional(),
      removableTaskIds: z.array(z.string().min(1)),
      requirements: z.object({
        customerRequestConfirmation: z.boolean(),
        customerCommercialApproval: z.boolean(),
        humanReview: z.boolean(),
        workerFeasibilityConfirmation: z.boolean().default(false),
      }),
      allowedActions: z.array(allowedPolicyActionSchema),
      prohibitedActions: z.array(z.string().min(1)),
      explanationKey: z.string().min(1),
    }),
    authority: z
      .object({
        sourceKey: z.string().min(1),
        title: z.string().min(1),
        owner: z.string().min(1),
        version: z.string().min(1),
        effectiveFrom: z.string().datetime(),
        notice: z.string().min(1),
        ruleKey: z.string().min(1).optional(),
        ruleVersion: z.string().min(1).optional(),
        passage: z
          .object({
            passageKey: z.string().min(1),
            heading: z.string().min(1),
            text: z.string().min(1),
          })
          .nullable(),
      })
      .nullable(),
    decisionHash: z.string().min(1),
    createdAt: z.string().datetime(),
  })
  .superRefine((value, context) => {
    if (
      value.outcome.decisionState &&
      (!value.authority || !value.authority.passage)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["authority"],
        message: "A supported policy decision requires source passage evidence.",
      });
    }
  });

export type WorkerPolicyDecisionView = z.infer<
  typeof workerPolicyDecisionViewSchema
>;
