/**
 * Garment swatch hexes for the canonical color vocabulary (CanonicalColorSchema
 * in shared/types). These are data (what the clothes look like), not UI tokens —
 * the six base values match the onboarding swatches from design 1b.
 */
import type { CanonicalColor } from '@shared/types';

export const CANONICAL_COLOR_HEX: Record<CanonicalColor, string> = {
  black: '#1c1b19',
  white: '#f7f5f0',
  cream: '#efe8d8',
  beige: '#e6dfd0',
  tan: '#c9a97e',
  brown: '#6b4a30',
  grey: '#9a968e',
  silver: '#c4c4c6',
  gold: '#c8a24b',
  navy: '#26324a',
  blue: '#3e5f8a',
  'light-blue': '#a9c3d9',
  red: '#a63c32',
  burgundy: '#6e2b33',
  pink: '#d9a8ac',
  purple: '#6e5580',
  green: '#4a6741',
  olive: '#565633',
  yellow: '#d9b23c',
  orange: '#c97a3c',
  multicolor: '#c9a97e', // never shown as a dot — filtered out below
};

/** Swatch subset offered in Preferences/onboarding "favorite colors". */
export const FAVORITE_COLOR_OPTIONS: CanonicalColor[] = [
  'black', 'white', 'beige', 'grey', 'navy', 'brown',
  'olive', 'blue', 'red', 'pink', 'green', 'burgundy',
];

/** Light swatches that need a dark check mark / hairline border. */
export const LIGHT_COLORS: CanonicalColor[] = ['white', 'cream', 'beige', 'light-blue', 'pink'];

/**
 * Distinct canonical colors from a raw item-color list, capped for the small
 * dot row on collection cards. Non-canonical values and multicolor are dropped.
 */
export function canonicalColorDots(colors: string[], max = 4): CanonicalColor[] {
  const seen = new Set<string>();
  const dots: CanonicalColor[] = [];
  for (const color of colors) {
    if (color === 'multicolor' || seen.has(color)) continue;
    if (!(color in CANONICAL_COLOR_HEX)) continue;
    seen.add(color);
    dots.push(color as CanonicalColor);
    if (dots.length >= max) break;
  }
  return dots;
}
