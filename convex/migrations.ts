import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const migrations = new Migrations<DataModel>(components.migrations, {
  migrationsLocationPrefix: "migrations:",
});

export const run = migrations.runner();

/**
 * Migration: Convert assignedCampuses from campus names (strings) to campus IDs
 * Uses case-insensitive matching to handle variations like "Downtown Middle" vs "Downtown middle"
 *
 * Before: assignedCampuses: ["Campus A", "Downtown middle"]
 * After: assignedCampuses: [Id<"campusSettings">, Id<"campusSettings">]
 */
export const migrateAssignedCampusesToIds = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    const assignedCampuses = user.assignedCampuses;

    // Skip if no campuses assigned
    if (!assignedCampuses || assignedCampuses.length === 0) {
      return;
    }

    // Check if already migrated (first element looks like an ID)
    const firstCampus = assignedCampuses[0];
    if (firstCampus && firstCampus.length > 20 && !firstCampus.includes(" ")) {
      console.log(`User ${user._id} already migrated, skipping`);
      return;
    }

    // Get all campuses for case-insensitive matching
    const allCampuses = await ctx.db.query("campusSettings").collect();

    // Convert each campus name to its ID using case-insensitive matching
    const campusIds: Id<"campusSettings">[] = [];
    const notFoundCampuses: string[] = [];

    for (const campusName of assignedCampuses) {
      // Case-insensitive search
      const campus = allCampuses.find(
        (c) => c.campusName.toLowerCase() === campusName.toLowerCase()
      );

      if (campus) {
        campusIds.push(campus._id);
      } else {
        notFoundCampuses.push(campusName);
        console.warn(
          `Campus "${campusName}" not found for user ${user._id} (${user.email || user.username})`,
        );
      }
    }

    // Only update if we found at least one campus
    if (campusIds.length > 0) {
      console.log(
        `Migrating user ${user._id}: ${assignedCampuses.join(", ")} -> ${campusIds.join(", ")}`,
      );

      await ctx.db.patch(user._id, {
        assignedCampuses: campusIds,
      });

      if (notFoundCampuses.length > 0) {
        console.warn(
          `User ${user._id} had campuses not found: ${notFoundCampuses.join(", ")}`,
        );
      }
    } else {
      console.error(
        `No valid campuses found for user ${user._id}. Original: ${assignedCampuses.join(", ")}`,
      );
    }
  },
});

/**
 * Helper query to preview what the migration will do (dry run check)
 */
export const previewMigration = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      userId: v.id("users"),
      email: v.optional(v.string()),
      currentCampuses: v.array(v.string()),
      willMigrateTo: v.array(v.string()),
      notFound: v.array(v.string()),
      alreadyMigrated: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const allCampuses = await ctx.db.query("campusSettings").collect();
    const results = [];

    for (const user of users) {
      const assignedCampuses = user.assignedCampuses || [];

      // Check if already migrated
      const firstCampus = assignedCampuses[0];
      const alreadyMigrated = Boolean(
        firstCampus &&
          firstCampus.length > 20 &&
          !firstCampus.includes(" "),
      );

      if (alreadyMigrated) {
        results.push({
          userId: user._id,
          email: user.email,
          currentCampuses: assignedCampuses,
          willMigrateTo: [],
          notFound: [],
          alreadyMigrated: true,
        });
        continue;
      }

      const willMigrateTo: string[] = [];
      const notFound: string[] = [];

      for (const campusName of assignedCampuses) {
        // Case-insensitive search
        const campus = allCampuses.find(
          (c) => c.campusName.toLowerCase() === campusName.toLowerCase()
        );

        if (campus) {
          willMigrateTo.push(campus._id);
        } else {
          notFound.push(campusName);
        }
      }

      results.push({
        userId: user._id,
        email: user.email,
        currentCampuses: assignedCampuses,
        willMigrateTo,
        notFound,
        alreadyMigrated: false,
      });
    }

    return results;
  },
});

/**
 * List all campuses for reference
 */
export const listCampuses = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("campusSettings"),
      name: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const campuses = await ctx.db.query("campusSettings").collect();
    return campuses.map((c) => ({
      id: c._id,
      name: c.campusName,
    }));
  },
});

/**
 * Runner for the migration
 */
export const runMigrateAssignedCampuses = migrations.runner(
  internal.migrations.migrateAssignedCampusesToIds,
);
