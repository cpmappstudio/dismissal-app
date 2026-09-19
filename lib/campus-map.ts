import { countries, statesByCountry } from "./countries-data";

export type CampusAddress = {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
};
export type CampusMapPoint = {
  latitude: number;
  longitude: number;
  precision: "address" | "street" | "postal" | "city" | "state" | "country";
  label: string;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function campusAddressKey(address?: CampusAddress) {
  return JSON.stringify(
    [
      address?.street,
      address?.zipCode,
      address?.city,
      address?.state,
      address?.country,
    ].map((v) => normalize(v ?? "")),
  );
}

function addressParts(address: CampusAddress) {
  const country = countries.find(
    (c) =>
      normalize(c.value) === normalize(address.country ?? "") ||
      normalize(c.label) === normalize(address.country ?? ""),
  );
  const code =
    country?.value ??
    (/^[a-z]{2}$/i.test(address.country ?? "")
      ? address.country!.toUpperCase()
      : "");
  const state = statesByCountry[code]?.find(
    (s) =>
      normalize(s.value) === normalize(address.state ?? "") ||
      normalize(s.label) === normalize(address.state ?? ""),
  );
  return {
    ...address,
    country: country?.label ?? address.country,
    code,
    state: state?.label ?? address.state,
  };
}

const streetName = (value: string) =>
  normalize(value)
    .replace(/^\d+\w*\s+/, "")
    .replace(
      /\b(st|rd|ave|blvd|dr|ln|ct|hwy)\b/g,
      (word) =>
        ({
          st: "street",
          rd: "road",
          ave: "avenue",
          blvd: "boulevard",
          dr: "drive",
          ln: "lane",
          ct: "court",
          hwy: "highway",
        })[word]!,
    );
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Only send campus address fields, never students, drivers, or their locations. */
export async function geocodeCampusAddress(
  address: CampusAddress,
  endpoint = "https://photon.komoot.io/api/",
): Promise<CampusMapPoint | null> {
  const a = addressParts(address);
  const attempts = [
    a.street && {
      precision: "street",
      parts: [a.street, a.zipCode, a.city, a.state, a.country],
    },
    a.zipCode && {
      precision: "postal",
      parts: [a.zipCode, a.city, a.state, a.country],
    },
    a.city && { precision: "city", parts: [a.city, a.state, a.country] },
    a.state && { precision: "state", parts: [a.state, a.country] },
    a.country && { precision: "country", parts: [a.country] },
  ].filter(Boolean) as {
    precision: CampusMapPoint["precision"];
    parts: (string | undefined)[];
  }[];

  for (const [index, attempt] of attempts.entries()) {
    if (index) await new Promise((resolve) => setTimeout(resolve, 1000));
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      q: attempt.parts.filter(Boolean).join(", "),
      limit: "5",
      lang: "en",
    }).toString();
    if (a.code)
      url.searchParams.set("countrycode", a.code === "PR" ? "US" : a.code);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "DismissalApp/1.0 (https://www.dismissalapp.com)",
      },
    });
    if (!response.ok)
      throw new Error(`Geocoding service returned ${response.status}`);
    const data = object(await response.json());
    if (!Array.isArray(data.features))
      throw new Error("Invalid geocoding response");
    const matches: CampusMapPoint[] = [];
    for (const feature of data.features) {
      const f = object(feature),
        p = object(f.properties),
        geometry = object(f.geometry);
      const coords = geometry.coordinates;
      if (geometry.type !== "Point" || !Array.isArray(coords)) continue;
      const [longitude, latitude] = coords;
      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 85 ||
        Math.abs(longitude) > 180
      )
        continue;
      const text = (key: string) =>
        typeof p[key] === "string" ? (p[key] as string) : "";
      const equal = (one: string, two: string | undefined) =>
        !!one && !!two && normalize(one) === normalize(two);
      if (
        a.code &&
        text("countrycode").toUpperCase() !== (a.code === "PR" ? "US" : a.code)
      )
        continue;
      if (!a.code && a.country && !equal(text("country"), a.country)) continue;
      if (
        a.code === "PR" &&
        ![text("state"), text("name")].some((v) => equal(v, "Puerto Rico"))
      )
        continue;
      const level = attempt.precision;
      if (
        level !== "country" &&
        a.state &&
        !equal(
          text("state") || (p.type === "state" ? text("name") : ""),
          a.state,
        )
      )
        continue;
      if (level === "street" && a.city && !equal(text("city"), a.city))
        continue;
      let precision = level;
      if (level === "street") {
        if (
          !["house", "street"].includes(text("type")) ||
          streetName(text("street") || text("name")) !== streetName(a.street!)
        )
          continue;
        if (a.zipCode && !equal(text("postcode"), a.zipCode)) continue;
        const house = a.street!.match(/^\s*(\d+\w*)\b/)?.[1];
        if (p.type === "house" && house && !equal(text("housenumber"), house))
          continue;
        precision = p.type === "house" && house ? "address" : "street";
      } else if (level === "postal") {
        if (p.osm_value !== "postcode" || !equal(text("name"), a.zipCode))
          continue;
      } else if (level === "city") {
        if (
          !["city", "locality"].includes(text("type")) ||
          !equal(text("name"), a.city)
        )
          continue;
      } else if (level === "state") {
        if (p.type !== "state" || !equal(text("name"), a.state)) continue;
      } else if (
        a.code === "PR"
          ? !equal(text("name"), "Puerto Rico")
          : p.type !== "country"
      )
        continue;
      matches.push({
        latitude,
        longitude,
        precision,
        label: [
          ...new Set(
            [
              text("street") || text("name"),
              text("city"),
              text("state"),
              text("country"),
            ].filter(Boolean),
          ),
        ].join(", "),
      });
    }
    // A distant namesake is ambiguous. Fall back to the next broader region.
    if (
      matches.length &&
      matches.every(
        (p) =>
          Math.abs(p.latitude - matches[0].latitude) < 0.25 &&
          Math.abs(p.longitude - matches[0].longitude) < 0.25,
      )
    )
      return matches[0];
  }
  return null;
}

export const campusMapZoom: Record<CampusMapPoint["precision"], number> = {
  address: 14,
  street: 13,
  postal: 11,
  city: 11,
  state: 6,
  country: 3,
};
