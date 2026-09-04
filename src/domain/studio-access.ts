import { z } from "zod";

const MINUTE_MS = 60 * 1_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const studioRoleSchema = z.enum(["OPERATOR", "PLATFORM_ADMIN"]);
export type StudioRole = z.infer<typeof studioRoleSchema>;

export const studioActionSchema = z.enum([
  "VIEW_MASKED_CONTACTS",
  "REVEAL_CONTACT",
  "REVIEW_DELETION",
  "EXECUTE_DELETION",
]);
export type StudioAction = z.infer<typeof studioActionSchema>;

export const contactRevealPurposeSchema = z.enum([
  "RESULT_DELIVERY",
  "ACCOUNT_INVITATION",
]);
export type ContactRevealPurpose = z.infer<typeof contactRevealPurposeSchema>;

const linkSchema = z
  .object({
    tokenHash: z.string().min(1),
    issuedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    consumedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
export type OneTimeLink = z.infer<typeof linkSchema>;

const issueLinkInputSchema = z
  .object({ tokenHash: z.string().min(1), now: z.date() })
  .strict();

export function issueOneTimeLink(input: unknown): OneTimeLink {
  const { tokenHash, now } = issueLinkInputSchema.parse(input);
  return {
    tokenHash,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 15 * MINUTE_MS).toISOString(),
  };
}

const consumeLinkInputSchema = z
  .object({ link: linkSchema, tokenHash: z.string().min(1), now: z.date() })
  .strict();

export type ConsumeOneTimeLinkDecision =
  | {
      readonly authorised: true;
      readonly consumedAt: string;
      readonly sessionExpiresAt: string;
    }
  | {
      readonly authorised: false;
      readonly reason: "LINK_ALREADY_USED" | "LINK_EXPIRED" | "TOKEN_MISMATCH";
    };

export function consumeOneTimeLink(input: unknown): ConsumeOneTimeLinkDecision {
  const { link, tokenHash, now } = consumeLinkInputSchema.parse(input);
  if (link.consumedAt) return { authorised: false, reason: "LINK_ALREADY_USED" };
  if (link.tokenHash !== tokenHash) return { authorised: false, reason: "TOKEN_MISMATCH" };
  if (Date.parse(link.expiresAt) <= now.getTime()) {
    return { authorised: false, reason: "LINK_EXPIRED" };
  }
  return {
    authorised: true,
    consumedAt: now.toISOString(),
    sessionExpiresAt: new Date(now.getTime() + 8 * HOUR_MS).toISOString(),
  };
}

const studioActionInputSchema = z
  .object({
    role: studioRoleSchema,
    action: studioActionSchema,
    purpose: z.string().optional(),
  })
  .strict();

export type StudioAuthorisation =
  | { readonly authorised: true }
  | { readonly authorised: false; readonly reason: "NOT_AUTHORISED" };

export function authoriseStudioAction(input: unknown): StudioAuthorisation {
  const parsed = studioActionInputSchema.safeParse(input);
  if (!parsed.success) return { authorised: false, reason: "NOT_AUTHORISED" };
  const { role, action, purpose } = parsed.data;
  if (action === "VIEW_MASKED_CONTACTS") return { authorised: true };
  if (role !== "PLATFORM_ADMIN") return { authorised: false, reason: "NOT_AUTHORISED" };
  if (action === "REVEAL_CONTACT") {
    if (!contactRevealPurposeSchema.safeParse(purpose).success) {
      return { authorised: false, reason: "NOT_AUTHORISED" };
    }
  }
  return { authorised: true };
}

export const deletionStatusSchema = z.enum([
  "NONE",
  "REQUESTED",
  "UNCERTAIN_PENDING_REVIEW",
  "REFUSED_PENDING_REVIEW",
  "APPROVED",
  "REFUSED",
  "DELETED",
]);
export type DeletionStatus = z.infer<typeof deletionStatusSchema>;

export const deletionTransitionSchema = z.enum([
  "REQUEST",
  "APPROVE",
  "MARK_UNCERTAIN",
  "REFUSE",
  "SECOND_REVIEW_APPROVE",
  "SECOND_REVIEW_UPHOLD_REFUSAL",
  "EXECUTE",
]);
export type DeletionTransition = z.infer<typeof deletionTransitionSchema>;

export type DeletionRequest = {
  readonly status: DeletionStatus;
  readonly requestedBy?: string;
  readonly requestedAt?: string;
  readonly dueAt?: string;
  readonly evidence?: string;
  readonly reason?: string;
  readonly decidedBy?: string;
  readonly decidedAt?: string;
  readonly secondReviewedBy?: string;
  readonly secondReviewedAt?: string;
  readonly deletedAt?: string;
};

const deletionRequestSchema: z.ZodType<DeletionRequest> = z
  .object({
    status: deletionStatusSchema,
    requestedBy: z.string().min(1).optional(),
    requestedAt: z.string().datetime({ offset: true }).optional(),
    dueAt: z.string().datetime({ offset: true }).optional(),
    evidence: z.string().trim().min(1).max(2_000).optional(),
    reason: z.string().trim().min(1).max(2_000).optional(),
    decidedBy: z.string().min(1).optional(),
    decidedAt: z.string().datetime({ offset: true }).optional(),
    secondReviewedBy: z.string().min(1).optional(),
    secondReviewedAt: z.string().datetime({ offset: true }).optional(),
    deletedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

const deletionTransitionInputSchema = z
  .object({
    request: deletionRequestSchema,
    transition: deletionTransitionSchema,
    actorId: z.string().min(1),
    now: z.date(),
    evidence: z.string().trim().min(1).max(2_000).optional(),
    reason: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

function requireReason(reason: string | undefined): string {
  if (!reason) throw new Error("A reason is required for this deletion transition.");
  return reason;
}

export function transitionDeletionRequest(input: unknown): DeletionRequest {
  const { request, transition, actorId, now, evidence, reason } =
    deletionTransitionInputSchema.parse(input);
  const at = now.toISOString();

  if (request.status === "NONE" && transition === "REQUEST") {
    if (!evidence) throw new Error("Evidence is required for a deletion request.");
    return {
      status: "REQUESTED",
      requestedBy: actorId,
      requestedAt: at,
      dueAt: new Date(now.getTime() + 7 * DAY_MS).toISOString(),
      evidence,
      reason: requireReason(reason),
    };
  }

  if (request.status === "REQUESTED") {
    if (transition === "APPROVE") {
      return { ...request, status: "APPROVED", decidedBy: actorId, decidedAt: at, reason: requireReason(reason) };
    }
    if (transition === "MARK_UNCERTAIN") {
      return { ...request, status: "UNCERTAIN_PENDING_REVIEW", decidedBy: actorId, decidedAt: at, reason: requireReason(reason) };
    }
    if (transition === "REFUSE") {
      return { ...request, status: "REFUSED_PENDING_REVIEW", decidedBy: actorId, decidedAt: at, reason: requireReason(reason) };
    }
  }

  if (
    (request.status === "UNCERTAIN_PENDING_REVIEW" || request.status === "REFUSED_PENDING_REVIEW") &&
    (transition === "SECOND_REVIEW_APPROVE" || transition === "SECOND_REVIEW_UPHOLD_REFUSAL")
  ) {
    if (request.decidedBy === actorId) {
      throw new Error("A different platform administrator must perform the second review.");
    }
    return {
      ...request,
      status: transition === "SECOND_REVIEW_APPROVE" ? "APPROVED" : "REFUSED",
      secondReviewedBy: actorId,
      secondReviewedAt: at,
      reason: requireReason(reason),
    };
  }

  if (request.status === "APPROVED" && transition === "EXECUTE") {
    return { ...request, status: "DELETED", deletedAt: at };
  }

  throw new Error(`Invalid deletion transition: ${request.status} -> ${transition}.`);
}

const retentionInputSchema = z
  .object({ createdAt: z.string().datetime({ offset: true }), now: z.date() })
  .strict();

export type RetentionDisposition =
  | { readonly disposition: "RETAIN_FULL_DATA"; readonly expiresAt: string }
  | {
      readonly disposition: "DELETE_PERSONAL_DATA";
      readonly retain: readonly ["ANONYMOUS_TOTALS", "NON_IDENTIFYING_RECEIPTS"];
    };

export function retentionDisposition(input: unknown): RetentionDisposition {
  const { createdAt, now } = retentionInputSchema.parse(input);
  const expiresAt = new Date(Date.parse(createdAt) + 30 * DAY_MS);
  if (expiresAt.getTime() > now.getTime()) {
    return { disposition: "RETAIN_FULL_DATA", expiresAt: expiresAt.toISOString() };
  }
  return {
    disposition: "DELETE_PERSONAL_DATA",
    retain: ["ANONYMOUS_TOTALS", "NON_IDENTIFYING_RECEIPTS"],
  };
}
