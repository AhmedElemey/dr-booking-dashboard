import { DateTime } from 'luxon';

/** Pure date helpers. Every instant is rendered in the clinic's IANA timezone, never the browser's. */

export const DEFAULT_CLINIC_TZ = 'Africa/Cairo';
export const DATE_KEY = 'yyyy-MM-dd';

export type Lang = 'ar' | 'en';

/**
 * Digits are Western (Latin) in both languages: it matches phone numbers, money and receipts.
 * Luxon's Arabic output still uses the Latin comma in patterns such as `cccc, d LLLL`.
 */
const NUMBERING = 'latn';

const localizeComma = (text: string, lang: Lang): string =>
  lang === 'ar' ? text.replace(/,/g, '،') : text;

/** Parses an API instant (ISO 8601, `Z` or offset) into the clinic zone. */
export function inClinic(iso: string, tz: string, lang: Lang = 'en'): DateTime {
  return DateTime.fromISO(iso, {
    zone: tz,
    locale: lang,
    numberingSystem: NUMBERING,
  });
}

/** 24-hour wall-clock time in the clinic zone, e.g. `09:30`. */
export function formatTime(iso: string, tz: string, lang: Lang = 'en'): string {
  return inClinic(iso, tz, lang).toFormat('HH:mm');
}

/** Short date, e.g. `Mon, 2 Nov` / `الإثنين 2 نوفمبر`. */
export function formatDate(iso: string, tz: string, lang: Lang = 'en'): string {
  return inClinic(iso, tz, lang).toFormat('ccc d LLL');
}

export function formatDateLong(iso: string, tz: string, lang: Lang = 'en'): string {
  return localizeComma(inClinic(iso, tz, lang).toFormat('cccc, d LLLL yyyy'), lang);
}

export function formatRange(
  startIso: string,
  endIso: string,
  tz: string,
  lang: Lang = 'en',
): string {
  return `${formatTime(startIso, tz, lang)} - ${formatTime(endIso, tz, lang)}`;
}

/** Clinic-local calendar date (`yyyy-MM-dd`) of an instant. */
export function dateKeyOf(iso: string, tz: string): string {
  return DateTime.fromISO(iso, { zone: tz, locale: 'en', numberingSystem: 'latn' }).toFormat(
    DATE_KEY,
  );
}

export function todayKey(tz: string, now: DateTime = DateTime.now()): string {
  return now
    .setZone(tz)
    .setLocale('en')
    .reconfigure({ numberingSystem: 'latn' })
    .toFormat(DATE_KEY);
}

export function formatDateKey(key: string, pattern: string, lang: Lang = 'en'): string {
  return localizeComma(
    DateTime.fromISO(key, { locale: lang, numberingSystem: NUMBERING }).toFormat(pattern),
    lang,
  );
}

/** Locale-independent parse of a `yyyy-MM-dd` key (always Latin digits). */
function keyDate(key: string): DateTime {
  return DateTime.fromISO(key, { locale: 'en', numberingSystem: 'latn' });
}

export function addDays(key: string, days: number): string {
  return keyDate(key).plus({ days }).toFormat(DATE_KEY);
}

export function diffDays(fromKey: string, toKey: string): number {
  return Math.round(keyDate(toKey).diff(keyDate(fromKey), 'days').days);
}

/** Inclusive list of date keys. */
export function dateRange(fromKey: string, toKey: string): string[] {
  const count = diffDays(fromKey, toKey);
  return count < 0 ? [] : Array.from({ length: count + 1 }, (_, i) => addDays(fromKey, i));
}

/** Egypt's week starts on Saturday. */
export function startOfWeek(key: string): string {
  const weekday = keyDate(key).weekday; // 1 = Monday ... 7 = Sunday
  return addDays(key, -((weekday - 6 + 7) % 7));
}

/** .NET `DayOfWeek` number for a date key: 0 = Sunday ... 6 = Saturday. */
export function dayOfWeekNumber(key: string): number {
  return keyDate(key).weekday % 7;
}

/**
 * Converts a clinic-local wall-clock date and time to a UTC ISO instant.
 * Returns `null` for invalid input or a local time that does not exist (DST gap).
 */
export function localToUtcIso(dateKey: string, time: string, tz: string): string | null {
  const local = DateTime.fromISO(`${dateKey}T${time}`, { zone: tz });
  if (!local.isValid) return null;
  // Luxon shifts a non-existent time forward; detect that by round-tripping the wall clock.
  if (local.toFormat('HH:mm') !== time.slice(0, 5)) return null;
  return local.toUTC().toISO();
}

/** Minutes since midnight for `HH:mm`, or `null` when malformed. */
export function minutesOfDay(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
