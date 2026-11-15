import { DayName } from '../../core/api/models';
import { SLOT_LENGTHS, validateRules } from './rules';

const rule = (start: string, end: string, dayOfWeek: DayName = 'Sunday') => ({
  dayOfWeek,
  start,
  end,
});

describe('working-hours rules', () => {
  it('offers only multiples of 15 minutes', () => {
    expect(SLOT_LENGTHS).toEqual([15, 30, 45, 60, 90, 120]);
    expect(SLOT_LENGTHS).not.toContain(20);
  });

  it('accepts times on the 15-minute grid', () => {
    expect(validateRules([rule('09:00', '14:15')], 45)).toEqual([]);
  });

  it('flags a start or end off the grid', () => {
    expect(validateRules([rule('09:10', '14:00')], 30)).toContain('grid');
    expect(validateRules([rule('09:00', '14:05')], 30)).toContain('grid');
  });

  it('flags a slot length off the grid', () => {
    expect(validateRules([rule('09:00', '14:00')], 20)).toContain('grid');
    expect(validateRules([rule('09:00', '14:00')], 0)).toContain('grid');
  });
});
