import { niceAxis } from '../shared/charts';
import { ratePercent } from './reports/reports';
import { TemplateRule } from '../core/api/phase2.models';
import { summarizeRules, validateRules } from './working-hours/rules';

const rule = (dayOfWeek: string, start: string, end: string) =>
  ({ dayOfWeek, start, end }) as TemplateRule;

describe('niceAxis', () => {
  it.each([
    [0, 1, 4],
    [25, 5, 5],
    [31, 10, 4],
    [100, 20, 5],
    [7, 2, 4],
  ])('max %d gets step %d and %d intervals', (max, step, intervals) => {
    const axis = niceAxis(max);
    expect(axis.step).toBe(step);
    expect(axis.intervals).toBe(intervals);
    expect(axis.end).toBeGreaterThanOrEqual(max);
    expect(axis.intervals).toBeLessThanOrEqual(5);
  });
});

describe('ratePercent', () => {
  it('treats small values as fractions and large ones as percentages', () => {
    expect(ratePercent(0.12)).toBeCloseTo(12);
    expect(ratePercent(12)).toBe(12);
    expect(ratePercent(1)).toBe(100);
    expect(ratePercent(0)).toBe(0);
  });
});

describe('working hours rules', () => {
  it('requires at least one rule', () => {
    expect(validateRules([], 30)).toEqual(['none']);
  });

  it('flags end before start, overlaps and ranges shorter than a slot', () => {
    expect(validateRules([rule('Monday', '10:00', '09:00')], 30)).toContain('times');
    expect(
      validateRules([rule('Monday', '09:00', '12:00'), rule('Monday', '11:00', '13:00')], 30),
    ).toContain('overlap');
    expect(validateRules([rule('Monday', '09:00', '09:20')], 30)).toContain('tooShort');
  });

  it('accepts a split day and the same hours on another day', () => {
    expect(
      validateRules(
        [
          rule('Monday', '09:00', '12:00'),
          rule('Monday', '14:00', '18:00'),
          rule('Tuesday', '09:00', '12:00'),
        ],
        30,
      ),
    ).toEqual([]);
  });

  it('groups days that share hours', () => {
    const summary = summarizeRules(
      [
        rule('Sunday', '09:00', '14:00'),
        rule('Monday', '09:00', '14:00'),
        rule('Tuesday', '16:00', '20:00'),
      ],
      (key) => key,
    );
    expect(summary).toHaveLength(2);
    expect(summary[0].hours).toBe('09:00-14:00');
    expect(summary[0].days.split('،')).toHaveLength(2);
  });
});
