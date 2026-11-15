import { BRAND } from './brand.generated';

export { BRAND };

export type FeatureKey = keyof typeof BRAND.features;

export const FEATURE_KEYS = Object.keys(BRAND.features) as FeatureKey[];

/** The 13 phase 2 switches (docs/FEATURES-PHASE2.md section 0); all off in the template config. */
export const PHASE2_FEATURE_KEYS = [
  'videoConsultation',
  'waitingList',
  'familyAccounts',
  'whatsappReminders',
  'onlinePayments',
  'insurance',
  'holidayCalendar',
  'workingHoursTemplates',
  'patientRecords',
  'reviews',
  'promotions',
  'recallCampaigns',
  'reports',
] as const satisfies readonly FeatureKey[];

export type FeatureFlags = Record<FeatureKey, boolean>;

/** Replaces the `{{brand}}` token in translation values with the clinic name for that language. */
export function applyBrand<T>(translations: T, lang: 'ar' | 'en'): T {
  const name = BRAND.name[lang];
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return node.replaceAll('{{brand}}', name);
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    }
    return node;
  };
  return walk(translations) as T;
}
