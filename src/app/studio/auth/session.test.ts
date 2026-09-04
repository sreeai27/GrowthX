import { describe, expect, it } from "vitest";
import { newStudioSessionToken, studioTokenHash } from "./session";

describe("Studio session token", () => {
  it("creates opaque tokens and shares only a stable hash with persistence", () => {
    const token = newStudioSessionToken();
    expect(token).toHaveLength(43);
    expect(studioTokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(studioTokenHash(token)).not.toContain(token);
  });
});
