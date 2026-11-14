import { AbstractControl, ValidationErrors } from '@angular/forms';

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Normalizes an Egyptian mobile number to E.164 (`01012345678` -> `+201012345678`).
 * Returns `null` when the input is not a valid Egyptian mobile (prefixes 10, 11, 12, 15).
 */
export function normalizeEgyptPhone(input: string): string | null {
  const ascii = input.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC_DIGITS.indexOf(d)));
  let digits = ascii.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith('20')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  return /^1[0125]\d{8}$/.test(digits) ? `+20${digits}` : null;
}

export function egyptPhoneValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  if (!value) return null; // `required` reports the empty case
  return normalizeEgyptPhone(value) ? null : { egyptPhone: true };
}
