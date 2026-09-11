import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  mutation,
  query,
  internalQuery,
  type MutationCtx,
  type DatabaseReader,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { validateUserAccess, userHasAccessToCampusById, assignedVehicleStudents } from "./helpers";
import {
  normalizeVehicleIdentifier,
  type VehicleIdentifier,
} from "../lib/vehicle";
import type { DismissalRole } from "../lib/role-utils";

const managementRoles: DismissalRole[] = ["superadmin", "principal", "admin"];

export async function getBusByIdentifier(
  db: DatabaseReader,
  identifier: VehicleIdentifier,
) {
  return await db
    .query("buses")
    .withIndex("by_identifier", (q) =>
      q.eq("identifier", normalizeVehicleIdentifier(identifier)),
    )
    .unique();
}

export async function requireBus(
  db: DatabaseReader,
  identifier: VehicleIdentifier,
) {
  const bus = await getBusByIdentifier(db, identifier);
  if (!bus || !bus.campusIds.length)
    throw new Error("Select an existing bus with assigned campuses");
  return bus;
}

export async function validateStudentVehicle(
  db: DatabaseReader,
  identifier: VehicleIdentifier,
  campuses: Id<"campusSettings">[],
  type?: "car" | "bus",
) {
  const bus = identifier ? await getBusByIdentifier(db, identifier) : null;
  if (type === "bus" && !bus) throw new Error("Select an existing bus");
  if (type === "car" && (bus || (identifier && await isBus(db, identifier))))
    throw new Error("This identifier belongs to a bus. Select Bus instead.");
  if (
    bus &&
    (!campuses.length || campuses.some((id) => !bus.campusIds.includes(id)))
  )
    throw new Error("The bus is not available for the student's campuses");
}

// Compatibility while existing bus-only assignments are migrated out of carNumber.
export async function studentTransport(db: DatabaseReader, student: Pick<Doc<"students">, "carNumber" | "busNumber">, legacyBusNumbers?: ReadonlySet<VehicleIdentifier>) {
  if (student.busNumber !== undefined) return { carNumber: student.carNumber, busNumber: student.busNumber };
  return student.carNumber && (legacyBusNumbers ? legacyBusNumbers.has(student.carNumber) : await isBus(db, student.carNumber))
    ? { carNumber: 0, busNumber: student.carNumber }
    : { carNumber: student.carNumber, busNumber: 0 };
}

export async function validateStudentTransport(db: DatabaseReader, carNumber: VehicleIdentifier, busNumber: VehicleIdentifier, campuses: Id<"campusSettings">[]) {
  await validateStudentVehicle(db, carNumber, campuses, "car");
  if (busNumber) await validateStudentVehicle(db, busNumber, campuses, "bus");
}

export const options = query({
  args: { forDriver: v.boolean() },
  handler: async (ctx, args) => {
    const { user, role } = await validateUserAccess(ctx, managementRoles);
    const buses = await ctx.db.query("buses").take(201);
    if (buses.length > 200)
      throw new Error("Bus selector capacity exceeded; use paginated search");
    return buses
      .filter(
        (bus) =>
          bus.campusIds.length &&
          (args.forDriver
            ? canEdit(bus, user, role)
            : canRead(bus, user, role)),
      )
      .map((bus) => ({
        identifier: bus.identifier,
        name: bus.name,
        campusIds: bus.campusIds,
      }));
  },
});

export const driverAssignment = internalQuery({
  args: { identifier: v.union(v.number(), v.string()) },
  handler: async (ctx, args) => {
    const { user, role } = await validateUserAccess(ctx, managementRoles);
    const bus = await requireBus(ctx.db, args.identifier);
    if (!canEdit(bus, user, role))
      throw new Error("No permission for all campuses of this bus");
    return bus;
  },
});

async function activeDrivers(
  db: DatabaseReader,
  identifier: VehicleIdentifier,
) {
  const drivers = await db
    .query("users")
    .withIndex("by_busNumber", (q) => q.eq("busNumber", identifier))
    .take(101);
  if (drivers.length > 100)
    throw new Error("Too many driver assignments for this vehicle");
  return drivers.filter(
    (d) => d.role === "bus_driver" && d.isActive && d.status !== "inactive",
  );
}

export async function isBus(db: DatabaseReader, identifier: VehicleIdentifier) {
  const registered = identifier
    ? await getBusByIdentifier(db, identifier)
    : null;
  // Compatibility during rollout, before existing drivers have been migrated.
  return !!registered || (await activeDrivers(db, identifier)).length > 0;
}

function canRead(bus: Doc<"buses">, user: Doc<"users">, role: DismissalRole) {
  return (
    role === "superadmin" ||
    bus.campusIds.some((id) => userHasAccessToCampusById(user, id, role))
  );
}

function canEdit(bus: Doc<"buses">, user: Doc<"users">, role: DismissalRole) {
  return (
    canRead(bus, user, role) &&
    bus.campusIds.every((id) => userHasAccessToCampusById(user, id, role))
  );
}

