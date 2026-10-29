import {
  BulkFormValue,
  estimateBulk,
  matchingDates,
  slotLengthForService,
  slotsPerDay,
  toBulkRequest,
  validateBulk,
  validateRemoveRange,
} from './bulk-slots';

const TODAY = '2026-11-02';

// Mon 2 Nov 2026 .. Sun 15 Nov 2026, Sat-Thu selected (Friday off).
const valid: BulkFormValue = {
  fromDate: '2026-11-02',
  toDate: '2026-11-15',
  daysOfWeek: [6, 0, 1, 2, 3, 4],
  startTime: '09:00',
  endTime: '14:00',
  slotMinutes: 30,
};

describe('bulk slots helper', () => {
  describe('estimate', () => {
    it('steps from the start time while the slot end fits in the window', () => {
      expect(slotsPerDay('09:00', '14:00', 30)).toBe(10);
      expect(slotsPerDay('09:00', '10:10', 30)).toBe(2); // 09:00, 09:30; 10:00-10:30 does not fit
      expect(slotsPerDay('09:00', '09:20', 30)).toBe(0);
    });

    it('counts only selected weekdays inside the range', () => {
      const dates = matchingDates(valid);
      expect(dates).toHaveLength(12); // 14 days minus two Fridays
      expect(dates).not.toContain('2026-11-06');
      expect(estimateBulk(valid)).toEqual({ days: 12, slots: 120 });
    });
  });

  describe('validation', () => {
    it('accepts a normal request', () => {
      expect(validateBulk(valid, TODAY)).toEqual([]);
    });

    it('rejects an end date before the start date', () => {
      expect(validateBulk({ ...valid, toDate: '2026-11-01' }, TODAY)).toContain('dates');
    });

    it('rejects missing or malformed dates', () => {
      expect(validateBulk({ ...valid, fromDate: '' }, TODAY)).toContain('dates');
      expect(validateBulk({ ...valid, toDate: '2026-13-40' }, TODAY)).toContain('dates');
    });

    it('allows exactly 92 days and rejects 93', () => {
      expect(
        validateBulk({ ...valid, toDate: '2027-02-01', slotMinutes: 240, endTime: '17:00' }, TODAY),
      ).not.toContain('rangeTooLong');
      expect(validateBulk({ ...valid, toDate: '2027-02-02' }, TODAY)).toContain('rangeTooLong');
    });

    it('rejects a range that is entirely in the past', () => {
      expect(
        validateBulk({ ...valid, fromDate: '2026-10-01', toDate: '2026-10-10' }, TODAY),
      ).toContain('allPast');
    });

    it('requires at least one weekday', () => {
      expect(validateBulk({ ...valid, daysOfWeek: [] }, TODAY)).toContain('noDays');
    });

    it('requires the end time to be after the start time', () => {
      expect(validateBulk({ ...valid, endTime: '09:00' }, TODAY)).toContain('times');
      expect(validateBulk({ ...valid, startTime: '', endTime: '10:00' }, TODAY)).toContain('times');
    });

    it('limits slot length to 15-240 minutes in 15-minute steps', () => {
      expect(validateBulk({ ...valid, slotMinutes: 10 }, TODAY)).toContain('slotLength');
      expect(validateBulk({ ...valid, slotMinutes: 300 }, TODAY)).toContain('slotLength');
      expect(validateBulk({ ...valid, slotMinutes: 20 }, TODAY)).toContain('misaligned');
      expect(validateBulk({ ...valid, slotMinutes: 240, endTime: '14:00' }, TODAY)).toEqual([]);
    });

    it('requires a 15-minute aligned start time', () => {
      expect(validateBulk({ ...valid, startTime: '09:10' }, TODAY)).toContain('misaligned');
    });

    it('rejects a window shorter than one slot', () => {
      expect(validateBulk({ ...valid, startTime: '09:00', endTime: '09:15' }, TODAY)).toContain(
        'noSlotFits',
      );
    });

    it('caps a single call at 2000 slots', () => {
      const big: BulkFormValue = {
        ...valid,
        toDate: '2027-02-01',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startTime: '00:00',
        endTime: '23:45',
        slotMinutes: 15,
      };
      expect(validateBulk(big, TODAY)).toContain('tooMany');
    });
  });

  it('validates the remove range', () => {
    expect(validateRemoveRange('2026-11-02', '2026-11-02')).toBe(true);
    expect(validateRemoveRange('2026-11-03', '2026-11-02')).toBe(false);
    expect(validateRemoveRange('', '2026-11-02')).toBe(false);
  });

  it('builds the API request with sorted weekdays and numeric length', () => {
    expect(toBulkRequest({ ...valid, slotMinutes: '30' as unknown as number })).toEqual({
      fromDate: '2026-11-02',
      toDate: '2026-11-15',
      daysOfWeek: [0, 1, 2, 3, 4, 6],
      startTime: '09:00',
      endTime: '14:00',
      slotMinutes: 30,
    });
  });

  it('rounds a service duration up to the slot grid', () => {
    expect(slotLengthForService(20)).toBe(30);
    expect(slotLengthForService(45)).toBe(45);
    expect(slotLengthForService(10)).toBe(15);
    expect(slotLengthForService(240)).toBe(240);
  });
});
