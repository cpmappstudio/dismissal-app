/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { CAMPUS_IMAGE_MAX_BYTES } from "../lib/campus-image";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: "manager",
      role: "superadmin",
      assignedCampuses: [],
      isActive: true,
      createdAt: Date.now(),
    }),
  );
  const caller = t.withIdentity({ subject: "manager" });
  const store = (type = "image/png", size = 10) =>
    t.run(async (ctx) => {
      const id = await ctx.storage.store(
        new Blob([new Uint8Array(size)], { type }),
      );
      // convex-test 0.0.41 omits contentType in storeBlob; real uploads set it.
      await (
        ctx.db as unknown as { patch(id: string, value: object): Promise<void> }
      ).patch(id, { contentType: type });
      return id;
    });
  return { t, caller, store };
}

test("campuses can be created without an image or with a stored image", async () => {
  const { t, caller, store } = await setup();
  const empty = await caller.mutation(api.campus.create, {
    campusName: "No image",
  });
  expect(
    (await t.run((ctx) => ctx.db.get(empty)))?.logoStorageId,
  ).toBeUndefined();
  const storageId = await store();
  const campus = await caller.mutation(api.campus.create, {
    campusName: "With image",
    logoStorageId: storageId,
  });
  expect((await t.run((ctx) => ctx.db.get(campus)))?.logoStorageId).toBe(
    storageId,
  );
  expect(await caller.query(api.campus.getLogoUrl, { storageId })).toEqual(
    expect.any(String),
  );
});

test("editing other fields preserves the photo; replacement and removal clean up the previous file", async () => {
  const { t, caller, store } = await setup();
  const old = await store();
  const campusId = await caller.mutation(api.campus.create, {
    campusName: "School",
    logoStorageId: old,
  });
  await caller.mutation(api.campus.update, {
    campusId,
    updates: { description: "Changed" },
  });
  expect((await t.run((ctx) => ctx.db.get(campusId)))?.logoStorageId).toBe(old);
  const replacement = await store("image/webp");
  await caller.mutation(api.campus.update, {
    campusId,
    updates: { logoStorageId: replacement },
  });
  expect((await t.run((ctx) => ctx.db.get(campusId)))?.logoStorageId).toBe(
    replacement,
  );
  expect(await t.run((ctx) => ctx.db.system.get(old))).toBeNull();
  // Repeating the same ID must not delete the current file.
  await caller.mutation(api.campus.update, {
    campusId,
    updates: { logoStorageId: replacement },
  });
  expect(await t.run((ctx) => ctx.db.system.get(replacement))).not.toBeNull();
  await caller.mutation(api.campus.update, {
    campusId,
    updates: { logoStorageId: null },
  });
  expect(
    (await t.run((ctx) => ctx.db.get(campusId)))?.logoStorageId,
  ).toBeUndefined();
  expect(await t.run((ctx) => ctx.db.system.get(replacement))).toBeNull();
});

test.each([
  ["image/svg+xml", 10],
  ["text/html", 10],
  ["image/png", 0],
  ["image/png", CAMPUS_IMAGE_MAX_BYTES + 1],
])(
  "invalid upload %s (%i bytes) is rejected without losing the existing image",
  async (type, size) => {
    const { t, caller, store } = await setup();
    const old = await store();
    const campusId = await caller.mutation(api.campus.create, {
      campusName: "School",
      logoStorageId: old,
    });
    const invalid = await store(type, size);
    await expect(
      caller.mutation(api.campus.create, {
        campusName: "Invalid",
        logoStorageId: invalid,
      }),
    ).rejects.toThrow("INVALID_CAMPUS_IMAGE");
    await expect(
      caller.mutation(api.campus.update, {
        campusId,
        updates: { description: "Should not save", logoStorageId: invalid },
      }),
    ).rejects.toThrow("INVALID_CAMPUS_IMAGE");
    await expect(
      caller.mutation(api.campus.saveCampusLogo, {
        campusId,
        storageId: invalid,
      }),
    ).rejects.toThrow("INVALID_CAMPUS_IMAGE");
    const campus = await t.run((ctx) => ctx.db.get(campusId));
    expect(campus?.logoStorageId).toBe(old);
    expect(campus?.description).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.system.get(old))).not.toBeNull();
  },
);

test("missing files are rejected and assigned managers alone can change a campus image", async () => {
  const { t, caller, store } = await setup();
  const old = await store();
  const campusId = await caller.mutation(api.campus.create, {
    campusName: "School",
    logoStorageId: old,
  });
  const missing = await store();
  await t.run((ctx) => ctx.storage.delete(missing));
  await expect(
    caller.mutation(api.campus.update, {
      campusId,
      updates: { logoStorageId: missing },
    }),
  ).rejects.toThrow("INVALID_CAMPUS_IMAGE");
  const adminId = await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: "admin",
      role: "admin",
      assignedCampuses: [],
      isActive: true,
      createdAt: Date.now(),
    }),
  );
  const admin = t.withIdentity({ subject: "admin" });
  const replacement = await store("image/jpeg");
  await expect(
    admin.mutation(api.campus.update, {
      campusId,
      updates: { logoStorageId: replacement },
    }),
  ).rejects.toThrow("No access");
  await expect(t.mutation(api.campus.generateUploadUrl, {})).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.system.get(old))).not.toBeNull();
  await t.run((ctx) => ctx.db.patch(adminId, { assignedCampuses: [campusId] }));
  await admin.mutation(api.campus.update, {
    campusId,
    updates: { logoStorageId: replacement },
  });
  expect((await t.run((ctx) => ctx.db.get(campusId)))?.logoStorageId).toBe(
    replacement,
  );
});

test("legacy save and delete endpoints preserve the same file lifecycle", async () => {
  const { t, caller, store } = await setup();
  const old = await store();
  const campusId = await caller.mutation(api.campus.create, {
    campusName: "School",
    logoStorageId: old,
  });
  const replacement = await store();
  await caller.mutation(api.campus.saveCampusLogo, {
    campusId,
    storageId: replacement,
  });
  expect(await t.run((ctx) => ctx.db.system.get(old))).toBeNull();
  await caller.mutation(api.campus.deleteCampusLogo, { campusId });
  expect(await t.run((ctx) => ctx.db.system.get(replacement))).toBeNull();
  expect(
    (await t.run((ctx) => ctx.db.get(campusId)))?.logoStorageId,
  ).toBeUndefined();
});
