export interface ClinicConfig {
  slug: string;
  name: { ar: string; en: string };
  tagline: { ar: string; en: string };
  colors: { primary: string; accent: string };
  logo: string;
  supportPhone?: string;
  features: Record<string, boolean>;
  [key: string]: unknown;
}
export function validate(schema: object, value: unknown, root?: object, path?: string): string[];
export function hueChroma(hex: string): { hue: number; chroma: number };
export function toneColor(hue: number, chroma: number, tone: number): string;
export const TONES: number[];
export function tonalPalette(hue: number, chroma: number): Record<number, string>;
export function paletteFor(seedHex: string): Record<string, unknown>;
export function renderScss(config: ClinicConfig): string;
export function renderTs(config: ClinicConfig): string;
export const HTML_START: string;
export const HTML_END: string;
export function renderIndexHtml(html: string, config: ClinicConfig): string;
