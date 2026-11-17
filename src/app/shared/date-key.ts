import { DateTime } from 'luxon';

import { DATE_KEY } from '../core/time/clinic-time';

/** `yyyy-MM-dd` (the API and form contract) to a Luxon date, or `null` when empty or malformed. */
export function keyToDateTime(key: string | null | undefined): DateTime | null {
  if (!key) return null;
  const date = DateTime.fromISO(key, { locale: 'en', numberingSystem: 'latn' });
  return date.isValid ? date : null;
}

/** A date picker value back to a `yyyy-MM-dd` key; an empty or invalid value becomes `''`. */
export function dateTimeToKey(date: unknown): string {
  return DateTime.isDateTime(date) && date.isValid
    ? date.reconfigure({ locale: 'en', numberingSystem: 'latn' }).toFormat(DATE_KEY)
    : '';
}
