import { AppLang } from '../api/models';

/** Picks the Arabic or English variant of a bilingual field, falling back to the other one. */
export function localized(
  lang: AppLang,
  ar: string | null | undefined,
  en: string | null | undefined,
): string {
  return (lang === 'ar' ? ar || en : en || ar) ?? '';
}
