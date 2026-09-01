import { describe, expect, it } from "vitest";

import { parseEnvironment } from "./env";

describe("parseEnvironment", () => {
  it("accepts an empty local environment without exposing server secrets", () => {
    expect(parseEnvironment({})).toEqual({
      features: {
        voiceCapture: false,
        openAiMapping: false,
        fixtureMode: false,
      },
      server: {},
    });
  });

  it("rejects malformed public Convex URLs", () => {
    expect(() =>
      parseEnvironment({ NEXT_PUBLIC_CONVEX_URL: "not-a-url" }),
    ).toThrow("NEXT_PUBLIC_CONVEX_URL");
  });
});
