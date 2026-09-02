import { describe, expect, it } from "vitest";

import {
  demoContactInputSchema,
  evaluateDemoSendLimit,
  invitationRetentionExpiresAt,
  normaliseDemoContact,
  redactDeliveryError,
  resultRetentionExpiresAt,
  resultSnapshotSchema,
  resultTokenExpiresAt,
} from "./private-demo-result";

describe("demo contact", () => {
  it("normalises and masks an email without treating it as verified identity", () => {
    expect(normaliseDemoContact({ contact: " Visitor@Example.COM " })).toEqual({
      type: "EMAIL",
      normalised: "visitor@example.com",
      maskedDisplay: "v***@example.com",
    });
  });

  it("normalises common Indian mobile formatting", () => {
    expect(normaliseDemoContact({ contact: "098765 43210" })).toEqual({
      type: "INDIAN_MOBILE",
      normalised: "+919876543210",
      maskedDisplay: "+91******3210",
    });
    expect(normaliseDemoContact({ contact: "+91 98765-43210" }).normalised).toBe(
      "+919876543210",
    );
  });

  it.each(["+14155552671", "5123456789", "not-an-email", "a@b"])(
    "rejects unsupported contact %s",
    (contact) => expect(() => normaliseDemoContact({ contact })).toThrow(),
  );

  it("rejects unknown external input fields", () => {
    expect(() =>
      demoContactInputSchema.parse({ contact: "visitor@example.com", verified: true }),
    ).toThrow();
  });
});

describe("private result retention", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");

  it("expires the link after seven days and the retained run after thirty days", () => {
    expect(resultTokenExpiresAt(now)).toBe("2026-09-09T12:00:00.000Z");
    expect(resultRetentionExpiresAt(now)).toBe("2026-10-02T12:00:00.000Z");
  });

  it("expires invitation consent after six calendar months", () => {
    expect(invitationRetentionExpiresAt(new Date("2026-08-31T12:00:00.000Z"))).toBe(
      "2027-02-28T12:00:00.000Z",
    );
  });
});

describe("private result public snapshot", () => {
  it("accepts only the four public result sections", () => {
    const snapshot = {
      requestSummary: "Balcony deep cleaning requested",
      policyOutcome: {
        decisionState: "ADD_ON_APPROVAL_REQUIRED",
        sourceKey: "taskconfirm-policy",
        sourceVersion: "1.0.0",
      },
      customerDecision: "APPROVE",
      finalReceipt: {
        connector: "DEMONSTRATION_CONNECTOR",
        externalActionId: "demo-action-1",
        status: "SUCCEEDED",
        executedAt: "2026-09-02T12:00:00.000Z",
      },
    };
    expect(resultSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(() => resultSnapshotSchema.parse({ ...snapshot, transcript: "private" })).toThrow();
  });
});

describe("demo send limits", () => {
  it("allows an attempt below both limits", () => {
    expect(
      evaluateDemoSendLimit({
        browserAttemptsInLastHour: 2,
        contactAttemptsInLastDay: 4,
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks the third prior browser attempt", () => {
    expect(
      evaluateDemoSendLimit({
        browserAttemptsInLastHour: 3,
        contactAttemptsInLastDay: 0,
      }),
    ).toEqual({
      allowed: false,
      reason: "BROWSER_HOURLY_LIMIT",
      retryAfterSeconds: 3600,
    });
  });

  it("blocks the fifth prior contact attempt", () => {
    expect(
      evaluateDemoSendLimit({
        browserAttemptsInLastHour: 0,
        contactAttemptsInLastDay: 5,
      }),
    ).toEqual({
      allowed: false,
      reason: "CONTACT_DAILY_LIMIT",
      retryAfterSeconds: 86400,
    });
  });

  it("rejects invalid attempt counts", () => {
    expect(() =>
      evaluateDemoSendLimit({
        browserAttemptsInLastHour: -1,
        contactAttemptsInLastDay: 0,
      }),
    ).toThrow();
  });
});

describe("delivery errors", () => {
  it("maps errors to bounded public values without leaking provider details", () => {
    const result = redactDeliveryError(new Error("Authorization: secret-token"));
    expect(result).toEqual({
      code: "TEMPORARY_PROVIDER_FAILURE",
      message: "We could not send your result right now. Please try again.",
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("preserves only explicitly classified safe error categories", () => {
    expect(redactDeliveryError({ code: "INVALID_PROVIDER_RESPONSE" })).toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE",
    });
    expect(redactDeliveryError({ code: "PERMANENT_PROVIDER_FAILURE" })).toMatchObject({
      code: "PERMANENT_PROVIDER_FAILURE",
    });
  });
});
