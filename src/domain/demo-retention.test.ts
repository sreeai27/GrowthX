import { describe, expect, it } from "vitest";
import { planDemoDeletion } from "./demo-retention";

describe("public demo retention", () => {
  it("refuses deletion until approval confirmation is recorded", () => {
    expect(() => planDemoDeletion({ approvedAt: null, confirmedAt: null })).toThrow(/confirmation/i);
  });

  it("deletes identifying children before the run and retains a non-identifying receipt", () => {
    const plan = planDemoDeletion({ approvedAt: "2026-09-01T00:00:00.000Z", confirmedAt: "2026-09-01T00:01:00.000Z" });
    expect(plan.tables.at(-1)).toBe("demoRuns");
    expect(plan.tables.indexOf("demoContacts")).toBeLessThan(plan.tables.indexOf("demoRuns"));
    expect(plan.receiptFields).toEqual(["tenantId", "reasonCode", "deletedAt", "anonymousRunCount"]);
  });
});
