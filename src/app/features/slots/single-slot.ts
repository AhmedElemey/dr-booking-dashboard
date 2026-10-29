import { DateTime } from 'luxon';

import { CreateSlotRequest } from '../../core/api/models';
import { localToUtcIso, minutesOfDay } from '../../core/time/clinic-time';
import {
  MAX_SLOT_MINUTES,
  MIN_SLOT_MINUTES,
  SLOT_STEP_MINUTES,
  isValidDateKey,
} from './bulk-slots';

export type SingleSlotIssue = 'date' | 'time' | 'length' | 'misaligned' | 'past' | 'nonexistent';

/**
 * Builds the `{startsAt, endsAt}` payload for one slot from clinic-local date and time.
 * Slots must be in the future, 15-minute aligned and 15-240 minutes long.
 */
export function buildSingleSlot(
  date: string,
  time: string,
  minutes: number,
  tz: string,
  now: DateTime,
): { request: CreateSlotRequest } | { issue: SingleSlotIssue } {
  if (!isValidDateKey(date)) return { issue: 'date' };
  const start = minutesOfDay(time);
  if (start === null) return { issue: 'time' };
  if (!Number.isInteger(minutes) || minutes < MIN_SLOT_MINUTES || minutes > MAX_SLOT_MINUTES) {
    return { issue: 'length' };
  }
  if (minutes % SLOT_STEP_MINUTES !== 0 || start % SLOT_STEP_MINUTES !== 0) {
    return { issue: 'misaligned' };
  }
  const startsAt = localToUtcIso(date, time, tz);
  if (!startsAt) return { issue: 'nonexistent' };
  const start$ = DateTime.fromISO(startsAt);
  if (start$ < now) return { issue: 'past' };
  return { request: { startsAt, endsAt: start$.plus({ minutes }).toUTC().toISO()! } };
}
