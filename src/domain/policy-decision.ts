import { sha256Hex } from "./sha256";

export type DecisionState =
  | "INCLUDED_CONTINUE"
  | "ADD_ON_APPROVAL_REQUIRED"
  | "TRADE_OFF_REQUIRED"
  | "NOT_SUPPORTED"
  | "SAFETY_ESCALATION";

export type SupportState =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "CANNOT_VERIFY"
  | "SOURCE_CONFLICT"
  | "ESCALATED";

export type AllowedPolicyAction =
  | "CONTINUE_BOOKED_WORK"
  | "REPORT_POLICY_ERROR"
  | "REQUEST_CUSTOMER_APPROVAL"
  | "CONTINUE_ORIGINAL_BOOKING"
  | "REQUEST_CUSTOMER_TRADE_OFF"
  | "REQUEST_HUMAN_REVIEW"
  | "STOP_AFFECTED_WORK"
  | "CONTACT_SUPERVISOR";

export interface BookingPolicySnapshot {
  readonly tenantId: string;
  readonly bookingKey: string;
  readonly version: number;
  readonly serviceId: string;
  readonly catalogVersion: string;
  readonly includedTaskIds: readonly string[];
  readonly workerRole: string;
  readonly city: string;
}

export interface SelectedTaskSnapshot {
  readonly tenantId: string;
  readonly taskId: string;
  readonly catalogVersion: string;
  readonly active: boolean;
}

export interface PolicySourceSnapshot {
  readonly tenantId: string;
  readonly sourceKey: string;
  readonly version: string;
  readonly status: "ACTIVE" | "INACTIVE";
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly priority: number;
}

export interface PolicyRuleSnapshot {
  readonly tenantId: string;
  readonly ruleKey: string;
  readonly version: string;
  readonly sourceKey: string;
  readonly sourceVersion: string;
  readonly serviceId: string;
  readonly catalogVersion: string;
  readonly taskId: string;
  readonly decisionState: DecisionState;
  readonly durationDeltaMinutes: number;
  readonly priceDeltaMinor: number;
  readonly currency: string;
  readonly removableTaskIds: readonly string[];
  readonly requiresCustomerRequestConfirmation: boolean;
  readonly requiresCustomerCommercialApproval: boolean;
  readonly requiresHumanReview: boolean;
  readonly requiresWorkerFeasibilityConfirmation: boolean;
  readonly roleTags: readonly string[];
  readonly regionTags: readonly string[];
  readonly specificity: number;
  readonly prohibitedActions: readonly string[];
  readonly active: boolean;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly priority: number;
}

export interface PolicyResolutionInput {
  readonly currentTime: string;
  readonly booking: BookingPolicySnapshot;
  readonly selectedTask: SelectedTaskSnapshot;
  readonly sources: readonly PolicySourceSnapshot[];
  readonly rules: readonly PolicyRuleSnapshot[];
}

export interface PolicyDecision {
  readonly kind: "DECISION";
  readonly decisionState: DecisionState;
  readonly supportState: "SUPPORTED" | "ESCALATED";
  readonly taskId: string;
  readonly sourceKey: string;
  readonly sourceVersion: string;
  readonly ruleKey: string;
  readonly ruleVersion: string;
  readonly durationDeltaMinutes: number;
  readonly priceDeltaMinor: number;
  readonly currency: string;
  readonly removableTaskIds: readonly string[];
  readonly requiresCustomerRequestConfirmation: boolean;
  readonly requiresCustomerCommercialApproval: boolean;
  readonly requiresHumanReview: boolean;
  readonly requiresWorkerFeasibilityConfirmation: boolean;
  readonly allowedActions: readonly AllowedPolicyAction[];
  readonly decisionHash: string;
}

export interface PolicyAbstention {
  readonly kind: "ABSTENTION";
  readonly supportState: "CANNOT_VERIFY" | "SOURCE_CONFLICT" | "ESCALATED";
  readonly reason: string;
}

