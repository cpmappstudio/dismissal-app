/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const campus = await ctx.db.insert("campusSettings", {
      campusName: "School", timezone: "America/Bogota", isActive: true, status: "active",
      allowMultipleStudentsPerCar: true, requireCarNumber: false, createdAt: Date.now(),
    });
    const storageId = await ctx.storage.store(new Blob(["avatar"]));
    const actor = await ctx.db.insert("users", {
      clerkId: "actor", role: "principal", assignedCampuses: [campus], isActive: true, createdAt: Date.now(),
    });
    const target = await ctx.db.insert("users", {
      clerkId: "target", role: "bus_driver", busNumber: 123, assignedCampuses: [campus],
      isActive: true, avatarStorageId: storageId, createdAt: Date.now(),
    });
    const student = await ctx.db.insert("students", {
      firstName: "Student", lastName: "One", fullName: "Student One", grade: "4th",
      birthday: "01/01/2015", campuses: [campus], carNumber: 1, isActive: true, createdAt: Date.now(),
    });
    return { actor, target, student, storageId };
  });
  return { t, ids, caller: t.withIdentity({ subject: "actor" }) };
}

test.each(["viewer", "operator", "allocator", "dispatcher", "bus_driver"] as const)("%s cannot delete another user's avatar", async (role) => {
  const { t, ids, caller } = await setup();
  await t.run(ctx => ctx.db.patch(ids.actor, { role }));
  const before = await t.run(ctx => ctx.db.get(ids.target));
  await expect(caller.mutation(api.users.deleteAvatar, { userId: ids.target })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.get(ids.target))).toEqual(before);
  expect(await t.run(async ctx => (await ctx.storage.get(ids.storageId))?.text())).toBe("avatar");
});

test.each(["viewer", "operator", "allocator", "dispatcher", "bus_driver"] as const)("%s cannot write user or student avatars", async (role) => {
  const { t, ids, caller } = await setup();
  await t.run(ctx => ctx.db.patch(ids.actor, { role }));
  const upload = await t.run(ctx => ctx.storage.store(new Blob(["new avatar"])));
  await expect(caller.mutation(api.users.generateAvatarUploadUrl, {})).rejects.toThrow();
  await expect(caller.mutation(api.users.saveAvatarStorageId, { userId: ids.target, storageId: upload })).rejects.toThrow();
  await expect(caller.mutation(api.students.generateAvatarUploadUrl, {})).rejects.toThrow();
  await expect(caller.mutation(api.students.saveAvatarStorageId, { studentId: ids.student, storageId: upload })).rejects.toThrow();
  await expect(caller.mutation(api.students.deleteAvatar, { studentId: ids.student })).rejects.toThrow();
});

test("avatar deletion and user editing share target-role and campus restrictions", async () => {
  const { t, ids, caller } = await setup();
  const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("Unexpected Clerk request"));
  vi.stubGlobal("fetch", fetchMock);
  try {
    const original = (await t.run(ctx => ctx.db.get(ids.target)))!;
    const targets: Partial<Doc<"users">>[] = [
      { role: "principal" }, { role: "admin" }, { role: "superadmin" }, { assignedCampuses: [] },
    ];
    for (const role of ["principal", "admin"] as const) {
      await t.run(ctx => ctx.db.patch(ids.actor, { role }));
      for (const target of targets) {
        await t.run(ctx => ctx.db.patch(ids.target, { role: original.role, assignedCampuses: original.assignedCampuses, ...target }));
        const before = await t.run(ctx => ctx.db.get(ids.target));
        await expect(caller.mutation(api.users.deleteAvatar, { userId: ids.target })).rejects.toThrow();
        await expect(caller.action(api.users.updateUserWithClerk, { clerkUserId: "target", firstName: "Changed" })).rejects.toThrow();
        await expect(caller.action(api.users.updateClerkProfileImage, { clerkUserId: "target", avatarStorageId: null })).rejects.toThrow();
        expect(await t.run(ctx => ctx.db.get(ids.target))).toEqual(before);
        expect(await t.run(async ctx => (await ctx.storage.get(ids.storageId))?.text())).toBe("avatar");
      }
    }
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

test("avatar deletion rejects unauthenticated, missing and inactive callers without touching storage", async () => {
  const { t, ids, caller } = await setup();
  const before = await t.run(ctx => ctx.db.get(ids.target));
  for (const requester of [t, t.withIdentity({ subject: "missing" })])
    await expect(requester.mutation(api.users.deleteAvatar, { userId: ids.target })).rejects.toThrow();
  for (const role of ["principal", "admin", "superadmin"] as const) {
    for (const state of [{ isActive: false, status: "active" }, { isActive: true, status: "inactive" }] as const) {
      await t.run(ctx => ctx.db.patch(ids.actor, { role, ...state }));
      await expect(caller.mutation(api.users.deleteAvatar, { userId: ids.target })).rejects.toThrow("User not active");
    }
  }
  expect(await t.run(ctx => ctx.db.get(ids.target))).toEqual(before);
  expect(await t.run(async ctx => (await ctx.storage.get(ids.storageId))?.text())).toBe("avatar");
});

test.each(["principal", "admin", "superadmin"] as const)("authorized %s can delete an avatar idempotently", async (role) => {
  const { t, ids, caller } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch(ids.actor, { role });
    // A superadmin can also edit a management user without a shared campus.
    if (role === "superadmin") await ctx.db.patch(ids.target, { role: "principal", assignedCampuses: [] });
  });
  const before = (await t.run(ctx => ctx.db.get(ids.target)))!;
  for (let i = 0; i < 2; i++) expect(await caller.mutation(api.users.deleteAvatar, { userId: ids.target })).toBe(ids.target);
  const after = await t.run(ctx => ctx.db.get(ids.target));
  const { avatarStorageId, ...unchanged } = before;
  expect(after).toEqual({ ...unchanged, updatedAt: expect.any(Number) });
  expect(await t.run(ctx => ctx.storage.get(avatarStorageId!))).toBeNull();
  await t.run(ctx => ctx.db.delete(ids.target));
  await expect(caller.mutation(api.users.deleteAvatar, { userId: ids.target })).rejects.toThrow("User not found");
});
