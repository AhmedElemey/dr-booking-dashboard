/** Money as the UI shows it: whole pounds, or two decimals when there are piastres. */
export function egp(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Empty string (form input) or NaN to null, otherwise the number. */
export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}
