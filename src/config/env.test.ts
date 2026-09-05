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
      models: { interpreter: "gpt-5.6-terra" },
    });
  });

  it("rejects malformed public Convex URLs", () => {
    expect(() =>
      parseEnvironment({ NEXT_PUBLIC_CONVEX_URL: "not-a-url" }),
    ).toThrow("NEXT_PUBLIC_CONVEX_URL");
  });

  it("rejects production without the required data and encryption configuration", () => {
    expect(() => parseEnvironment({ NODE_ENV: "production" })).toThrow(/NEXT_PUBLIC_CONVEX_URL/);
  });

  it("rejects fixture mode in production", () => {
    expect(() => parseEnvironment({
      NODE_ENV: "production", NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
      DEMO_SESSION_COOKIE_SECRET: "a".repeat(32), DEMO_CONTACT_ENCRYPTION_KEY: "b".repeat(32),
      FEATURE_FIXTURE_MODE: "true",
    })).toThrow(/FEATURE_FIXTURE_MODE/);
  });

  it("rejects server secrets exposed with a public prefix", () => {
    expect(() => parseEnvironment({ NEXT_PUBLIC_OPENAI_API_KEY: "exposed-secret" })).toThrow(/server-only/);
  });

  it("accepts a complete fail-closed production configuration", () => {
    expect(parseEnvironment({
      NODE_ENV: "production", NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
      DEMO_SESSION_COOKIE_SECRET: "a".repeat(32), DEMO_CONTACT_ENCRYPTION_KEY: "b".repeat(32),
      FEATURE_FIXTURE_MODE: "false", FEATURE_VOICE_CAPTURE: "false", FEATURE_OPENAI_MAPPING: "false",
    }).features.fixtureMode).toBe(false);
  });
});
