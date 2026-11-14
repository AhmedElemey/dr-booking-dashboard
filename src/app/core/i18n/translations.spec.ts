import ar from '../../../../public/i18n/ar.json';
import en from '../../../../public/i18n/en.json';
import { flatten } from '../../../testing/test-providers';

describe('translation files', () => {
  it('have exactly the same keys in Arabic and English', () => {
    const arKeys = flatten(ar).sort();
    const enKeys = flatten(en).sort();
    expect(arKeys).toEqual(enKeys);
  });

  it('have no empty strings', () => {
    const empty = (obj: object): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === 'object' ? empty(v).map((p) => `${k}.${p}`) : v === '' ? [k] : [],
      );
    expect(empty(ar)).toEqual([]);
    expect(empty(en)).toEqual([]);
  });

  it('use the same interpolation placeholders in both languages', () => {
    const placeholders = (s: string) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();
    const arFlat = Object.fromEntries(flatten(ar).map((k) => [k, k]));
    const get = (obj: object, path: string) =>
      path.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], obj) as string;
    for (const key of Object.keys(arFlat)) {
      expect(placeholders(get(ar, key)), key).toEqual(placeholders(get(en, key)));
    }
  });
});
