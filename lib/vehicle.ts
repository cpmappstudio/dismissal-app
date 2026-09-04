// Numeric identifiers retain their stored type so existing assignments/indexes need no migration.
export type VehicleIdentifier = number | string;

export function normalizeVehicleIdentifier(
  value: VehicleIdentifier,
  allowUnassigned = false,
): VehicleIdentifier {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0))
    throw new Error("Invalid vehicle number");
  const text = String(value).replace(/\s+/g, "").toUpperCase();
  if ((!text || text === "0") && allowUnassigned) return 0;
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(text) || text.length > 20) {
    throw new Error(
      "Enter a valid vehicle number or license plate (maximum 20 characters)",
    );
  }
  if (/^\d+$/.test(text)) {
    const number = Number(text);
    if (!Number.isSafeInteger(number) || number <= 0)
      throw new Error("Invalid vehicle number");
    return number;
  }
  return text;
}

export function vehicleColorIndex(value: VehicleIdentifier): number {
  return typeof value === "number"
    ? value
    : Array.from(value).reduce(
        (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
        0,
      );
}
