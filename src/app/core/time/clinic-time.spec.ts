import {
  addDays,
  dateKeyOf,
  dateRange,
  dayOfWeekNumber,
  formatDate,
  formatDateKey,
  formatDateLong,
  formatRange,
  formatTime,
  localToUtcIso,
  minutesOfDay,
  startOfWeek,
  todayKey,
} from './clinic-time';
import { DateTime } from 'luxon';

const CAIRO = 'Africa/Cairo';

describe('clinic time', () => {
  it('shows winter instants at UTC+2 in the clinic zone, whatever the device zone is', () => {
    expect(formatTime('2026-12-01T07:00:00Z', CAIRO)).toBe('09:00');
  });

  it('shows summer instants at UTC+3 (Egypt DST)', () => {
    expect(formatTime('2026-07-01T06:00:00Z', CAIRO)).toBe('09:00');
  });

  it('formats a range with both ends in the clinic zone', () => {
    expect(formatRange('2026-11-02T07:00:00Z', '2026-11-02T07:30:00Z', CAIRO)).toBe(
      '09:00 - 09:30',
    );
  });

  it('assigns late-evening UTC instants to the next clinic-local day', () => {
    expect(dateKeyOf('2026-11-02T22:30:00Z', CAIRO)).toBe('2026-11-03');
  });

  it('localizes weekday names but keeps Latin digits in both languages', () => {
    expect(formatDate('2026-11-02T07:00:00Z', CAIRO, 'en')).toBe('Mon 2 Nov');
    const ar = formatDate('2026-11-02T07:00:00Z', CAIRO, 'ar');
    expect(ar).toContain('2');
    expect(ar).not.toMatch(/[٠-٩]/);
  });

  it('uses the Arabic comma in Arabic long dates', () => {
    expect(formatDateKey('2026-11-17', 'cccc, d LLLL', 'ar')).toContain('،');
    expect(formatDateKey('2026-11-17', 'cccc, d LLLL', 'ar')).not.toContain(',');
    expect(formatDateKey('2026-11-17', 'cccc, d LLLL', 'en')).toContain(',');
    expect(formatDateLong('2026-11-17T07:00:00Z', CAIRO, 'ar')).not.toContain(',');
  });

  it('uses Latin digits for times in both languages', () => {
    expect(formatTime('2026-12-01T07:00:00Z', CAIRO, 'ar')).toBe('09:00');
    expect(formatTime('2026-12-01T07:00:00Z', CAIRO, 'en')).toBe('09:00');
  });

  it('keeps machine date keys Latin whatever the UI language', () => {
    expect(dateKeyOf('2026-12-01T07:00:00Z', CAIRO)).toBe('2026-12-01');
    expect(addDays('2026-12-01', 1)).toBe('2026-12-02');
  });

  it('computes today in the clinic zone, not UTC', () => {
    const justAfterMidnightCairo = DateTime.fromISO('2026-11-02T22:30:00Z');
    expect(todayKey(CAIRO, justAfterMidnightCairo)).toBe('2026-11-03');
  });

  describe('localToUtcIso', () => {
    it('converts clinic wall-clock time to UTC using the zone rules', () => {
      expect(localToUtcIso('2026-12-01', '09:00', CAIRO)).toBe('2026-12-01T07:00:00.000Z');
      expect(localToUtcIso('2026-07-01', '09:00', CAIRO)).toBe('2026-07-01T06:00:00.000Z');
    });

    it('returns null for a local time that does not exist (DST gap)', () => {
      // Egypt springs forward at 00:00 on the last Friday of April.
      expect(localToUtcIso('2026-04-24', '00:30', CAIRO)).toBeNull();
    });

    it('returns null for invalid input', () => {
      expect(localToUtcIso('not-a-date', '09:00', CAIRO)).toBeNull();
    });
  });

  describe('week helpers', () => {
    it('starts the week on Saturday', () => {
      expect(startOfWeek('2026-11-02')).toBe('2026-10-31'); // Monday -> previous Saturday
      expect(startOfWeek('2026-10-31')).toBe('2026-10-31'); // Saturday stays
      expect(startOfWeek('2026-11-06')).toBe('2026-10-31'); // Friday
    });

    it('maps dates to .NET day-of-week numbers', () => {
      expect(dayOfWeekNumber('2026-11-01')).toBe(0); // Sunday
      expect(dayOfWeekNumber('2026-11-02')).toBe(1); // Monday
      expect(dayOfWeekNumber('2026-10-31')).toBe(6); // Saturday
    });

    it('builds inclusive ranges and shifts days across month ends', () => {
      expect(dateRange('2026-10-30', '2026-11-01')).toEqual([
        '2026-10-30',
        '2026-10-31',
        '2026-11-01',
      ]);
      expect(dateRange('2026-11-02', '2026-11-01')).toEqual([]);
      expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    });
  });

  it('parses HH:mm strictly', () => {
    expect(minutesOfDay('09:30')).toBe(570);
    expect(minutesOfDay('24:00')).toBeNull();
    expect(minutesOfDay('9:30')).toBeNull();
  });
});
