import { DateTime } from 'luxon';

import { buildSingleSlot } from './single-slot';

const CAIRO = 'Africa/Cairo';
const now = DateTime.fromISO('2026-11-02T10:00:00', { zone: CAIRO });

describe('buildSingleSlot', () => {
  it('converts clinic-local date and time to UTC instants', () => {
    expect(buildSingleSlot('2026-11-03', '09:00', 30, CAIRO, now)).toEqual({
      request: { startsAt: '2026-11-03T07:00:00.000Z', endsAt: '2026-11-03T07:30:00.000Z' },
    });
  });

  it('rejects slots in the past', () => {
    expect(buildSingleSlot('2026-11-02', '09:00', 30, CAIRO, now)).toEqual({ issue: 'past' });
  });

  it('rejects misaligned start times and lengths', () => {
    expect(buildSingleSlot('2026-11-03', '09:10', 30, CAIRO, now)).toEqual({ issue: 'misaligned' });
    expect(buildSingleSlot('2026-11-03', '09:00', 20, CAIRO, now)).toEqual({ issue: 'misaligned' });
  });

  it('rejects out-of-range lengths and bad input', () => {
    expect(buildSingleSlot('2026-11-03', '09:00', 5, CAIRO, now)).toEqual({ issue: 'length' });
    expect(buildSingleSlot('2026-11-03', '09:00', 300, CAIRO, now)).toEqual({ issue: 'length' });
    expect(buildSingleSlot('', '09:00', 30, CAIRO, now)).toEqual({ issue: 'date' });
    expect(buildSingleSlot('2026-11-03', '', 30, CAIRO, now)).toEqual({ issue: 'time' });
  });

  it('rejects a local time skipped by the DST change', () => {
    const early = DateTime.fromISO('2026-04-20T10:00:00', { zone: CAIRO });
    expect(buildSingleSlot('2026-04-24', '00:30', 30, CAIRO, early)).toEqual({
      issue: 'nonexistent',
    });
    expect(buildSingleSlot('2026-04-24', '01:00', 30, CAIRO, early)).toHaveProperty('request');
  });
});
