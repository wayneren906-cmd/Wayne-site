import type { Entry } from "./records";

// UTC date arithmetic keeps the date index stable across browser time zones.
export function shiftDate(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function startOfWeek(date: string) {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return shiftDate(date, -((day + 6) % 7));
}

export function activityByDate(records: Entry[]) {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.date, (counts.get(record.date) ?? 0) + record.items.length);
  return counts;
}

export function yearWeeks(year: number) {
  const start = startOfWeek(`${year}-01-01`);
  const last = `${year}-12-31`;
  const weeks: string[][] = [];
  for (let date = start; date <= last; date = shiftDate(date, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, day) => shiftDate(date, day)));
  }
  return weeks;
}

export function activityLevel(count: number) {
  return count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
}
