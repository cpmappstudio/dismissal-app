/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import { Webhook } from "svix";
import schema from "./schema";
import { internal } from "./_generated/api";
import { isBus } from "./studentDismissals";

const modules = import.meta.glob("./**/*.ts");
const secret = "whsec_dGVzdC13ZWJob29rLXNlY3JldA==";
const active = {
  id: "driver", updated_at: 100, username: "driver_test",
  public_metadata: { role: "bus_driver", busNumber: 123, status: "active", assignedCampuses: [] },
};
const inactive = { ...active, updated_at: 200, public_metadata: { ...active.public_metadata, status: "inactive" } };

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async ctx => {
    const campus = await ctx.db.insert("campusSettings", { campusName: "School", timezone: "America/Bogota", allowMultipleStudentsPerCar: true, requireCarNumber: false, isActive: true, status: "active", createdAt: Date.now() });
    await ctx.db.insert("buses", { identifier: 123, name: "Bus", campusIds: [campus], createdAt: Date.now(), updatedAt: Date.now() });
  });
  vi.stubEnv("CLERK_WEBHOOK_SECRET", secret);
  vi.stubEnv("CLERK_SECRET_KEY", "test-only-key");
  // Every external request must be explicitly mocked by the test.
  const fetchMock = vi.fn((): Promise<Response> => Promise.reject(new Error("Unexpected Clerk request")));
  vi.stubGlobal("fetch", fetchMock);
  const read = () => t.query(internal.users.getUserByClerkIdInternal, { clerkId: active.id });
  const send = (type: string, data: object = active) => {
    const body = JSON.stringify({ type, data });
    const date = new Date();
    return t.fetch("/clerk-users-webhook", { method: "POST", body, headers: {
      "svix-id": "msg_test", "svix-timestamp": String(Math.floor(date.getTime() / 1000)),
      "svix-signature": new Webhook(secret).sign("msg_test", date, body),
    } });
  };
  const legacy = () => t.run(ctx => ctx.db.insert("users", {
    clerkId: active.id, username: active.username, role: "bus_driver", busNumber: 123,
    assignedCampuses: [], isActive: true, createdAt: Date.now(), updatedAt: Date.now(),
  }));
  return { t, read, send, fetchMock, legacy };
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test("old and duplicate Clerk versions cannot undo deactivation; newer versions still apply", async () => {
  const { t, read, send, fetchMock } = await setup();
  await t.mutation(internal.users.upsertFromClerk, { data: inactive });
  const before = await read();
  for (const data of [active, inactive, { ...active, updated_at: 200 }]) {
    expect((await send("user.updated", data)).status).toBe(200);
    expect(await read()).toEqual(before);
    expect(await t.run(ctx => isBus(ctx.db, 123))).toBe(true);
  }
  expect(fetchMock).not.toHaveBeenCalled();
  await t.mutation(internal.users.upsertFromClerk, { data: { ...active, updated_at: 300 } });
  expect(await read()).toMatchObject({ _id: before!._id, isActive: true, clerkUpdatedAt: 300 });
});

test.each([true, false])("deletion is terminal even before user creation (existing: %s)", async (existing) => {
  const { t, read, send, fetchMock } = await setup();
  if (existing) await t.mutation(internal.users.upsertFromClerk, { data: active });
  for (let i = 0; i < 2; i++) expect((await send("user.deleted", { id: active.id })).status).toBe(200);
  for (const data of [active, inactive, { ...active, updated_at: 300 }]) {
    await t.mutation(internal.users.upsertFromClerk, { data });
    expect(await read()).toBeNull();
  }
  fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
  expect((await send("user.created")).status).toBe(200);
  expect(await read()).toBeNull();
  // A registered bus survives its driver. A stale event must not create either record.
  expect(await t.run(ctx => isBus(ctx.db, 123))).toBe(true);
  expect(await t.run(ctx => ctx.db.query("deletedClerkUsers").collect())).toHaveLength(1);
  // The username can be reused by a genuinely new Clerk account.
  await t.mutation(internal.users.upsertFromClerk, { data: { ...active, id: "new-driver" } });
  expect(await t.run(ctx => isBus(ctx.db, 123))).toBe(true);
});

test("legacy users bootstrap from current Clerk state, not an old webhook or the local clock", async () => {
  const { read, send, fetchMock, legacy } = await setup();
  const id = await legacy();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(inactive)));
  expect((await send("user.updated")).status).toBe(200);
  expect(await read()).toMatchObject({ _id: id, isActive: false, clerkUpdatedAt: 200 });
  expect((await send("user.created")).status).toBe(200);
  expect((await read())?.isActive).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("temporary user merging preserves the ID and initializes the Clerk source version", async () => {
  const { t, read } = await setup();
  const id = await t.run(ctx => ctx.db.insert("users", {
    clerkId: "temp_driver", email: "driver@example.test", assignedCampuses: [],
    isActive: false, createdAt: Date.now(),
  }));
  const data = { ...inactive, email_addresses: [{ email_address: "driver@example.test" }] };
  await t.mutation(internal.users.upsertFromClerk, { data });
  await t.mutation(internal.users.upsertFromClerk, { data: { ...data, ...active } });
  expect(await read()).toMatchObject({ _id: id, clerkId: active.id, clerkUpdatedAt: 200, isActive: false });
  expect(await t.run(ctx => ctx.db.query("users").collect())).toHaveLength(1);
});

test("a replay for an account deleted before this fix cannot recreate it", async () => {
  const { t, read, send, fetchMock } = await setup();
  fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
  expect((await send("user.updated")).status).toBe(200);
  expect(await read()).toBeNull();
  expect(await t.run(ctx => ctx.db.query("deletedClerkUsers").collect())).toHaveLength(1);
});

test.each(["update", "delete"])("an in-flight bootstrap cannot overwrite a concurrent %s", async (change) => {
  const { t, read, send, fetchMock, legacy } = await setup();
  await legacy();
  fetchMock.mockImplementationOnce(async () => {
    if (change === "delete") await t.mutation(internal.users.deleteFromClerk, { clerkUserId: active.id });
    else await t.mutation(internal.users.upsertFromClerk, { data: inactive });
    return new Response(JSON.stringify(active));
  });
  expect((await send("user.updated")).status).toBe(200);
  if (change === "delete") expect(await read()).toBeNull();
  else expect(await read()).toMatchObject({ isActive: false, clerkUpdatedAt: 200 });
});

test.each([401, 429, 500, "network"])("bootstrap failure %s is retryable without changing the user", async (failure) => {
  const { read, send, fetchMock, legacy } = await setup();
  await legacy();
  const before = await read();
  if (failure === "network") fetchMock.mockRejectedValueOnce(new Error("Network failure"));
  else fetchMock.mockResolvedValueOnce(new Response(null, { status: failure as number }));
  expect((await send("user.updated")).status).toBe(500);
  expect(await read()).toEqual(before);
});

test("missing source versions fail closed and malformed signatures never reach Clerk", async () => {
  const { t, read, fetchMock } = await setup();
  await t.mutation(internal.users.upsertFromClerk, { data: inactive });
  const before = await read();
  for (const updated_at of [undefined, null, "300", -1, 1.5]) {
    await expect(t.mutation(internal.users.upsertFromClerk, { data: { ...active, updated_at } })).rejects.toThrow("updated_at");
    expect(await read()).toEqual(before);
  }
  expect((await t.fetch("/clerk-users-webhook", { method: "POST", body: "{}" })).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
