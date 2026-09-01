import { describe, expect, it } from "vitest";

import {
  resolvePolicy,
  type PolicyResolutionInput,
  type PolicyRuleSnapshot,
} from "./policy-decision";

const NOW = "2026-09-01T10:00:00.000Z";

const decisions = [
  ["bathroom_cleaning_standard_1", "INCLUDED_CONTINUE"],
  ["balcony_deep_cleaning", "ADD_ON_APPROVAL_REQUIRED"],
  ["inside_cabinet_cleaning", "TRADE_OFF_REQUIRED"],
  ["wardrobe_assembly", "NOT_SUPPORTED"],
  ["exposed_live_wire_response", "SAFETY_ESCALATION"],
] as const;

const ruleFor = (
  taskId: (typeof decisions)[number][0],
  decisionState: (typeof decisions)[number][1],
): PolicyRuleSnapshot => ({
  tenantId: "tenant-a",
  ruleKey: `rule-${taskId}`,
  version: "rule-v2",
  sourceKey: "approved-policy",
  sourceVersion: "source-v2",
  serviceId: "home-cleaning",
  catalogVersion: "catalog-v3",
  taskId,
  decisionState,
  durationDeltaMinutes: decisionState === "ADD_ON_APPROVAL_REQUIRED" ? 25 : 0,
  priceDeltaMinor: decisionState === "ADD_ON_APPROVAL_REQUIRED" ? 29_900 : 0,
  currency: "INR",
  removableTaskIds:
    decisionState === "TRADE_OFF_REQUIRED" ? ["floor_cleaning"] : [],
  requiresCustomerRequestConfirmation:
    decisionState !== "INCLUDED_CONTINUE" && decisionState !== "SAFETY_ESCALATION",
  requiresCustomerCommercialApproval:
    decisionState === "ADD_ON_APPROVAL_REQUIRED",
  requiresHumanReview: decisionState === "SAFETY_ESCALATION",
  requiresWorkerFeasibilityConfirmation: decisionState === "TRADE_OFF_REQUIRED",
  roleTags: ["cleaning_specialist"],
  regionTags: ["Mumbai"],
  specificity: 2,
  prohibitedActions: ["CANCEL_BOOKING"],
  active: true,
  effectiveFrom: "2026-08-01T00:00:00.000Z",
  effectiveTo: null,
  priority: 10,
});

function fixtureInput(
  taskId: (typeof decisions)[number][0] = "balcony_deep_cleaning",
): PolicyResolutionInput {
  const decisionState = decisions.find(([id]) => id === taskId)?.[1];
  if (!decisionState) throw new Error("Missing fixture decision.");
  return {
    currentTime: NOW,
    booking: {
      tenantId: "tenant-a",
      bookingKey: "BOOKING-1",
      version: 7,
      serviceId: "home-cleaning",
      catalogVersion: "catalog-v3",
      includedTaskIds: ["bathroom_cleaning_standard_1"],
      workerRole: "cleaning_specialist",
      city: "Mumbai",
    },
    selectedTask: {
      tenantId: "tenant-a",
      taskId,
      catalogVersion: "catalog-v3",
      active: true,
    },
    sources: [
      {
        tenantId: "tenant-a",
        sourceKey: "approved-policy",
        version: "source-v2",
        status: "ACTIVE",
        effectiveFrom: "2026-08-01T00:00:00.000Z",
        effectiveTo: null,
        priority: 10,
      },
    ],
    rules: [ruleFor(taskId, decisionState)],
  };
}