export type PolicyResolutionResult = PolicyDecision | PolicyAbstention;

const ACTIONS_BY_DECISION: Readonly<
  Record<DecisionState, readonly AllowedPolicyAction[]>
> = {
  INCLUDED_CONTINUE: ["CONTINUE_BOOKED_WORK", "REPORT_POLICY_ERROR"],
  ADD_ON_APPROVAL_REQUIRED: [
    "REQUEST_CUSTOMER_APPROVAL",
    "CONTINUE_ORIGINAL_BOOKING",
  ],
  TRADE_OFF_REQUIRED: ["REQUEST_CUSTOMER_TRADE_OFF"],
  NOT_SUPPORTED: ["CONTINUE_ORIGINAL_BOOKING", "REQUEST_HUMAN_REVIEW"],
  SAFETY_ESCALATION: ["STOP_AFFECTED_WORK", "CONTACT_SUPERVISOR"],
};

const abstain = (
  supportState: PolicyAbstention["supportState"],
  reason: string,
): PolicyAbstention => ({ kind: "ABSTENTION", supportState, reason });

function isEffective(
  effectiveFrom: string,
  effectiveTo: string | null,
  now: number,
): boolean {
  const from = Date.parse(effectiveFrom);
  const to = effectiveTo === null ? null : Date.parse(effectiveTo);
  return Number.isFinite(from) && from <= now && (to === null || (Number.isFinite(to) && now < to));
}

function uniqueHighestPriority<T extends { readonly priority: number; readonly specificity?: number }>(
  values: readonly T[],
  authorityFingerprint: (value: T) => string = (value) => JSON.stringify(value),
): T | "CONFLICT" | undefined {
  if (values.length === 0) return undefined;
  const highest = Math.max(...values.map(({ priority }) => priority));
  const priorityWinners = values.filter(({ priority }) => priority === highest);
  const mostSpecific = Math.max(...priorityWinners.map(({ specificity = 0 }) => specificity));
  const winners = priorityWinners.filter(({ specificity = 0 }) => specificity === mostSpecific);
  if (winners.length === 1) return winners[0];
  const fingerprint = authorityFingerprint(winners[0]!);
  return winners.every((winner) => authorityFingerprint(winner) === fingerprint)
    ? [...winners].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))[0]
    : "CONFLICT";
}

function decisionHash(input: {
  readonly booking: BookingPolicySnapshot;
  readonly taskId: string;
  readonly source: PolicySourceSnapshot;
  readonly rule: PolicyRuleSnapshot;
}): string {
  const canonical = JSON.stringify({
    bookingKey: input.booking.bookingKey,
    bookingVersion: input.booking.version,
    catalogVersion: input.booking.catalogVersion,
    ruleKey: input.rule.ruleKey,
    ruleVersion: input.rule.version,
    sourceKey: input.source.sourceKey,
    sourceVersion: input.source.version,
    taskId: input.taskId,
    decision: {
      state: input.rule.decisionState,
      durationDeltaMinutes: input.rule.durationDeltaMinutes,
      priceDeltaMinor: input.rule.priceDeltaMinor,
      currency: input.rule.currency,
      removableTaskIds: input.rule.removableTaskIds,
      requiresCustomerRequestConfirmation: input.rule.requiresCustomerRequestConfirmation,
      requiresCustomerCommercialApproval: input.rule.requiresCustomerCommercialApproval,
      requiresHumanReview: input.rule.requiresHumanReview,
      requiresWorkerFeasibilityConfirmation: input.rule.requiresWorkerFeasibilityConfirmation,
      allowedActions: ACTIONS_BY_DECISION[input.rule.decisionState],
      prohibitedActions: input.rule.prohibitedActions,
    },
  });
  return sha256Hex(canonical);
}

