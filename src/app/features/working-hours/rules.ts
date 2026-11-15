import { DayName } from '../../core/api/models';
import { TemplateRule } from '../../core/api/phase2.models';
import { minutesOfDay } from '../../core/time/clinic-time';

/** Weekdays in display order (Egypt's week starts on Saturday). `key` indexes `days.*`. */
export const WEEKDAY_OPTIONS: { name: DayName; key: string }[] = [
  { name: 'Saturday', key: 'sat' },
  { name: 'Sunday', key: 'sun' },
  { name: 'Monday', key: 'mon' },
  { name: 'Tuesday', key: 'tue' },
  { name: 'Wednesday', key: 'wed' },
  { name: 'Thursday', key: 'thu' },
  { name: 'Friday', key: 'fri' },
];

export const SLOT_LENGTHS = [15, 20, 30, 45, 60, 90, 120];

export type RuleIssue = 'none' | 'times' | 'overlap' | 'tooShort';

/** Problems found in a weekly rule set; `none` means no rule at all. Keys: `workingHours.issues.*`. */
export function validateRules(rules: TemplateRule[], slotMinutes: number): RuleIssue[] {
  const issues = new Set<RuleIssue>();
  if (rules.length === 0) issues.add('none');
  const byDay = new Map<DayName, [number, number][]>();
  for (const rule of rules) {
    const start = minutesOfDay(rule.start);
    const end = minutesOfDay(rule.end);
    if (start === null || end === null || end <= start) {
      issues.add('times');
      continue;
    }
    if (end - start < slotMinutes) issues.add('tooShort');
    byDay.set(rule.dayOfWeek, [...(byDay.get(rule.dayOfWeek) ?? []), [start, end]]);
  }
  for (const ranges of byDay.values()) {
    const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i][0] < sorted[i - 1][1]) issues.add('overlap');
    }
  }
  return [...issues];
}

/** "Sat, Sun 09:00-14:00" style summary lines, grouping days that share the same hours. */
export interface RuleSummary {
  days: string;
  hours: string;
}

export function summarizeRules(
  rules: TemplateRule[],
  dayLabel: (key: string) => string,
): RuleSummary[] {
  const groups = new Map<string, string[]>();
  for (const opt of WEEKDAY_OPTIONS) {
    for (const rule of rules.filter((r) => r.dayOfWeek === opt.name)) {
      const hours = `${rule.start}-${rule.end}`;
      groups.set(hours, [...(groups.get(hours) ?? []), dayLabel(opt.key)]);
    }
  }
  return [...groups.entries()].map(([hours, days]) => ({ days: days.join('، '), hours }));
}