describe("resolvePolicy", () => {
  it.each(decisions)("resolves %s as %s", (taskId, expected) => {
    expect(resolvePolicy(fixtureInput(taskId))).toMatchObject({
      kind: "DECISION",
      decisionState: expected,
    });
  });

  it.each([
    ["INCLUDED_CONTINUE", ["CONTINUE_BOOKED_WORK", "REPORT_POLICY_ERROR"]],
    [
      "ADD_ON_APPROVAL_REQUIRED",
      ["REQUEST_CUSTOMER_APPROVAL", "CONTINUE_ORIGINAL_BOOKING"],
    ],
    ["TRADE_OFF_REQUIRED", ["REQUEST_CUSTOMER_TRADE_OFF"]],
    ["NOT_SUPPORTED", ["CONTINUE_ORIGINAL_BOOKING", "REQUEST_HUMAN_REVIEW"]],
    ["SAFETY_ESCALATION", ["STOP_AFFECTED_WORK", "CONTACT_SUPERVISOR"]],
  ] as const)("fixes allowed actions for %s", (decisionState, allowedActions) => {
    const taskId = decisions.find(([, state]) => state === decisionState)?.[0];
    if (!taskId) throw new Error("Missing task fixture.");
    expect(resolvePolicy(fixtureInput(taskId))).toMatchObject({ allowedActions });
  });

  it.each([
    ["inactive task", (input: PolicyResolutionInput) => ({ ...input, selectedTask: { ...input.selectedTask, active: false } }), "CANNOT_VERIFY"],
    ["catalogue mismatch", (input: PolicyResolutionInput) => ({ ...input, selectedTask: { ...input.selectedTask, catalogVersion: "old-catalog" } }), "CANNOT_VERIFY"],
    ["missing source", (input: PolicyResolutionInput) => ({ ...input, sources: [] }), "CANNOT_VERIFY"],
    ["inactive source", (input: PolicyResolutionInput) => ({ ...input, sources: input.sources.map((source) => ({ ...source, status: "INACTIVE" as const })) }), "CANNOT_VERIFY"],
    ["future source", (input: PolicyResolutionInput) => ({ ...input, sources: input.sources.map((source) => ({ ...source, effectiveFrom: "2026-10-01T00:00:00.000Z" })) }), "CANNOT_VERIFY"],
    ["stale source", (input: PolicyResolutionInput) => ({ ...input, sources: input.sources.map((source) => ({ ...source, effectiveTo: "2026-08-31T00:00:00.000Z" })) }), "CANNOT_VERIFY"],
    ["missing rule", (input: PolicyResolutionInput) => ({ ...input, rules: [] }), "CANNOT_VERIFY"],
    ["rule/source mismatch", (input: PolicyResolutionInput) => ({ ...input, rules: input.rules.map((rule) => ({ ...rule, sourceVersion: "source-v1" })) }), "CANNOT_VERIFY"],
    ["included rule missing from booking", (input: PolicyResolutionInput) => ({
      ...fixtureInput("bathroom_cleaning_standard_1"),
      booking: { ...input.booking, includedTaskIds: [] },
    }), "CANNOT_VERIFY"],
  ] as const)("abstains for %s", (_name, mutate, supportState) => {
    const result = resolvePolicy(mutate(fixtureInput()));
    expect(result).toEqual({
      kind: "ABSTENTION",
      supportState,
      reason: expect.any(String),
    });
    expect(result).not.toHaveProperty("priceDeltaMinor");
    expect(result).not.toHaveProperty("durationDeltaMinutes");
    expect(result).not.toHaveProperty("allowedActions");
  });

  it("reports conflict when equally applicable rules disagree", () => {
    const input = fixtureInput();
    const conflictingRule: PolicyRuleSnapshot = {
      ...input.rules[0]!,
      ruleKey: "other-rule",
      decisionState: "NOT_SUPPORTED" as const,
    };
    expect(resolvePolicy({ ...input, rules: [...input.rules, conflictingRule] })).toEqual({
      kind: "ABSTENTION",
      supportState: "SOURCE_CONFLICT",
      reason: expect.any(String),
    });
  });

  it("accepts equally authoritative rules when their decision data agrees", () => {
    const input = fixtureInput();
    const agreeingRule: PolicyRuleSnapshot = {
      ...input.rules[0]!,
      ruleKey: "same-decision-other-rule",
    };
    expect(resolvePolicy({ ...input, rules: [...input.rules, agreeingRule] }))
      .toMatchObject({
        kind: "DECISION",
        decisionState: "ADD_ON_APPROVAL_REQUIRED",
      });
  });

  it("uses unique highest precedence source and rule", () => {
    const input = fixtureInput();
    const olderSource: PolicyResolutionInput["sources"][number] = {
      ...input.sources[0]!,
      version: "source-v1",
      priority: 5,
    };
    const olderRule: PolicyRuleSnapshot = {
      ...input.rules[0]!,
      ruleKey: "older-rule",
      version: "rule-v1",
      sourceVersion: "source-v1",
      priority: 5,
      decisionState: "NOT_SUPPORTED" as const,
    };
    expect(resolvePolicy({ ...input, sources: [...input.sources, olderSource], rules: [...input.rules, olderRule] })).toMatchObject({
      kind: "DECISION",
      decisionState: "ADD_ON_APPROVAL_REQUIRED",
      sourceVersion: "source-v2",
      ruleKey: "rule-balcony_deep_cleaning",
    });
  });

  it("returns the same hash for reordered inputs", () => {
    const input = fixtureInput();
    const first = resolvePolicy(input);
    const second = resolvePolicy({ ...input, sources: [...input.sources].reverse(), rules: [...input.rules].reverse() });
    expect(first).toMatchObject({ kind: "DECISION", decisionHash: expect.any(String) });
    expect(second).toMatchObject({ kind: "DECISION", decisionHash: (first as { decisionHash: string }).decisionHash });
  });

  it("scopes rules to worker role and city", () => {
    const input = fixtureInput();
    expect(resolvePolicy({ ...input, booking: { ...input.booking, city: "Pune" } }))
      .toMatchObject({ kind: "ABSTENTION", supportState: "CANNOT_VERIFY" });
  });

  it("changes the hash when authoritative decision data changes", () => {
    const input = fixtureInput();
    const first = resolvePolicy(input);
    const second = resolvePolicy({
      ...input,
      rules: input.rules.map((rule) => ({ ...rule, priceDeltaMinor: 30_000 })),
    });
    expect((second as { decisionHash: string }).decisionHash).not.toBe(
      (first as { decisionHash: string }).decisionHash,
    );
  });
});
