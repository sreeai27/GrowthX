import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1_000;
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export const demoContactInputSchema = z
  .object({ contact: z.string().trim().min(1).max(320) })
  .strict();

export type DemoContact = {
  readonly type: "EMAIL" | "INDIAN_MOBILE";
  readonly normalised: string;
  readonly maskedDisplay: string;
};

export function maskDemoContact(
  contact: Pick<DemoContact, "type" | "normalised">,
): string {
  if (contact.type === "INDIAN_MOBILE") {
    return `+91******${contact.normalised.slice(-4)}`;
  }
  const [local, domain] = contact.normalised.split("@");
  if (!local || !domain) throw new Error("A valid demo email is required.");
  return `${local[0]}***@${domain}`;
}

export function normaliseDemoContact(input: unknown): DemoContact {
  const { contact } = demoContactInputSchema.parse(input);
  const email = contact.toLowerCase();
  if (EMAIL_PATTERN.test(email)) {
    const result = { type: "EMAIL" as const, normalised: email };
    return { ...result, maskedDisplay: maskDemoContact(result) };
  }

  const digits = contact.replace(/[\s()-]/g, "").replace(/^\+/, "");
  const nationalNumber =
    /^0[6-9]\d{9}$/.test(digits)
      ? digits.slice(1)
      : /^91[6-9]\d{9}$/.test(digits)
        ? digits.slice(2)
        : /^[6-9]\d{9}$/.test(digits)
          ? digits
          : undefined;
  if (!nationalNumber) throw new Error("Enter a valid email or Indian mobile number.");
  const result = {
    type: "INDIAN_MOBILE" as const,
    normalised: `+91${nationalNumber}`,
  };
  return { ...result, maskedDisplay: maskDemoContact(result) };
}

const policyOutcomeSchema = z
  .object({
    decisionState: z.enum([
      "INCLUDED_CONTINUE",
      "ADD_ON_APPROVAL_REQUIRED",
      "TRADE_OFF_REQUIRED",
      "NOT_SUPPORTED",
      "SAFETY_ESCALATION",
    ]),
    sourceKey: z.string().min(1),
    sourceVersion: z.string().min(1),
  })
  .strict();

const finalReceiptSchema = z
  .object({
    connector: z.string().min(1),
    externalActionId: z.string().min(1),
    status: z.literal("SUCCEEDED"),
    executedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const resultSnapshotSchema = z
  .object({
    requestSummary: z.string().trim().min(1).max(2_000),
    policyOutcome: policyOutcomeSchema,
    customerDecision: z.enum(["APPROVE", "DECLINE", "NOT_REQUIRED"]),
    finalReceipt: finalReceiptSchema,
  })
  .strict();
export type ResultSnapshot = z.infer<typeof resultSnapshotSchema>;

export function resultTokenExpiresAt(now: Date): string {
  return new Date(now.getTime() + 7 * DAY_MS).toISOString();
}

export function resultRetentionExpiresAt(now: Date): string {
  return new Date(now.getTime() + 30 * DAY_MS).toISOString();
}

export function invitationRetentionExpiresAt(now: Date): string {
  const expiry = new Date(now);
  const originalDay = expiry.getUTCDate();
  expiry.setUTCDate(1);
  expiry.setUTCMonth(expiry.getUTCMonth() + 6);
  const nextMonth = new Date(expiry);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  nextMonth.setUTCDate(0);
  expiry.setUTCDate(Math.min(originalDay, nextMonth.getUTCDate()));
  return expiry.toISOString();
}

const sendLimitInputSchema = z
  .object({
    browserAttemptsInLastHour: z.number().int().nonnegative(),
    contactAttemptsInLastDay: z.number().int().nonnegative(),
  })
  .strict();

export type DemoSendLimitDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: "BROWSER_HOURLY_LIMIT" | "CONTACT_DAILY_LIMIT";
      readonly retryAfterSeconds: 3_600 | 86_400;
    };

export function evaluateDemoSendLimit(input: unknown): DemoSendLimitDecision {
  const counts = sendLimitInputSchema.parse(input);
  if (counts.browserAttemptsInLastHour >= 3) {
    return {
      allowed: false,
      reason: "BROWSER_HOURLY_LIMIT",
      retryAfterSeconds: 3_600,
    };
  }
  if (counts.contactAttemptsInLastDay >= 5) {
    return {
      allowed: false,
      reason: "CONTACT_DAILY_LIMIT",
      retryAfterSeconds: 86_400,
    };
  }
  return { allowed: true };
}

export type RedactedDeliveryError = {
  readonly code:
    | "TEMPORARY_PROVIDER_FAILURE"
    | "PERMANENT_PROVIDER_FAILURE"
    | "INVALID_PROVIDER_RESPONSE";
  readonly message: string;
};

export function redactDeliveryError(error: unknown): RedactedDeliveryError {
  const candidate = z
    .object({
      code: z.enum([
        "TEMPORARY_PROVIDER_FAILURE",
        "PERMANENT_PROVIDER_FAILURE",
        "INVALID_PROVIDER_RESPONSE",
      ]),
    })
    .passthrough()
    .safeParse(error);
  const code = candidate.success ? candidate.data.code : "TEMPORARY_PROVIDER_FAILURE";
  return {
    code,
    message:
      code === "PERMANENT_PROVIDER_FAILURE"
        ? "We could not send this result to that contact."
        : code === "INVALID_PROVIDER_RESPONSE"
          ? "The delivery service returned an invalid response. Please try again."
          : "We could not send your result right now. Please try again.",
  };
}
