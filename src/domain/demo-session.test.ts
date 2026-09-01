import { describe, expect, it } from "vitest";

import { hashDemoToken } from "./demo-session";
import {
  canAccessDemoRun,
  demoResumeExpiresAt,
  type DemoRun,
} from "./demo-session-policy";

const activeRun: DemoRun = {
  tenantId: "demo_sahaay_home_services",
  publicRunId: "run_public_123",
  browserTokenHash: hashDemoToken("private-token"),
  status: "ACTIVE",
  startedAt: "2026-09-01T10:00:00.000Z",
  lastActiveAt: "2026-09-01T10:00:00.000Z",
  resumeExpiresAt: "2026-09-02T10:00:00.000Z",
};

describe("demo session policy", () => {
  it("creates an exact 24-hour resume window", () => {
    expect(demoResumeExpiresAt(new Date("2026-09-01T10:00:00.000Z"))).toBe(
      "2026-09-02T10:00:00.000Z",
    );
  });

  it("hashes the private token before persistence", () => {
    expect(hashDemoToken("private-token")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDemoToken("private-token")).not.toContain("private-token");
  });

  it("allows only the active, matching, unexpired run", () => {
    expect(
      canAccessDemoRun(
        activeRun,
        hashDemoToken("private-token"),
        new Date("2026-09-02T09:59:59.000Z"),
      ),
    ).toBe(true);
    expect(
      canAccessDemoRun(
        activeRun,
        hashDemoToken("wrong-token"),
        new Date("2026-09-01T11:00:00.000Z"),
      ),
    ).toBe(false);
    expect(
      canAccessDemoRun(
        { ...activeRun, status: "ABANDONED" },
        activeRun.browserTokenHash,
        new Date("2026-09-01T11:00:00.000Z"),
      ),
    ).toBe(false);
    expect(
      canAccessDemoRun(
        activeRun,
        activeRun.browserTokenHash,
        new Date("2026-09-02T10:00:00.000Z"),
      ),
    ).toBe(false);
  });
});
