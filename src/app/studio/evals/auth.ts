import { createHash, timingSafeEqual } from "node:crypto";

export const reviewerCookieName = "hunar_studio_reviewer";
export function reviewerTokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function reviewerIsAuthorised(cookie: string | undefined, configuredToken: string | undefined) {
  if (!cookie || !configuredToken) return false;
  const expected = reviewerTokenHash(configuredToken);
  return cookie.length === expected.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}
