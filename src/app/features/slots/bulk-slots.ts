import { BulkSlotsRequest } from '../../core/api/models';
import {
  DATE_KEY,
  dateRange,
  dayOfWeekNumber,
  diffDays,
  minutesOfDay,
} from '../../core/time/clinic-time';
import { DateTime } from 'luxon';

export const MAX_RANGE_DAYS = 92;
export const MAX_SLOTS_PER_CALL = 2000;
export const MIN_SLOT_MINUTES = 15;
export const MAX_SLOT_MINUTES = 240;
export const SLOT_STEP_MINUTES = 15;

/** Weekdays in display order (Egypt's week starts on Saturday) with .NET `DayOfWeek` numbers. */
export const WEEKDAYS = [
  { value: 6, key: 'sat' },
  { value: 0, key: 'sun' },
  { value: 1, key: 'mon' },
  { value: 2, key: 'tue' },
  { value: 3, key: 'wed' },
  { value: 4, key: 'thu' },
  { value: 5, key: 'fri' },
] as const;

export interface BulkFormValue {
  fromDate: string;
  toDate: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

/** Validation problems; each maps to a translation key `bulk.error.<issue>`. */
export type BulkIssue =
  | 'dates'
  | 'rangeTooLong'
  | 'noDays'
  | 'times'
  | 'slotLength'
  | 'misaligned'
  | 'noSlotFits'
  | 'tooMany'
  | 'allPast';

export function isValidDateKey(key: string): boolean {
  return DateTime.fromFormat(key, DATE_KEY).isValid;
}

/** Number of slots one day yields: step from `startTime` while the slot end stays within `endTime`. */
export function slotsPerDay(startTime: string, endTime: string, slotMinutes: number): number {
  const start = minutesOfDay(startTime);
  const end = minutesOfDay(endTime);
  if (start === null || end === null || end <= start || !(slotMinutes > 0)) return 0;
  return Math.floor((end - start) / slotMinutes);
}

/** Dates in the range whose weekday is selected. */
export function matchingDates(value: BulkFormValue): string[] {
  if (!isValidDateKey(value.fromDate) || !isValidDateKey(value.toDate)) return [];
  return dateRange(value.fromDate, value.toDate).filter((d) =>
    value.daysOfWeek.includes(dayOfWeekNumber(d)),
  );
}

/**
 * Upper bound of slots the call would create. The server skips past and overlapping slots,
 * so the real `created` count can be lower; it is reported after saving.
 */
export function estimateBulk(value: BulkFormValue): { days: number; slots: number } {
  const days = matchingDates(value).length;
  return {
    days,
    slots: days * slotsPerDay(value.startTime, value.endTime, value.slotMinutes),
  };
}

/** Client-side validation mirroring the server rules (spec section 3, bulk helper). */
export function validateBulk(value: BulkFormValue, today: string): BulkIssue[] {
  const issues: BulkIssue[] = [];

  const datesOk =
    isValidDateKey(value.fromDate) &&
    isValidDateKey(value.toDate) &&
    value.toDate >= value.fromDate;
  if (!datesOk) issues.push('dates');
  else {
    if (diffDays(value.fromDate, value.toDate) + 1 > MAX_RANGE_DAYS) issues.push('rangeTooLong');
    if (value.toDate < today) issues.push('allPast');
  }

  if (value.daysOfWeek.length === 0) issues.push('noDays');

  const start = minutesOfDay(value.startTime);
  const end = minutesOfDay(value.endTime);
  const timesOk = start !== null && end !== null && end > start;
  if (!timesOk) issues.push('times');

  const length = Number(value.slotMinutes);
  const lengthOk =
    Number.isInteger(length) && length >= MIN_SLOT_MINUTES && length <= MAX_SLOT_MINUTES;
  if (!lengthOk) issues.push('slotLength');
  else if (
    length % SLOT_STEP_MINUTES !== 0 ||
    (start !== null && start % SLOT_STEP_MINUTES !== 0)
  ) {
    issues.push('misaligned');
  }

  if (datesOk && timesOk && lengthOk && !issues.includes('noDays')) {
    const { slots } = estimateBulk(value);
    if (slotsPerDay(value.startTime, value.endTime, length) === 0) issues.push('noSlotFits');
    else if (slots > MAX_SLOTS_PER_CALL) issues.push('tooMany');
  }

  return issues;
}

export function validateRemoveRange(fromDate: string, toDate: string): boolean {
  return isValidDateKey(fromDate) && isValidDateKey(toDate) && toDate >= fromDate;
}

export function toBulkRequest(value: BulkFormValue): BulkSlotsRequest {
  return {
    fromDate: value.fromDate,
    toDate: value.toDate,
    daysOfWeek: [...value.daysOfWeek].sort((a, b) => a - b),
    startTime: value.startTime,
    endTime: value.endTime,
    slotMinutes: Number(value.slotMinutes),
  };
}

/** Rounds a service duration up to the 15-minute slot grid, within the allowed length. */
export function slotLengthForService(durationMinutes: number): number {
  const rounded = Math.ceil(durationMinutes / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
  return Math.min(MAX_SLOT_MINUTES, Math.max(MIN_SLOT_MINUTES, rounded));
}
