import config from '../../../../clinic.config.json';
import schema from '../../../../clinic.config.schema.json';
import ar from '../../../../public/i18n/ar.json';
import en from '../../../../public/i18n/en.json';
import {
  HTML_END,
  HTML_START,
  TONES,
  paletteFor,
  renderIndexHtml,
  renderScss,
  validate,
} from '../../../../scripts/lib/brand-core.mjs';
import { BRAND, applyBrand } from './brand';
import { BRAND as GENERATED } from './brand.generated';

interface Loose {
  slug: unknown;
  logo?: unknown;
  name: Record<string, unknown>;
  colors: Record<string, unknown>;
  features: Record<string, unknown>;
}
const clone = (): Loose => JSON.parse(JSON.stringify(config));

describe('clinic.config.json', () => {
  it('is valid against its schema', () => {
    expect(validate(schema, config)).toEqual([]);
  });

  it.each([
    ['a bad slug', (c: Loose) => (c.slug = 'Moon Light')],
    ['a slug longer than 40 characters', (c: Loose) => (c.slug = 'a'.repeat(41))],
    ['a missing Arabic name', (c: Loose) => delete c.name['ar']],
    ['a non-hex colour', (c: Loose) => (c.colors['primary'] = 'blue')],
    ['a short hex colour', (c: Loose) => (c.colors['accent'] = '#fff')],
    ['a non-boolean feature', (c: Loose) => (c.features['multiBranch'] = 'yes')],
    ['a missing feature', (c: Loose) => delete c.features['website']],
    ['an unknown feature', (c: Loose) => (c.features['teleport'] = true)],
    ['a missing logo', (c: Loose) => delete c.logo],
  ])('rejects %s', (_label, mutate) => {
    const bad = clone();
    mutate(bad);
    expect(validate(schema, bad).length).toBeGreaterThan(0);
  });

  it('has a usable clinic identity', () => {
    expect(config.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(config.name.en.trim()).not.toBe('');
    expect(config.name.ar.trim()).not.toBe('');
    expect(config.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(config.colors.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('brand generation', () => {
  it('has a generated brand module in step with the config', () => {
    expect(GENERATED.name).toEqual(config.name);
    expect(GENERATED.colors).toEqual(config.colors);
    expect(GENERATED.features).toEqual(config.features);
    expect(GENERATED.logo).toBe(`/${config.logo}`);
  });

  it('builds a full tonal palette from a seed colour', () => {
    const palette = paletteFor('#3F3CCF') as Record<string, Record<number, string>> &
      Record<number, string>;
    for (const tone of TONES) expect(palette[tone]).toMatch(/^#[0-9A-F]{6}$/);
    expect(palette[0]).toBe('#000000');
    expect(palette[100]).toBe('#FFFFFF');
    expect(Object.keys(palette['secondary'])).toHaveLength(TONES.length);
    // Lighter tones get lighter.
    expect(palette[90]).not.toBe(palette[10]);
  });

  it('generates every neutral tone Material 3 needs for surface-container tokens', () => {
    const palette = paletteFor('#3F3CCF') as unknown as Record<string, Record<number, string>>;
    const required = [...TONES, 4, 5, 6, 12, 15, 17, 22, 24, 87, 92, 94, 96];
    for (const name of ['neutral', 'neutral-variant']) {
      for (const tone of required) expect(palette[name][tone]).toMatch(/^#[0-9A-F]{6}$/);
    }
    const scss = renderScss(config);
    for (const tone of [4, 6, 12, 17, 22, 24, 87, 92, 94, 96]) {
      expect(scss).toMatch(new RegExp(`\\b${tone}: #[0-9A-F]{6},`));
    }
  });

  it('emits Material palettes and CSS variables', () => {
    const scss = renderScss(config);
    expect(scss).toContain('$primary-palette: (');
    expect(scss).toContain('$accent-palette: (');
    expect(scss).toContain(`--ml-brand-primary: ${config.colors.primary};`);
    expect(scss).toContain(`--ml-brand-accent: ${config.colors.accent};`);
  });

  it('rewrites only the branded block of index.html', () => {
    const html = `<head>\n    ${HTML_START}\n    <title>old</title>\n    ${HTML_END}\n    <base href="/" />\n</head>`;
    const out = renderIndexHtml(html, { ...config, name: { ar: 'ن', en: 'Nile <Smile>' } });
    expect(out).toContain('<title>Nile &lt;Smile&gt; Dashboard</title>');
    expect(out).toContain(`content="${config.colors.primary}"`);
    expect(out).toContain('<base href="/" />');
    expect(renderIndexHtml(out, config)).toContain(`<title>${config.name.en} Dashboard</title>`);
    expect(() => renderIndexHtml('<head></head>', config)).toThrow();
  });
});

describe('clinic name in translations', () => {
  it('uses the {{brand}} placeholder instead of a hard-coded name', () => {
    expect(JSON.stringify(en)).not.toMatch(/moonlight/i);
    expect(JSON.stringify(ar)).not.toContain('مون لايت');
    expect(en.app.name).toBe('{{brand}}');
  });

  it('fills in the configured name per language', () => {
    expect(applyBrand(en, 'en').app.title).toBe(`${BRAND.name.en} Dashboard`);
    expect(applyBrand(ar, 'ar').app.name).toBe(BRAND.name.ar);
    expect(applyBrand(en, 'en').errors.ROLE_NOT_ALLOWED).toContain(BRAND.name.en);
  });
});
