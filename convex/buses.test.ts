/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { ensureDriverBus, studentTransport } from "./buses";
import { isBus } from "./studentDismissals";

const modules = import.meta.glob("./**/*.ts");

test("car and bus assignments coexist, validate campus coverage and can be removed independently", async () => {
  const { t, ids, principal } = await setup();
  const busId = await principal.mutation(api.buses.save, { identifier: 123, name: "Bus", campusIds: [ids.campuses[0]] });
  const args = { firstName: "Ana", lastName: "Test", birthday: "01/01/2015", grade: "4th" as const, campuses: [ids.campuses[0]], carNumber: 20, busNumber: 123 };
  const id = await principal.mutation(api.students.create, args);
  const read = async () => (await principal.query(api.students.get, { id }))!.student;
  expect(await read()).toMatchObject({ carNumber: 20, busNumber: 123 });
  expect((await principal.query(api.studentDismissals.searchPickupStudents, { campus: "A", date: "2026-09-11", search: "Ana" })).students[0]).toMatchObject({ carNumber: 20, busNumber: 123 });
  expect((await principal.query(api.students.list, {})).students.find(s => s._id === id)).toMatchObject({ carNumber: 20, busNumber: 123 });
  await expect(principal.mutation(api.students.update, { studentId: id, busNumber: "MISSING" })).rejects.toThrow("existing bus");
  await expect(principal.mutation(api.students.assignCarNumber, { studentId: id, carNumber: 123 })).rejects.toThrow("belongs to a bus");
  await expect(principal.mutation(api.buses.save, { identifier: 20, name: "Wrong", campusIds: [ids.campuses[0]] })).rejects.toThrow("assigned to a car");
  await t.run(ctx => ctx.db.patch(ids.principal, { role: "superadmin" }));
  await expect(principal.mutation(api.students.update, { studentId: id, campuses: [ids.campuses[1]] })).rejects.toThrow("not available");
  const bus = (await t.run(ctx => ctx.db.get(busId)))!;
  await expect(principal.mutation(api.buses.save, { busId, identifier: 123, name: "Bus", campusIds: [ids.campuses[1]], expectedUpdatedAt: bus.updatedAt })).rejects.toThrow("Reassign students");
  await principal.mutation(api.students.removeCarNumber, { studentId: id });
  expect(await read()).toMatchObject({ carNumber: 0, busNumber: 123 });
  await principal.mutation(api.students.assignCarNumber, { studentId: id, carNumber: 21 });
  await principal.mutation(api.students.update, { studentId: id, busNumber: 0 });
  expect(await read()).toMatchObject({ carNumber: 21, busNumber: 0 });
});

test("legacy transport migration preserves assignments and historical records idempotently", async () => {
  const { t, ids, principal } = await setup();
  await principal.mutation(api.buses.save, { identifier: 123, name: "Bus", campusIds: [ids.campuses[0]] });
  const args = { firstName: "Ana", lastName: "Test", birthday: "01/01/2015", grade: "4th" as const, campuses: [ids.campuses[0]] };
  const busStudent = await principal.mutation(api.students.create, { ...args, carNumber: 123, vehicleType: "bus" });
  const carStudent = await principal.mutation(api.students.create, { ...args, carNumber: 20 });
  expect((await principal.query(api.students.get, { id: busStudent }))!.student).toMatchObject({ carNumber: 0, busNumber: 123 });
  for (const [id, transport] of [[busStudent, { carNumber: 0, busNumber: 123 }], [carStudent, { carNumber: 20, busNumber: 0 }]] as const) {
    await t.run(async ctx => {
      const old = (await ctx.db.get(id))!;
      await ctx.db.patch(id, await studentTransport(ctx.db, old));
      const migrated = (await ctx.db.get(id))!;
      expect(migrated).toMatchObject(transport);
      expect(await studentTransport(ctx.db, migrated)).toEqual(transport);
    });
  }
  expect((await principal.query(api.students.getByCarNumber, { carNumber: 123, campusId: ids.campuses[0] })).map(s => s._id)).toEqual([busStudent]);
});

