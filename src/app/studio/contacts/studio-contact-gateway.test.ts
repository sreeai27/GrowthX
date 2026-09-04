import { describe, expect, it } from "vitest";
import { createFixtureStudioContactGateway } from "./studio-contact-gateway";

describe("Studio contact gateway", () => {
  it("keeps contact values masked for an ordinary operator", async () => {
    const gateway = createFixtureStudioContactGateway();
    const contacts = await gateway.listContacts({
      actorId: "operator-neha",
      role: "OPERATOR",
      tenantId: "demo_sahaay_home_services",
    });

    expect(contacts[0]?.maskedDisplay).toBe("a***a@example.com");
    expect(JSON.stringify(contacts)).not.toContain("asha@example.com");
  });

  it("requires an administrator and a permitted reason to reveal", async () => {
    const gateway = createFixtureStudioContactGateway();

    await expect(
      gateway.revealContact({
        actorId: "operator-neha",
        role: "OPERATOR",
        tenantId: "demo_sahaay_home_services",
        contactId: "contact-asha",
        reason: "RESULT_DELIVERY",
      }),
    ).rejects.toThrow("ADMIN_REQUIRED");
    await expect(
      gateway.revealContact({
        actorId: "admin-meera",
        role: "PLATFORM_ADMIN",
        tenantId: "demo_sahaay_home_services",
        contactId: "contact-asha",
        reason: "",
      }),
    ).rejects.toThrow("REASON_REQUIRED");
  });

  it("rejects a second review by the original administrator", async () => {
    const gateway = createFixtureStudioContactGateway();
    await expect(
      gateway.reviewDeletion({
        actorId: "admin-meera",
        role: "PLATFORM_ADMIN",
        tenantId: "demo_sahaay_home_services",
        requestId: "deletion-uncertain",
        decision: "APPROVE",
        reason: "Evidence matches the request.",
      }),
    ).rejects.toThrow("DISTINCT_REVIEWER_REQUIRED");
  });
});
