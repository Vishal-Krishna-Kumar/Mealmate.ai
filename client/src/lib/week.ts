import type { DayName } from '@/types';

export const DAYS_OF_WEEK: DayName[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Returns the Monday at 00:00 UTC for the week containing `date`.
 * Server uses Monday-first weeks and stores weekStartDate as a Date.
 */
export function startOfWeekMondayUTC(date: Date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay(); // 0 = Sun ... 6 = Sat
  const diff = (dow + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** ISO date `YYYY-MM-DD` (no time component) — what the server expects. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "Apr 26 – May 2, 2026" */
export function formatWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const year = end.getUTCFullYear();
  return `${fmt(weekStart)} – ${fmt(end)}, ${year}`;
}

export function isSameWeek(a: Date, b: Date): boolean {
  return startOfWeekMondayUTC(a).getTime() === startOfWeekMondayUTC(b).getTime();
}
