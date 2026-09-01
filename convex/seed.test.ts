import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const seedDemo = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { inserted: boolean }
>("seed:seedDemo");

describe("seedDemo", () => {
  it("idempotently creates the canonical Sahaay tenant, worker, booking, catalogue and policy", async () => {
    const database = convexTest(schema, modules);

    expect(await database.mutation(seedDemo, {})).toEqual({ inserted: true });
    expect(await database.mutation(seedDemo, {})).toEqual({ inserted: false });

    const seeded = await database.run(async (context) => ({
      tenants: await context.db.query("tenants").collect(),
      users: await context.db.query("users").collect(),
      bookings: await context.db.query("bookings").collect(),
      tasks: await context.db.query("taskCatalog").collect(),
      sources: await context.db.query("policySources").collect(),
      passages: await context.db.query("policyPassages").collect(),
      rules: await context.db.query("policyRules").collect(),
    }));

    expect(seeded.tenants).toHaveLength(1);
    expect(seeded.users).toEqual([
      expect.objectContaining({ displayName: "Asha", locale: "hi-IN" }),
    ]);
    expect(seeded.bookings).toEqual([
      expect.objectContaining({
        tenantId: "demo_sahaay_home_services",
        bookingKey: "DEMO-4821",
        status: "IN_PROGRESS",
      }),
    ]);
    expect(seeded.tasks).toHaveLength(7);
    expect(seeded.sources).toEqual([
      expect.objectContaining({
        sourceKey: "taskconfirm-demo-policy",
        version: "v1",
        effectiveFrom: "2026-08-31T00:00:00.000Z",
        notice: "Fictional demonstration policy; not a real operator policy.",
      }),
    ]);
    expect(seeded.passages).toHaveLength(5);
    expect(seeded.passages.map(({ passageKey }) => passageKey)).toEqual([
      "included-standard-bathroom",
      "balcony-deep-clean-add-on",
      "cabinet-clean-tradeoff",
      "wardrobe-not-supported",
      "exposed-wire-escalation",
    ]);
    expect(seeded.rules).toHaveLength(5);
    expect(seeded.rules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleKey: "balcony-deep-clean-add-on",
          ruleVersion: "v1",
          sourceVersion: "v1",
          passageKey: "balcony-deep-clean-add-on",
          effectiveFrom: "2026-08-31T00:00:00.000Z",
          effectiveTo: null,
          priority: 100,
          priceDeltaMinor: 29_900,
          durationDeltaMinutes: 25,
        }),
      ]),
    );
  });

  it("repairs a partial seed when the tenant already exists", async () => {
    const database = convexTest(schema, modules);
    await database.run((context) =>
      context.db.insert("tenants", {
        tenantId: "demo_sahaay_home_services",
        name: "Incomplete",
        city: "Pune",
        defaultWorkerLanguage: "hi-IN",
        supportedCustomerLanguages: ["en-IN"],
        policyPackVersion: "old",
      }),
    );

    expect(await database.mutation(seedDemo, {})).toEqual({ inserted: true });
    const counts = await database.run(async (context) => ({
      tenants: (await context.db.query("tenants").collect()).length,
      users: (await context.db.query("users").collect()).length,
      bookings: (await context.db.query("bookings").collect()).length,
      tasks: (await context.db.query("taskCatalog").collect()).length,
      rules: (await context.db.query("policyRules").collect()).length,
    }));
    expect(counts).toEqual({
      tenants: 1,
      users: 1,
      bookings: 1,
      tasks: 7,
      rules: 5,
    });
  });
});