export function resolvePolicy(
  input: PolicyResolutionInput,
): PolicyResolutionResult {
  const now = Date.parse(input.currentTime);
  if (!Number.isFinite(now)) return abstain("CANNOT_VERIFY", "Current time is invalid.");
  if (
    !input.selectedTask.active ||
    input.selectedTask.tenantId !== input.booking.tenantId ||
    input.selectedTask.catalogVersion !== input.booking.catalogVersion
  ) {
    return abstain("CANNOT_VERIFY", "The selected task is not active in the booking catalogue.");
  }

  const source = uniqueHighestPriority(
    input.sources.filter(
      (candidate) =>
        candidate.tenantId === input.booking.tenantId &&
        candidate.status === "ACTIVE" &&
        isEffective(candidate.effectiveFrom, candidate.effectiveTo, now),
    ),
  );
  if (source === "CONFLICT") return abstain("SOURCE_CONFLICT", "Approved policy sources have equal precedence.");
  if (!source) return abstain("CANNOT_VERIFY", "No active approved policy source applies.");

  const rule = uniqueHighestPriority(
    input.rules.filter(
      (candidate) =>
        candidate.tenantId === input.booking.tenantId &&
        candidate.active &&
        candidate.serviceId === input.booking.serviceId &&
        candidate.catalogVersion === input.booking.catalogVersion &&
        candidate.taskId === input.selectedTask.taskId &&
        candidate.roleTags.includes(input.booking.workerRole) &&
        candidate.regionTags.includes(input.booking.city) &&
        candidate.sourceKey === source.sourceKey &&
        candidate.sourceVersion === source.version &&
        isEffective(candidate.effectiveFrom, candidate.effectiveTo, now),
    ),
    (candidate) => JSON.stringify({
      decisionState: candidate.decisionState,
      durationDeltaMinutes: candidate.durationDeltaMinutes,
      priceDeltaMinor: candidate.priceDeltaMinor,
      currency: candidate.currency,
      removableTaskIds: candidate.removableTaskIds,
      requiresCustomerRequestConfirmation:
        candidate.requiresCustomerRequestConfirmation,
      requiresCustomerCommercialApproval:
        candidate.requiresCustomerCommercialApproval,
      requiresHumanReview: candidate.requiresHumanReview,
      requiresWorkerFeasibilityConfirmation:
        candidate.requiresWorkerFeasibilityConfirmation,
      prohibitedActions: candidate.prohibitedActions,
    }),
  );
  if (rule === "CONFLICT") return abstain("SOURCE_CONFLICT", "Approved policy rules have equal precedence.");
  if (!rule) return abstain("CANNOT_VERIFY", "No approved policy rule supports this task.");
  if (
    rule.decisionState === "INCLUDED_CONTINUE" &&
    !input.booking.includedTaskIds.includes(input.selectedTask.taskId)
  ) {
    return abstain(
      "CANNOT_VERIFY",
      "The policy inclusion is not supported by the booking snapshot.",
    );
  }

  return {
    kind: "DECISION",
    decisionState: rule.decisionState,
    supportState: rule.decisionState === "SAFETY_ESCALATION" ? "ESCALATED" : "SUPPORTED",
    taskId: input.selectedTask.taskId,
    sourceKey: source.sourceKey,
    sourceVersion: source.version,
    ruleKey: rule.ruleKey,
    ruleVersion: rule.version,
    durationDeltaMinutes: rule.durationDeltaMinutes,
    priceDeltaMinor: rule.priceDeltaMinor,
    currency: rule.currency,
    removableTaskIds: [...rule.removableTaskIds],
    requiresCustomerRequestConfirmation: rule.requiresCustomerRequestConfirmation,
    requiresCustomerCommercialApproval: rule.requiresCustomerCommercialApproval,
    requiresHumanReview: rule.requiresHumanReview,
    requiresWorkerFeasibilityConfirmation:
      rule.requiresWorkerFeasibilityConfirmation,
    allowedActions: ACTIONS_BY_DECISION[rule.decisionState],
    decisionHash: decisionHash({ booking: input.booking, taskId: input.selectedTask.taskId, source, rule }),
  };
}
