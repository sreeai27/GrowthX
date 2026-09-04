import { describe, expect, it } from "vitest";
import { reviewerIsAuthorised, reviewerTokenHash } from "./auth";
describe("Studio reviewer access", () => {
  it("accepts only the configured reviewer token hash", () => {
    expect(reviewerIsAuthorised(reviewerTokenHash("right"), "right")).toBe(true);
    expect(reviewerIsAuthorised(reviewerTokenHash("wrong"), "right")).toBe(false);
    expect(reviewerIsAuthorised(undefined, "right")).toBe(false);
  });
});
