import { beforeEach, describe, expect, it, vi } from "vitest";

const { convexMutation, convexQuery, getDeliveryProvider } = vi.hoisted(() => ({
  convexMutation: vi.fn(async () => ({
    kind: "DISMISSED",
    stage: "DECISION",
  })),
  convexQuery: vi.fn(async (): Promise<unknown> => ({
    shouldShow: true,
    state: "AVAILABLE",
    maskedDisplay: null,
    deliveryStatus: null,
  })),
  getDeliveryProvider: vi.fn(() => {
    throw new Error("Production delivery provider is unavailable.");
  }),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    mutation = convexMutation;
    query = convexQuery;
  },
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
  beforeEach(() => {
    convexMutation.mockClear();
    convexQuery.mockClear();
    getDeliveryProvider.mockClear();
  });

  it("opens read-only checkpoints without starting the delivery provider", () => {
    expect(() => getPrivateDemoResultGateway()).not.toThrow();
    expect(getDeliveryProvider).not.toHaveBeenCalled();
  });

  it("waits for the Convex checkpoint before validating it", async () => {
    const gateway = getPrivateDemoResultGateway();

    await expect(
      gateway.getCheckpoint(
        {
          publicRunId: "run_production-test",
          browserTokenHash: "a".repeat(64),
        },
        "inc_production-test",
        "DECISION",
      ),
    ).resolves.toEqual({
      shouldShow: true,
      state: "AVAILABLE",
      maskedDisplay: null,
      deliveryStatus: null,
    });
  });

  it("waits for checkpoint dismissal and result-token reads", async () => {
    const gateway = getPrivateDemoResultGateway();
    convexQuery
      .mockResolvedValueOnce({
        shouldShow: false,
        state: "DISMISSED",
        maskedDisplay: null,
        deliveryStatus: null,
      })
      .mockResolvedValueOnce({ kind: "INVALID" });

    await expect(
      gateway.dismissCheckpoint(
        {
          publicRunId: "run_production-test",
          browserTokenHash: "a".repeat(64),
        },
        "inc_production-test",
        "DECISION",
      ),
    ).resolves.toMatchObject({ state: "DISMISSED" });
    await expect(gateway.getByResultToken("missing-token")).resolves.toEqual({
      kind: "INVALID",
    });
    expect(convexMutation).toHaveBeenCalledOnce();
  });
});
