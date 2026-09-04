import { afterEach, describe, expect, it, vi } from "vitest";

import { demonstrationDeletionConfirmationProvider } from "./deletion-confirmation";

afterEach(() => vi.unstubAllEnvs());

describe("deletion confirmation provider", () => {
  it("returns a delivery receipt only for the non-production demonstration", async () => {
    vi.stubEnv("NODE_ENV", "test");
    await expect(demonstrationDeletionConfirmationProvider.send({
      deletionRequestId: "request-1", channel: "EMAIL", destination: "visitor@example.test",
      deliveredAt: "2026-09-04T12:00:00.000Z",
    })).resolves.toMatchObject({ status: "DELIVERED", provider: "DEMONSTRATION_NOTIFICATION_PROVIDER" });
  });

  it("cannot authorize a production deletion", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(demonstrationDeletionConfirmationProvider.send({
      deletionRequestId: "request-1", channel: "EMAIL", destination: "visitor@example.test",
      deliveredAt: "2026-09-04T12:00:00.000Z",
    })).rejects.toThrow("authorised production delivery provider");
  });
});
