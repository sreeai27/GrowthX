import {
  resolvePolicy,
  type PolicyResolutionInput,
  type PolicyRuleSnapshot,
} from "./policy-decision";

export function orchestratePolicyDecision(
  input: PolicyResolutionInput & { readonly bookingVersion: number },
) {
  const result = resolvePolicy(input);
  if (result.kind === "DECISION") {
    const rule = input.rules.find(
        (candidate) =>
          candidate.ruleKey === result.ruleKey &&
          candidate.version === result.ruleVersion,
      );
    const status = result.decisionState !== "SAFETY_ESCALATION"
      ? ("DECISION_READY" as const)
      : ("AWAITING_HUMAN_REVIEW" as const);
    return { result, supported: true as const, rule, status, decisionHash: result.decisionHash };
  }
  return {
    result,
    supported: false as const,
    rule: undefined,
    status: "AWAITING_HUMAN_REVIEW" as const,
    decisionHash: `abstention:${input.bookingVersion}:${input.selectedTask.taskId}:${result.supportState}`,
  };
}

export function policyOutcome(
  orchestration: ReturnType<typeof orchestratePolicyDecision>,
) {
  const { result, rule } = orchestration;
  if (result.kind !== "DECISION") return {
    decisionState: undefined,
    supportState: result.supportState,
    durationDeltaMinutes: undefined,
    priceDeltaMinor: undefined,
    currency: undefined,
    removableTaskIds: [],
    requirements: {
      customerRequestConfirmation: false,
      customerCommercialApproval: false,
      humanReview: true,
      workerFeasibilityConfirmation: false,
    },
    allowedActions: [],
    prohibitedActions: ["CANCEL_BOOKING"],
    explanationKey: result.supportState,
  };
  return {
    decisionState: result.decisionState,
    supportState: result.supportState,
    durationDeltaMinutes: result.durationDeltaMinutes,
    priceDeltaMinor: result.priceDeltaMinor,
    currency: result.currency,
    removableTaskIds: [...result.removableTaskIds],
    requirements: {
      customerRequestConfirmation:
        result.requiresCustomerRequestConfirmation,
      customerCommercialApproval:
        result.requiresCustomerCommercialApproval,
      humanReview: result.requiresHumanReview,
      workerFeasibilityConfirmation:
        result.requiresWorkerFeasibilityConfirmation,
    },
    allowedActions: [...result.allowedActions],
    prohibitedActions: rule?.prohibitedActions ?? ["CANCEL_BOOKING"],
    explanationKey: result.decisionState,
  };
}

export function policyResolutionSummary(
  orchestration: ReturnType<typeof orchestratePolicyDecision>,
) {
  return {
    status: orchestration.status,
    supportState: orchestration.result.supportState,
    decisionState: orchestration.supported ? orchestration.result.decisionState : undefined,
    taskId: orchestration.result.kind === "DECISION"
      ? orchestration.result.taskId
      : undefined,
    decisionHash: orchestration.decisionHash,
  };
}

export type EvidencedPolicyRule = PolicyRuleSnapshot & {
  readonly passageKey?: string;
};
