import { mutation } from "./_generated/server";
import {
  demoBooking,
  demoPolicyRules,
  demoPolicySource,
  demoTasks,
  demoTenant,
  demoWorker,
} from "./fixtures";

export const seedDemo = mutation({
  args: {},
  handler: async (context) => {
    let inserted = false;
    const tenant = await context.db
      .query("tenants")
      .withIndex("by_tenant_id", (query) =>
        query.eq("tenantId", demoTenant.tenantId),
      )
      .unique();
    if (tenant) await context.db.patch(tenant._id, demoTenant);
    else {
      await context.db.insert("tenants", demoTenant);
      inserted = true;
    }

    const worker = await context.db
      .query("users")
      .withIndex("by_tenant_public_user", (query) =>
        query.eq("tenantId", demoWorker.tenantId),
      )
      .filter((query) =>
        query.eq(query.field("publicUserId"), demoWorker.publicUserId),
      )
      .unique();
    if (worker) await context.db.patch(worker._id, demoWorker);
    else {
      await context.db.insert("users", demoWorker);
      inserted = true;
    }

    const booking = await context.db
      .query("bookings")
      .withIndex("by_tenant_booking_key", (query) =>
        query.eq("tenantId", demoBooking.tenantId),
      )
      .filter((query) =>
        query.eq(query.field("bookingKey"), demoBooking.bookingKey),
      )
      .unique();
    if (booking) await context.db.patch(booking._id, demoBooking);
    else {
      await context.db.insert("bookings", demoBooking);
      inserted = true;
    }

    for (const task of demoTasks) {
      const existing = await context.db
        .query("taskCatalog")
        .withIndex("by_tenant_task", (query) =>
          query.eq("tenantId", task.tenantId),
        )
        .filter((query) => query.eq(query.field("taskId"), task.taskId))
        .unique();
      if (existing) await context.db.patch(existing._id, task);
      else {
        await context.db.insert("taskCatalog", task);
        inserted = true;
      }
    }

    const source = await context.db
      .query("policySources")
      .withIndex("by_tenant_source_version", (query) =>
        query.eq("tenantId", demoPolicySource.tenantId),
      )
      .filter((query) =>
        query.and(
          query.eq(query.field("sourceKey"), demoPolicySource.sourceKey),
          query.eq(query.field("version"), demoPolicySource.version),
        ),
      )
      .unique();
    if (source) await context.db.patch(source._id, demoPolicySource);
    else {
      await context.db.insert("policySources", demoPolicySource);
      inserted = true;
    }

    for (const rule of demoPolicyRules) {
      const existing = await context.db
        .query("policyRules")
        .withIndex("by_tenant_rule", (query) =>
          query.eq("tenantId", rule.tenantId),
        )
        .filter((query) => query.eq(query.field("ruleKey"), rule.ruleKey))
        .unique();
      if (existing) await context.db.patch(existing._id, rule);
      else {
        await context.db.insert("policyRules", rule);
        inserted = true;
      }
    }
    return { inserted };
  },
});
