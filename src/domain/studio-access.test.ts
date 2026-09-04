import { describe, expect, it } from "vitest";

import {
  authoriseStudioAction,
  consumeOneTimeLink,
  issueOneTimeLink,
  retentionDisposition,
  transitionDeletionRequest,
} from "./studio-access";

const now = new Date("2026-09-04T10:00:00.000Z");

describe("Studio access policy", () => {
  it("issues a one-use link for 15 minutes and an eight-hour session", () => {
    const link = issueOneTimeLink({ tokenHash: "hash-1", now });
    expect(link).toEqual({
      tokenHash: "hash-1",
      issuedAt: "2026-09-04T10:00:00.000Z",
      expiresAt: "2026-09-04T10:15:00.000Z",
    });

    expect(
      consumeOneTimeLink({ link, tokenHash: "hash-1", now: new Date("2026-09-04T10:14:59.999Z") }),
    ).toEqual({
      authorised: true,
      consumedAt: "2026-09-04T10:14:59.999Z",
      sessionExpiresAt: "2026-09-04T18:14:59.999Z",
    });
    expect(
      consumeOneTimeLink({
        link: { ...link, consumedAt: now.toISOString() },
        tokenHash: "hash-1",
        now,
      }),
    ).toEqual({ authorised: false, reason: "LINK_ALREADY_USED" });
    expect(
      consumeOneTimeLink({ link, tokenHash: "hash-1", now: new Date("2026-09-04T10:15:00.000Z") }),
    ).toEqual({ authorised: false, reason: "LINK_EXPIRED" });
  });

  it.each([
    ["OPERATOR", "VIEW_MASKED_CONTACTS", undefined, true],
    ["OPERATOR", "REVEAL_CONTACT", "RESULT_DELIVERY", false],
    ["PLATFORM_ADMIN", "REVEAL_CONTACT", "RESULT_DELIVERY", true],
    ["PLATFORM_ADMIN", "REVEAL_CONTACT", "ACCOUNT_INVITATION", true],
    ["PLATFORM_ADMIN", "REVEAL_CONTACT", "MARKETING", false],
    ["PLATFORM_ADMIN", "REVEAL_CONTACT", undefined, false],
  ] as const)("authorises %s to %s for %s", (role, action, purpose, allowed) => {
    expect(authoriseStudioAction({ role, action, purpose })).toEqual(
      allowed ? { authorised: true } : { authorised: false, reason: "NOT_AUTHORISED" },
    );
  });

  it("sets a seven-calendar-day deletion deadline and requires distinct second review", () => {
    const requested = transitionDeletionRequest({
      request: { status: "NONE" },
      transition: "REQUEST",
      actorId: "admin-a",
      now,
      evidence: "Visitor verified control of result link.",
      reason: "Visitor requested deletion.",
    });
    expect(requested.status).toBe("REQUESTED");
    expect(requested.dueAt).toBe("2026-09-11T10:00:00.000Z");

    const uncertain = transitionDeletionRequest({
      request: requested,
      transition: "MARK_UNCERTAIN",
      actorId: "admin-a",
      now,
      reason: "Evidence needs independent review.",
    });
    expect(() =>
      transitionDeletionRequest({
        request: uncertain,
        transition: "SECOND_REVIEW_APPROVE",
        actorId: "admin-a",
        now,
        reason: "Approved.",
      }),
    ).toThrow("A different platform administrator must perform the second review.");
    expect(
      transitionDeletionRequest({
        request: uncertain,
        transition: "SECOND_REVIEW_APPROVE",
        actorId: "admin-b",
        now,
        reason: "Evidence confirmed.",
      }).status,
    ).toBe("APPROVED");
  });

  it("allows one reasoned, distinct-administrator review of a refusal", () => {
    const refused = transitionDeletionRequest({
      request: {
        status: "REQUESTED",
        requestedBy: "admin-a",
        requestedAt: now.toISOString(),
        dueAt: "2026-09-11T10:00:00.000Z",
        evidence: "Request supplied.",
        reason: "Delete.",
      },
      transition: "REFUSE",
      actorId: "admin-a",
      now,
      reason: "Identity evidence did not match.",
    });
    expect(refused.status).toBe("REFUSED_PENDING_REVIEW");
    const upheld = transitionDeletionRequest({
      request: refused,
      transition: "SECOND_REVIEW_UPHOLD_REFUSAL",
      actorId: "admin-b",
      now,
      reason: "Mismatch independently confirmed.",
    });
    expect(upheld.status).toBe("REFUSED");
    expect(() =>
      transitionDeletionRequest({
        request: upheld,
        transition: "SECOND_REVIEW_APPROVE",
        actorId: "admin-a",
        now,
        reason: "Try again.",
      }),
    ).toThrow("Invalid deletion transition");
  });

  it("expires full demo data at 30 days and retains only anonymous records", () => {
    expect(
      retentionDisposition({ createdAt: now.toISOString(), now: new Date("2026-10-04T09:59:59.999Z") }),
    ).toEqual({ disposition: "RETAIN_FULL_DATA", expiresAt: "2026-10-04T10:00:00.000Z" });
    expect(
      retentionDisposition({ createdAt: now.toISOString(), now: new Date("2026-10-04T10:00:00.000Z") }),
    ).toEqual({ disposition: "DELETE_PERSONAL_DATA", retain: ["ANONYMOUS_TOTALS", "NON_IDENTIFYING_RECEIPTS"] });
  });
});
