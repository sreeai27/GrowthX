import { ConvexError, v } from "convex/values";

import { mutation } from "./_generated/server";
import { DEMO_TENANT_ID, demoBooking } from "./fixtures";
import {
  canAccessDemoRun,
  demoResumeExpiresAt,
} from "../src/domain/demo-session-policy";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RUN_ID_PATTERN = /^run_[A-Za-z0-9_-]{8,}$/;

function assertSessionInput(publicRunId: string, browserTokenHash: string) {
  if (
    !RUN_ID_PATTERN.test(publicRunId) ||
    !HASH_PATTERN.test(browserTokenHash)
  ) {
    throw new ConvexError("Invalid demo session input.");
  }
}

// The checked-in pre-deployment Convex shim cannot expose a generated DataModel yet.
// Keep this one boundary untyped; all returned fields are validated by the server gateway.
/* eslint-disable @typescript-eslint/no-explicit-any */
async function demoView(
  context: any,
  run: { publicRunId: string; bookingKey: string; resumeExpiresAt: string },
) {
  const booking = await context.db
    .query("bookings")
    .withIndex("by_tenant_booking_key", (query: any) =>
      query.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((query: any) => query.eq(query.field("bookingKey"), run.bookingKey))
    .unique();
  if (!booking) throw new ConvexError("Demo booking is unavailable.");
  const worker = await context.db
    .query("users")
    .withIndex("by_tenant_public_user", (query: any) =>
      query.eq("tenantId", DEMO_TENANT_ID),
    )
    .filter((query: any) =>
      query.eq(query.field("publicUserId"), booking.workerPublicUserId),
    )
    .unique();
  const tasks = await context.db
    .query("taskCatalog")
    .withIndex("by_tenant_task", (query: any) =>
      query.eq("tenantId", DEMO_TENANT_ID),
    )
    .collect();
  if (!worker) throw new ConvexError("Demo worker is unavailable.");
  return {
    ...run,
    booking: {
      serviceName: booking.serviceName,
      workerName: worker.displayName,
      status: booking.status,
      scheduledDurationMinutes: booking.scheduledDurationMinutes,
      includedTasks: booking.includedTaskIds.map(
        (taskId: string) =>
          tasks.find((task: { taskId: string }) => task.taskId === taskId)
            ?.displayName ?? taskId,
      ),
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const startDemo = mutation({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
  },
  handler: async (context, args) => {
    assertSessionInput(args.publicRunId, args.browserTokenHash);
    const now = new Date();
    const nowIso = now.toISOString();
    const resumeExpiresAt = demoResumeExpiresAt(now);
    const booking = await context.db
      .query("bookings")
      .withIndex("by_tenant_booking_key", (query) =>
        query.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((query) =>
        query.eq(query.field("bookingKey"), demoBooking.bookingKey),
      )
      .unique();
    if (!booking) throw new ConvexError("Demo data is not seeded.");
    const duplicate = await context.db
      .query("demoRuns")
      .withIndex("by_tenant_public_run", (query) =>
        query.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((query) => query.eq(query.field("publicRunId"), args.publicRunId))
      .unique();
    if (duplicate) throw new ConvexError("Demo run ID is unavailable.");

    await context.db.insert("demoRuns", {
      tenantId: DEMO_TENANT_ID,
      publicRunId: args.publicRunId,
      browserTokenHash: args.browserTokenHash,
      status: "ACTIVE",
      bookingKey: booking.bookingKey,
      startedAt: nowIso,
      lastActiveAt: nowIso,
      resumeExpiresAt,
    });
    return demoView(context, {
      publicRunId: args.publicRunId,
      bookingKey: booking.bookingKey,
      resumeExpiresAt,
    });
  },
});

export const resumeDemo = mutation({
  args: {
    publicRunId: v.string(),
    browserTokenHash: v.string(),
  },
  handler: async (context, args) => {
    const now = new Date();
    if (
      !RUN_ID_PATTERN.test(args.publicRunId) ||
      !HASH_PATTERN.test(args.browserTokenHash)
    ) {
      return null;
    }
    const run = await context.db
      .query("demoRuns")
      .withIndex("by_tenant_public_run", (query) =>
        query.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((query) => query.eq(query.field("publicRunId"), args.publicRunId))
      .unique();
    if (!canAccessDemoRun(run, args.browserTokenHash, now)) {
      return null;
    }
    await context.db.patch(run._id, { lastActiveAt: now.toISOString() });
    return demoView(context, {
      publicRunId: run.publicRunId,
      bookingKey: run.bookingKey,
      resumeExpiresAt: run.resumeExpiresAt,
    });
  },
});

export const restartDemo = mutation({
  args: {
    currentPublicRunId: v.string(),
    currentTokenHash: v.string(),
    replacementPublicRunId: v.string(),
    replacementTokenHash: v.string(),
  },
  handler: async (context, args) => {
    assertSessionInput(args.replacementPublicRunId, args.replacementTokenHash);
    const now = new Date();
    const nowIso = now.toISOString();
    const resumeExpiresAt = demoResumeExpiresAt(now);
    if (
      !RUN_ID_PATTERN.test(args.currentPublicRunId) ||
      !HASH_PATTERN.test(args.currentTokenHash)
    ) {
      return null;
    }
    const current = await context.db
      .query("demoRuns")
      .withIndex("by_tenant_public_run", (query) =>
        query.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((query) =>
        query.eq(query.field("publicRunId"), args.currentPublicRunId),
      )
      .unique();
    if (!canAccessDemoRun(current, args.currentTokenHash, now)) {
      return null;
    }
    const replacementExists = await context.db
      .query("demoRuns")
      .withIndex("by_tenant_public_run", (query) =>
        query.eq("tenantId", DEMO_TENANT_ID),
      )
      .filter((query) =>
        query.eq(query.field("publicRunId"), args.replacementPublicRunId),
      )
      .unique();
    if (replacementExists) throw new ConvexError("Demo run ID is unavailable.");

    await context.db.patch(current._id, {
      status: "ABANDONED",
      abandonedAt: nowIso,
    });
    await context.db.insert("demoRuns", {
      tenantId: DEMO_TENANT_ID,
      publicRunId: args.replacementPublicRunId,
      browserTokenHash: args.replacementTokenHash,
      status: "ACTIVE",
      bookingKey: current.bookingKey,
      startedAt: nowIso,
      lastActiveAt: nowIso,
      resumeExpiresAt,
    });
    return demoView(context, {
      publicRunId: args.replacementPublicRunId,
      bookingKey: current.bookingKey,
      resumeExpiresAt,
    });
  },
});