// Preserve existing driver assignments without moving transport data into Clerk.
// Migration only: new driver assignments must select a registered bus.
export async function ensureDriverBus(ctx: MutationCtx, driver: Doc<"users">) {
  if (
    driver.role !== "bus_driver" ||
    !driver.isActive ||
    driver.status === "inactive" ||
    !driver.busNumber
  )
    return;
  const identifier = normalizeVehicleIdentifier(driver.busNumber);
  const existing = await getBusByIdentifier(ctx.db, identifier);
  const drivers = await activeDrivers(ctx.db, identifier);
  const students = await assignedVehicleStudents(ctx.db, identifier);
  const campusIds = [
    ...new Set([
      ...(existing?.campusIds ?? []),
      ...drivers.flatMap((d) => d.assignedCampuses),
      ...students.filter((s) => s.isActive).flatMap((s) => s.campuses),
    ]),
  ];
  for (const assignedDriver of drivers) {
    if (
      assignedDriver.assignedCampuses.length !== campusIds.length ||
      campusIds.some((id) => !assignedDriver.assignedCampuses.includes(id))
    )
      await ctx.db.patch(assignedDriver._id, {
        assignedCampuses: campusIds,
        updatedAt: Date.now(),
      });
  }
  if (existing) {
    if (campusIds.length !== existing.campusIds.length)
      await ctx.db.patch(existing._id, {
        campusIds,
        updatedAt: Math.max(Date.now(), existing.updatedAt + 1),
      });
    return existing._id;
  }
  return await ctx.db.insert("buses", {
    identifier,
    name: String(identifier),
    campusIds,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { user, role } = await validateUserAccess(ctx, managementRoles);
    const result = await ctx.db
      .query("buses")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.filter((bus) => canRead(bus, user, role)),
    };
  },
});

export const get = query({
  args: { busId: v.id("buses") },
  handler: async (ctx, { busId }) => {
    const { user, role } = await validateUserAccess(ctx, managementRoles);
    const bus = await ctx.db.get(busId);
    if (!bus || !canRead(bus, user, role)) return null;
    const campuses = await Promise.all(
      bus.campusIds
        .filter((id) => userHasAccessToCampusById(user, id, role))
        .map((id) => ctx.db.get(id)),
    );
    const drivers = await activeDrivers(ctx.db, bus.identifier);
    return {
      ...bus,
      canEdit: canEdit(bus, user, role),
      campuses: campuses.flatMap((c) =>
        c?.isActive
          ? [{ id: c._id, name: c.campusName, timezone: c.timezone }]
          : [],
      ),
      drivers: drivers
        .filter(
          (d) =>
            role === "superadmin" ||
            d.assignedCampuses.some((id) =>
              userHasAccessToCampusById(user, id, role),
            ),
        )
        .map((d) => ({
          id: d._id,
          name: d.fullName || d.username || "",
          username: d.username,
          phone: d.phone,
        })),
    };
  },
});

export const save = mutation({
  args: {
    busId: v.optional(v.id("buses")),
    identifier: v.union(v.number(), v.string()),
    name: v.string(),
    campusIds: v.array(v.id("campusSettings")),
    expectedUpdatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user, role } = await validateUserAccess(ctx, managementRoles);
    const identifier = normalizeVehicleIdentifier(args.identifier);
    const name = args.name.trim();
    if (!name || name.length > 100)
      throw new Error("Enter a bus name (maximum 100 characters)");
    const campusIds = [...new Set(args.campusIds)];
    if (!campusIds.length || campusIds.length > 100)
      throw new Error("Select between 1 and 100 campuses");
    const bus = args.busId ? await ctx.db.get(args.busId) : null;
    if (args.busId && (!bus || !canEdit(bus, user, role)))
      throw new Error("Not authorized to edit this bus");
    for (const id of campusIds) {
      const campus = await ctx.db.get(id);
      if (
        !campus ||
        (!campus.isActive && !bus?.campusIds.includes(id)) ||
        !userHasAccessToCampusById(user, id, role)
      )
        throw new Error("Campus unavailable or not authorized");
    }
    // Bus coverage must remain valid for existing assignments, including when
    // registering an identifier previously used as a regular vehicle.
    const students = await assignedVehicleStudents(ctx.db, identifier);
    if (!bus && students.some(s => s.isActive && s.busNumber !== undefined && s.carNumber === identifier))
      throw new Error("This identifier is assigned to a car. Choose a different bus identifier");
    if (
      students.some(
        (student) =>
          student.isActive &&
          student.campuses.some((id) => !campusIds.includes(id)),
      )
    )
      throw new Error(
        "Reassign students before removing their campus from this bus",
      );
    if (bus) {
      if (bus.updatedAt !== args.expectedUpdatedAt)
        throw new Error("The bus changed. Reopen the editor and try again.");
      // The identifier links students, drivers and Road. Renaming that key needs an explicit reassignment workflow.
      if (identifier !== bus.identifier)
        throw new Error("The vehicle identifier cannot be changed here");
      const drivers = await ctx.db
        .query("users")
        .withIndex("by_busNumber", (q) => q.eq("busNumber", identifier))
        .take(101);
      if (drivers.length > 100)
        throw new Error("Too many driver assignments for this vehicle");
      for (const driver of drivers) {
        if (driver.role === "bus_driver")
          await ctx.db.patch(driver._id, {
            assignedCampuses: campusIds,
            updatedAt: Date.now(),
          });
      }
      await ctx.db.patch(bus._id, {
        name,
        campusIds,
        updatedAt: Math.max(Date.now(), bus.updatedAt + 1),
      });
      return bus._id;
    }
    const existing = await ctx.db
      .query("buses")
      .withIndex("by_identifier", (q) => q.eq("identifier", identifier))
      .unique();
    if (existing)
      throw new Error("A bus with this number or license plate already exists");
    return await ctx.db.insert("buses", {
      identifier,
      name,
      campusIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
