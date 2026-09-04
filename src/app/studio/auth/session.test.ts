import { describe, expect, it } from "vitest";
import { issueStudioSession, readStudioSession } from "./session";

describe("Studio session cookie", () => {
  it("expires after eight hours and rejects a changed value", () => {
    const now = Date.parse("2026-09-04T12:00:00.000Z");
    const cookie = issueStudioSession({ actorId: "operator-neha", role: "OPERATOR", tenantId: "demo_sahaay_home_services" }, "secret-for-tests", now);
    expect(readStudioSession(cookie, "secret-for-tests", now + 28_799_000)?.actorId).toBe("operator-neha");
    expect(readStudioSession(cookie, "secret-for-tests", now + 28_801_000)).toBeNull();
    expect(readStudioSession(`${cookie}x`, "secret-for-tests", now)).toBeNull();
  });
});