test("student bus assignments require a registered bus covering the student's campus; car numbers stay unchanged", async () => {
  const { t, ids, principal } = await setup();
  await principal.mutation(api.buses.save, {
    identifier: "BUS-1",
    name: "Bus",
    campusIds: [ids.campuses[0]],
  });
  const student = {
    firstName: "Ana",
    lastName: "Test",
    grade: "4th" as const,
    birthday: "01/01/2015",
    campuses: [ids.campuses[0]],
    carNumber: "BUS-1",
    vehicleType: "bus" as const,
  };
  const id = await principal.mutation(api.students.create, student);
  await expect(
    principal.mutation(api.students.create, {
      ...student,
      carNumber: "UNKNOWN",
    }),
  ).rejects.toThrow("existing bus");
  await expect(
    principal.mutation(api.students.create, { ...student, vehicleType: "car" }),
  ).rejects.toThrow("belongs to a bus");
  await t.run((ctx) =>
    ctx.db.patch(ids.principal, { assignedCampuses: ids.campuses }),
  );
  await expect(
    principal.mutation(api.students.update, {
      studentId: id,
      campuses: [ids.campuses[1]],
    }),
  ).rejects.toThrow("not available");
  const car = await principal.mutation(api.students.create, {
    ...student,
    carNumber: 20,
    vehicleType: "car",
  });
  expect((await t.run((ctx) => ctx.db.get(car)))?.carNumber).toBe(20);
});

test("driver selection derives campus scope from the bus, survives bus edits and ignores stale Clerk campus metadata", async () => {
  const { t, ids, principal } = await setup();
  await expect(
    principal.query(internal.buses.driverAssignment, { identifier: 123 }),
  ).rejects.toThrow("existing bus");
  await expect(
    t.mutation(internal.users.upsertFromClerk, {
      data: {
        id: "new-driver",
        updated_at: 100,
        public_metadata: { role: "bus_driver", busNumber: 123 },
      },
    }),
  ).rejects.toThrow("existing bus");
  expect(await t.run((ctx) => ctx.db.query("buses").collect())).toHaveLength(0);
  const busId = await principal.mutation(api.buses.save, {
    identifier: 123,
    name: "Bus",
    campusIds: [ids.campuses[0]],
  });
  expect(
    (
      await principal.query(internal.buses.driverAssignment, {
        identifier: 123,
      })
    ).campusIds,
  ).toEqual([ids.campuses[0]]);
  await t.run((ctx) => ctx.db.patch(ids.principal, { role: "superadmin" }));
  const bus = (await t.run((ctx) => ctx.db.get(busId)))!;
  await principal.mutation(api.buses.save, {
    busId,
    identifier: 123,
    name: bus.name,
    campusIds: ids.campuses,
    expectedUpdatedAt: bus.updatedAt,
  });
  expect(
    (await t.run((ctx) => ctx.db.get(ids.driver)))?.assignedCampuses,
  ).toEqual(ids.campuses);
  await t.mutation(internal.users.upsertFromClerk, {
    data: {
      id: "driver",
      updated_at: 100,
      public_metadata: {
        role: "bus_driver",
        busNumber: 123,
        assignedCampuses: [ids.campuses[0]],
      },
    },
  });
  expect(
    (await t.run((ctx) => ctx.db.get(ids.driver)))?.assignedCampuses,
  ).toEqual(ids.campuses);
  await t.run((ctx) => ctx.db.patch(ids.principal, { role: "principal" }));
  await expect(
    principal.query(internal.buses.driverAssignment, { identifier: 123 }),
  ).rejects.toThrow("No permission");
  expect(await principal.query(api.buses.options, { forDriver: true })).toEqual(
    [],
  );
  expect(
    await principal.query(api.buses.options, { forDriver: false }),
  ).toHaveLength(1);
});

