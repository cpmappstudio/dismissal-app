/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { campusAddressKey, geocodeCampusAddress } from "../lib/campus-map";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const feature = (
  properties: Record<string, string>,
  coordinates = [-81.3996, 28.3087],
) => ({
  properties: { countrycode: "US", country: "United States", ...properties },
  geometry: { type: "Point", coordinates },
});
const response = (...features: ReturnType<typeof feature>[]) =>
  new Response(JSON.stringify({ features }));

test("geocoding respects address, postal, city, state and country precision, never inventing a house", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    response(
      feature({
        type: "street",
        name: "Smith Street",
        postcode: "34744",
        state: "Florida",
        city: "Kissimmee",
      }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(
    await geocodeCampusAddress({
      street: "2480 Smith St",
      zipCode: "34744",
      country: "US",
    }),
  ).toMatchObject({ precision: "street", latitude: 28.3087 });
  expect(String(fetcher.mock.calls[0][0])).toContain("countrycode=US");
  for (const [address, props, precision] of [
    [
      { zipCode: "34744", country: "US" },
      { type: "other", osm_value: "postcode", name: "34744" },
      "postal",
    ],
    [
      { city: "kissimmee", state: "FL", country: "US" },
      { type: "city", name: "Kissimmee", state: "Florida" },
      "city",
    ],
    [
      { state: "FL", country: "US" },
      { type: "state", name: "Florida", state: "Florida" },
      "state",
    ],
    [{ country: "US" }, { type: "country", name: "United States" }, "country"],
  ] as const) {
    fetcher.mockResolvedValueOnce(response(feature(props)));
    expect(await geocodeCampusAddress(address)).toMatchObject({ precision });
  }
  expect(campusAddressKey({ city: " Kissimmee ", country: "US" })).toBe(
    campusAddressKey({ country: "us", city: "kissimmee" }),
  );
});

test("an unresolved address falls back; namesakes, malformed coordinates and wrong countries are rejected", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      response(
        feature({ type: "street", name: "Wrong Street", postcode: "34744" }),
      ),
    )
    .mockResolvedValueOnce(
      response(
        feature({ type: "other", osm_value: "postcode", name: "34744" }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(
    await geocodeCampusAddress({
      street: "2480 Smith St",
      zipCode: "34744",
      country: "US",
    }),
  ).toMatchObject({ precision: "postal" });
  fetcher.mockResolvedValue(
    response(
      feature({ type: "country", name: "United States", countrycode: "HN" }),
      feature({ type: "country" }, [999, 999]),
    ),
  );
  expect(await geocodeCampusAddress({ country: "US" })).toBeNull();
  fetcher
    .mockResolvedValueOnce(
      response(
        feature({ type: "city", name: "Springfield" }),
        feature({ type: "city", name: "Springfield" }, [-100, 40]),
      ),
    )
    .mockResolvedValueOnce(
      response(feature({ type: "country", name: "United States" })),
    );
  expect(
    await geocodeCampusAddress({ city: "Springfield", country: "US" }),
  ).toMatchObject({ precision: "country" });
  fetcher.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
  await expect(geocodeCampusAddress({ country: "US" })).rejects.toThrow("503");
  fetcher.mockClear();
  expect(await geocodeCampusAddress({})).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

async function setup() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const campuses = await Promise.all(
      ["A", "B"].map((campusName) =>
        ctx.db.insert("campusSettings", {
          campusName,
          timezone: "America/New_York",
          isActive: true,
          status: "active",
          createdAt: Date.now(),
          allowMultipleStudentsPerCar: true,
          requireCarNumber: false,
          address: { country: "US" },
        }),
      ),
    );
    const user = await ctx.db.insert("users", {
      clerkId: "manager",
      role: "principal",
      assignedCampuses: [campuses[0]],
      isActive: true,
      createdAt: Date.now(),
    });
    const busId = await ctx.db.insert("buses", {
      name: "Test",
      identifier: "BUS",
      campusIds: campuses,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { campuses, user, busId };
  });
  return { t, ids, manager: t.withIdentity({ subject: "manager" }) };
}

test("bus maps enforce campus access, deduplicate lookups and persist results for both views", async () => {
  const { t, ids, manager } = await setup();
  const fetcher = vi
    .fn()
    .mockImplementation(() =>
      response(feature({ type: "country", name: "United States" })),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    t.mutation(api.campusMaps.ensureForBus, { busId: ids.busId }),
  ).rejects.toThrow();
  await Promise.all(
    [1, 2].map(() =>
      manager.mutation(api.campusMaps.ensureForBus, { busId: ids.busId }),
    ),
  );
  expect(
    (await t.run((ctx) => ctx.db.get(ids.campuses[1])))?.mapLocation,
  ).toBeUndefined();
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(fetcher).toHaveBeenCalledTimes(1);
  await manager.mutation(api.campusMaps.ensureForBus, { busId: ids.busId });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(fetcher).toHaveBeenCalledTimes(1);
  const detail = await manager.query(api.buses.get, { busId: ids.busId });
  const list = await manager.query(api.buses.list, {
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(detail?.campuses).toEqual(list.page[0].campuses);
  expect(detail?.campuses).toHaveLength(1);
  expect(detail?.campuses[0].mapLocation?.status).toBe("ready");
  await t.run((ctx) => ctx.db.patch(ids.user, { role: "viewer" }));
  await expect(
    manager.mutation(api.campusMaps.ensureForBus, { busId: ids.busId }),
  ).rejects.toThrow();
});

test("address edits invalidate old responses; provider failure leaves campus saves intact and supports retry", async () => {
  const { t, ids, manager } = await setup();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await manager.mutation(api.campusMaps.ensureForBus, { busId: ids.busId });
  const old = (await t.run((ctx) => ctx.db.get(ids.campuses[0])))!.mapLocation!;
  await manager.mutation(api.campus.update, {
    campusId: ids.campuses[0],
    updates: { address: { country: "HN" } },
  });
  await t.mutation(internal.campusMaps.finish, {
    campusId: ids.campuses[0],
    requestedAt: old.requestedAt,
    failed: false,
    point: { latitude: 1, longitude: 1, label: "Stale", precision: "country" },
  });
  expect(
    (await t.run((ctx) => ctx.db.get(ids.campuses[0])))!.mapLocation?.point,
  ).toBeUndefined();
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const campus = (await t.run((ctx) => ctx.db.get(ids.campuses[0])))!;
  expect(campus.address).toEqual({ country: "HN" });
  expect(campus.mapLocation?.status).toBe("error");
  vi.advanceTimersByTime(60_001);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      response(
        feature({
          type: "country",
          name: "Honduras",
          countrycode: "HN",
          country: "Honduras",
        }),
      ),
    ),
  );
  await manager.mutation(api.campusMaps.ensureForBus, { busId: ids.busId });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(
    (await t.run((ctx) => ctx.db.get(ids.campuses[0])))!.mapLocation?.status,
  ).toBe("ready");
});
