import { describe, expect, it, vi } from "vitest";

const { getDeliveryProvider } = vi.hoisted(() => ({
  getDeliveryProvider: vi.fn(() => {
    throw new Error("Production delivery provider is unavailable.");
  }),
}));

vi.mock("../../config/env", () => ({
  env: {
    features: { fixtureMode: false },
    public: { convexUrl: "https://example.convex.cloud" },
    server: {},
  },
}));

vi.mock("./private-result-delivery", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("./private-result-delivery")
  >();
  return {
    ...actual,
    getPrivateResultDeliveryProvider: getDeliveryProvider,
  };
});

import { getPrivateDemoResultGateway } from "./private-demo-result";

describe("production private-result gateway", () => {
  it("opens read-only checkpoints without starting the delivery provider", () => {
    expect(() => getPrivateDemoResultGateway()).not.toThrow();
    expect(getDeliveryProvider).not.toHaveBeenCalled();
  });
});