test("direct assignments and bus edits cannot bypass campus coverage", async () => {
  const { t, ids, principal } = await setup();
  await t.run((ctx) => ctx.db.patch(ids.principal, { role: "superadmin" }));
  const studentId = await principal.mutation(api.students.create, {
    firstName: "Ana",
    lastName: "Test",
    grade: "4th",
    birthday: "01/01/2015",
    campuses: [ids.campuses[1]],
    carNumber: 20,
  });
  const busId = await principal.mutation(api.buses.save, {
    identifier: "BUS-1",
    name: "Bus",
    campusIds: [ids.campuses[0]],
  });
  await expect(
    principal.mutation(api.students.assignCarNumber, {
      studentId,
      carNumber: "BUS-1",
    }),
  ).rejects.toThrow("belongs to a bus");
  await expect(principal.mutation(api.students.update, { studentId, busNumber: "BUS-1" })).rejects.toThrow("not available");
  await expect(
    principal.mutation(api.buses.save, {
      identifier: 20,
      name: "Bus",
      campusIds: [ids.campuses[0]],
    }),
  ).rejects.toThrow("Reassign students");
  const bus = (await t.run((ctx) => ctx.db.get(busId)))!;
  await principal.mutation(api.buses.save, {
    busId,
    identifier: bus.identifier,
    name: bus.name,
    campusIds: ids.campuses,
    expectedUpdatedAt: bus.updatedAt,
  });
  await principal.mutation(api.students.update, {
    studentId,
    busNumber: "BUS-1",
  });
  const updated = (await t.run((ctx) => ctx.db.get(busId)))!;
  await expect(
    principal.mutation(api.buses.save, {
      busId,
      identifier: updated.identifier,
      name: updated.name,
      campusIds: [ids.campuses[0]],
      expectedUpdatedAt: updated.updatedAt,
    }),
  ).rejects.toThrow("Reassign students");
  expect((await t.run((ctx) => ctx.db.get(busId)))!.campusIds).toEqual(
    ids.campuses,
  );
  expect(
    (await t.run((ctx) => ctx.db.get(ids.driver)))!.assignedCampuses,
  ).toEqual(ids.campuses);
});

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const campuses = await Promise.all(
      ["A", "B"].map((campusName) =>
        ctx.db.insert("campusSettings", {
          campusName,
          timezone: "America/Bogota",
          allowMultipleStudentsPerCar: true,
          requireCarNumber: false,
          isActive: true,
          status: "active",
          createdAt: Date.now(),
        }),
      ),
    );
    const principal = await ctx.db.insert("users", {
      clerkId: "principal",
      role: "principal",
      assignedCampuses: [campuses[0]],
      isActive: true,
      createdAt: Date.now(),
    });
    const driver = await ctx.db.insert("users", {
      clerkId: "driver",
      username: "driver123",
      role: "bus_driver",
      busNumber: 123,
      assignedCampuses: campuses,
      isActive: true,
      createdAt: Date.now(),
    });
    return { campuses, principal, driver };
  });
  return { t, ids, principal: t.withIdentity({ subject: "principal" }) };
}

test("bus catalog enforces active management and campus permissions in the backend", async () => {
  const { t, ids, principal } = await setup();
  const args = {
    identifier: " 0 2 0 ",
    name: "School bus",
    campusIds: [ids.campuses[0]],
  };
  for (const role of [
    "viewer",
    "operator",
    "allocator",
    "dispatcher",
    "bus_driver",
  ] as const) {
    await t.run((ctx) => ctx.db.patch(ids.principal, { role }));
    await expect(principal.mutation(api.buses.save, args)).rejects.toThrow();
    await expect(
      principal.query(api.buses.list, {
        paginationOpts: { cursor: null, numItems: 20 },
      }),
    ).rejects.toThrow();
  }
  await t.run((ctx) =>
    ctx.db.patch(ids.principal, { role: "principal", isActive: false }),
  );
  await expect(principal.mutation(api.buses.save, args)).rejects.toThrow(
    "not active",
  );
  await t.run((ctx) => ctx.db.patch(ids.principal, { isActive: true }));
  await expect(
    principal.mutation(api.buses.save, {
      ...args,
      campusIds: [ids.campuses[1]],
    }),
  ).rejects.toThrow("not authorized");
  const id = await principal.mutation(api.buses.save, args);
  expect(
    (await principal.query(api.buses.get, { busId: id }))?.identifier,
  ).toBe(20);
  await expect(
    principal.mutation(api.buses.save, { ...args, identifier: 20 }),
  ).rejects.toThrow("already exists");
  await t.run((ctx) =>
    ctx.db.patch(ids.principal, { assignedCampuses: [ids.campuses[1]] }),
  );
  expect(await principal.query(api.buses.get, { busId: id })).toBeNull();
  expect(
    (
      await principal.query(api.buses.list, {
        paginationOpts: { cursor: null, numItems: 20 },
      })
    ).page,
  ).toEqual([]);
});

