import { describe, expect, it } from "vitest";

import {
  privateResultPublicViewSchema,
  projectPrivateResultPublicView,
} from "./private-demo-result";

const safeView = {
  kind: "ACTIVE" as const,
  status: "DELIVERED" as const,
  expiresAt: "2026-09-09T10:00:00.000Z",
  maskedDisplay: "v***@example.com",
  snapshot: {
    requestSummary: "Clean the balcony too.",
    policyOutcome: {
      decisionState: "ADD_ON_APPROVAL_REQUIRED",
      sourceKey: "taskconfirm-demo-policy",
      sourceVersion: "v1",
    },
    customerDecision: "APPROVE",
    finalReceipt: {
      connector: "DEMONSTRATION_CONNECTOR",
      externalActionId: "ACT-DEMO-1",
      status: "SUCCEEDED",
      executedAt: "2026-09-02T10:00:00.000Z",
    },
  },
};

describe("private demo result gateway contracts", () => {
  it("parses Convex and fixture shaped values to the same safe view", () => {
    expect(privateResultPublicViewSchema.parse(safeView)).toEqual(safeView);
    expect(projectPrivateResultPublicView(safeView)).toEqual(safeView);
  });

  it("rejects secrets and internal identity fields from public projections", () => {
    for (const field of [
      "tenantId",
      "tokenHash",
      "contactCiphertext",
      "browserTokenHash",
      "providerError",
      "transcript",
      "trace",
    ]) {
      expect(() =>
        privateResultPublicViewSchema.parse({ ...safeView, [field]: "private" }),
      ).toThrow();
    }
  });
});
