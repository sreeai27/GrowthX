import { describe, expect, it } from "vitest";

import {
  MockPrivateResultDeliveryProvider,
  deliveryReceiptSchema,
  deliveryRequestSchema,
} from "./private-result-delivery";

const request = {
  channel: "EMAIL" as const,
  destination: "visitor@example.com",
  resultUrl: "https://demo.example/result/secret",
  expiresAt: "2026-09-09T10:00:00.000Z",
};

describe("private result delivery provider", () => {
  it("validates email and SMS requests and returns a deterministic receipt", async () => {
    expect(deliveryRequestSchema.parse(request)).toEqual(request);
    expect(
      deliveryRequestSchema.parse({
        ...request,
        channel: "SMS",
        destination: "+919876543210",
      }),
    ).toMatchObject({ channel: "SMS" });

    const receipt = await new MockPrivateResultDeliveryProvider().send(request);
    expect(receipt).toMatchObject({ provider: "DEMONSTRATION_DELIVERY" });
    expect(receipt.providerMessageId).not.toContain(request.destination);
  });

  it("rejects malformed receipts and unknown provider fields", () => {
    expect(() =>
      deliveryReceiptSchema.parse({
        provider: "provider",
        providerMessageId: "message-1",
        acceptedAt: "not-a-date",
      }),
    ).toThrow();
    expect(() =>
      deliveryReceiptSchema.parse({
        provider: "provider",
        providerMessageId: "message-1",
        acceptedAt: "2026-09-02T10:00:00.000Z",
        apiKey: "secret",
      }),
    ).toThrow();
  });
});