test("driver migration deduplicates global identifiers and buses survive driver deletion", async () => {
  const { t, ids, principal } = await setup();
  const id = await t.run(async (ctx) => {
    const driver = (await ctx.db.get(ids.driver))!;
    const id = await ensureDriverBus(ctx, driver);
    expect(await ensureDriverBus(ctx, driver)).toBe(id);
    expect(await ctx.db.query("buses").collect()).toHaveLength(1);
    return id!;
  });
  const bus = await principal.query(api.buses.get, { busId: id });
  expect(bus?.campuses.map((c) => c.name)).toEqual(["A"]);
  expect(bus?.canEdit).toBe(false);
  expect(bus?.drivers[0].username).toBe("driver123");
  await expect(
    principal.mutation(api.buses.save, {
      busId: id,
      name: "Changed",
      identifier: 123,
      campusIds: [ids.campuses[0]],
      expectedUpdatedAt: bus!.updatedAt,
    }),
  ).rejects.toThrow("Not authorized");
  await t.mutation(internal.users.deleteFromClerk, { clerkUserId: "driver" });
  expect(await t.run((ctx) => isBus(ctx.db, 123))).toBe(true);
  expect(
    (await principal.query(api.buses.get, { busId: id }))?.drivers,
  ).toEqual([]);
});

test("migration preserves student campuses and synchronizes the drivers idempotently", async () => {
  const { t, ids } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.patch(ids.driver, { assignedCampuses: [ids.campuses[0]] });
    await ctx.db.insert("students", {
      firstName: "Ana",
      lastName: "Test",
      fullName: "Ana Test",
      grade: "4th",
      birthday: "01/01/2015",
      carNumber: 123,
      campuses: [ids.campuses[1]],
      isActive: true,
      createdAt: Date.now(),
    });
    const driver = (await ctx.db.get(ids.driver))!;
    const busId = (await ensureDriverBus(ctx, driver))!;
    expect((await ctx.db.get(busId))!.campusIds).toEqual(ids.campuses);
    expect((await ctx.db.get(ids.driver))!.assignedCampuses).toEqual(
      ids.campuses,
    );
    const bus = await ctx.db.get(busId);
    expect(await ensureDriverBus(ctx, driver)).toBe(busId);
    expect(await ctx.db.get(busId)).toEqual(bus);
  });
});

test("bus edits preserve assignment keys and reject stale versions", async () => {
  const { t, ids, principal } = await setup();
  const args = {
    identifier: "ABC-123",
    name: "Bus",
    campusIds: [ids.campuses[0]],
  };
  const busId = await principal.mutation(api.buses.save, args);
  const bus = (await principal.query(api.buses.get, { busId }))!;
  const edit = {
    ...args,
    busId,
    expectedUpdatedAt: bus.updatedAt,
    name: "New name",
  };
  await expect(
    principal.mutation(api.buses.save, { ...edit, identifier: "OTHER" }),
  ).rejects.toThrow("cannot be changed");
  await principal.mutation(api.buses.save, edit);
  await expect(principal.mutation(api.buses.save, edit)).rejects.toThrow(
    "changed",
  );
  expect(await t.run((ctx) => isBus(ctx.db, "ABC-123"))).toBe(true);
});
