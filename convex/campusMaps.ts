import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { campusMapPointValidator } from "./schema";
import { userHasAccessToCampusById, validateUserAccess } from "./helpers";
import {
  campusAddressKey,
  geocodeCampusAddress,
  type CampusMapPoint,
} from "../lib/campus-map";

const pendingCampus = (ctx: MutationCtx) =>
  ctx.db
    .query("campusSettings")
    .withIndex("by_mapLocation_status", (q) =>
      q.eq("mapLocation.status", "pending"),
    )
    .first();

async function scheduleNext(ctx: MutationCtx) {
  const next = await pendingCampus(ctx);
  if (next)
    await ctx.scheduler.runAfter(1000, internal.campusMaps.resolve, {
      campusId: next._id,
      requestedAt: next.mapLocation!.requestedAt,
    });
}

export async function queueCampusMap(
  ctx: MutationCtx,
  campus: Doc<"campusSettings">,
) {
  const key = campusAddressKey(campus.address);
  const old = campus.mapLocation;
  if (
    old?.addressKey === key &&
    (old.status === "ready" ||
      old.status === "missing" ||
      Date.now() - old.requestedAt <
        (old.status === "pending" ? 600_000 : 60_000))
  )
    return;
  const pending = await pendingCampus(ctx);
  await ctx.db.patch(campus._id, {
    mapLocation: {
      addressKey: key,
      requestedAt: Math.max(Date.now(), (old?.requestedAt ?? 0) + 1),
      status: "pending",
    },
  });
  // ponytail: one serialized worker is enough for campus edits, not live tracking.
  if (
    !pending ||
    (pending._id === campus._id &&
      old?.status === "pending" &&
      Date.now() - old.requestedAt >= 600_000)
  )
    await scheduleNext(ctx);
}

/** Lazy backfill for existing campuses, deduplicated across buses and viewers. */
export const ensureForBus = mutation({
  args: { busId: v.id("buses") },
  returns: v.null(),
  handler: async (ctx, { busId }) => {
    const { user, role } = await validateUserAccess(ctx, [
      "superadmin",
      "principal",
      "admin",
    ]);
    const bus = await ctx.db.get(busId);
    if (
      !bus ||
      !bus.campusIds.some((id) => userHasAccessToCampusById(user, id, role))
    )
      throw new Error("Bus unavailable");
    // Recover an interrupted worker on the next authorized visit, without a cron.
    const stalled = await pendingCampus(ctx);
    if (
      stalled?.mapLocation &&
      Date.now() - stalled.mapLocation.requestedAt >= 600_000
    ) {
      await ctx.db.patch(stalled._id, {
        mapLocation: { ...stalled.mapLocation, requestedAt: Date.now() },
      });
      await scheduleNext(ctx);
    }
    for (const id of bus.campusIds) {
      if (!userHasAccessToCampusById(user, id, role)) continue;
      const campus = await ctx.db.get(id);
      if (campus?.isActive) await queueCampusMap(ctx, campus);
    }
    return null;
  },
});

export const read = internalQuery({
  args: { campusId: v.id("campusSettings") },
  handler: (ctx, { campusId }) => ctx.db.get(campusId),
});

export const finish = internalMutation({
  args: {
    campusId: v.id("campusSettings"),
    requestedAt: v.number(),
    point: v.union(campusMapPointValidator, v.null()),
    failed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, { campusId, requestedAt, point, failed }) => {
    const campus = await ctx.db.get(campusId);
    const location = campus?.mapLocation;
    if (campus && location?.status !== "pending") return null;
    if (
      location?.status === "pending" &&
      location.requestedAt === requestedAt
    ) {
      await ctx.db.patch(campusId, {
        mapLocation: {
          ...location,
          status: failed ? "error" : point ? "ready" : "missing",
          point: point ?? undefined,
        },
      });
    }
    await scheduleNext(ctx);
    return null;
  },
});

export const resolve = internalAction({
  args: { campusId: v.id("campusSettings"), requestedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const campus: Doc<"campusSettings"> | null = await ctx.runQuery(
      internal.campusMaps.read,
      { campusId: args.campusId },
    );
    let point: CampusMapPoint | null = null;
    let failed = false;
    if (
      campus?.mapLocation?.status === "pending" &&
      campus.mapLocation.requestedAt === args.requestedAt
    ) {
      try {
        point = await geocodeCampusAddress(
          campus.address ?? {},
          process.env.PHOTON_GEOCODING_URL,
        );
      } catch {
        // A provider outage must not block campus saves or the bus roster.
        failed = true;
      }
    }
    await ctx.runMutation(internal.campusMaps.finish, {
      ...args,
      point,
      failed,
    });
    return null;
  },
});
