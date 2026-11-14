import { BRAND } from './brand.generated';

export { BRAND };

export type FeatureKey = keyof typeof BRAND.features;

export const FEATURE_KEYS = Object.keys(BRAND.features) as FeatureKey[];

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
