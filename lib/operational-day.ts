// Institution-wide cutoff: keep the existing lane reset at 05:00 UTC year-round.
export const DAILY_RESET_UTC = { hourUTC: 5, minuteUTC: 0 };
const DAY_MS = 24 * 60 * 60 * 1000;
const CUTOFF_MS = (DAILY_RESET_UTC.hourUTC * 60 + DAILY_RESET_UTC.minuteUTC) * 60 * 1000;

export function operationalDate(timestamp = Date.now()): string {
  return new Date(timestamp - CUTOFF_MS).toISOString().slice(0, 10);
}

export function nextOperationalDay(timestamp = Date.now()): number {
  return Date.parse(operationalDate(timestamp)) + DAY_MS + CUTOFF_MS;
}
