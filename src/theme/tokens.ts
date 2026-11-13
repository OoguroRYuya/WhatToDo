/* Hallmark · shape: app screen · genre: modern-minimal · theme: Dose (deal 1/3, seed offline-first-to-do-notes-mobile-9532·cf49ffab·2026-11-13·r0)
 * nav: bottom tab bar (Today, Account) with a stacked editor sheet · signature: the sync stamp, a pharmacy-label stamp that says when this phone last reached the cloud · states: loading, empty, error, full, locked, offline · dose: white, night in dark mode
 * axes: light/grotesk-sans/chromatic-green · posture: committed · contrast: pass · v2.0.0 */
/* Hallmark · pre-emit critique: P4 H3 E4 S4 R3 V4 · weakest: H (React Native has no CSS, so the theme's plastic grain and window light are cut; the material survives as tinted trays, mono labels and the stamp) */
/* waive 26a: React Native has no :focus-visible; Button and Checkbox draw a 2px --focus ring from onFocus (keyboard, D-pad), every Pressable carries an accessibilityRole and label */
/* waive 26b: React Native has no :active or :disabled; pressed is the Pressable render prop (the moulded button sinks 2px), disabled is opacity 0.55 plus accessibilityState */
/* waive 48: React Native has no :root; every colour and font goes through this file, and no component holds a literal colour or fontFamily */

import { Platform } from 'react-native';

/** Dose tokens, converted from OKLCH to sRGB hex (React Native cannot read OKLCH). */
const light = {
  paper: '#FAF7EF',
  paper2: '#E9F8EF',
  paper3: '#D4F0E0',
  surface: '#FFFFFF',
  ink: '#0C1C16',
  ink2: '#26342F',
  muted: '#54655D',
  rule: '#CBD6C9',
  accent: '#007948',
  accentDeep: '#005F3A',
  accentSoft: '#A9E8C6',
  accentInk: '#F8FDFA',
  focus: '#006B38',
  /** Plastic tints: surfaces only, never a signal. */
  trayMint: '#A8E2C2',
  trayBlue: '#B1DDE6',
  trayStraw: '#EEE4B4',
  scrim: 'rgba(12, 28, 22, 0.42)',
} as const;

export type Palette = { [K in keyof typeof light]: string };

/** Dose "night" ground. */
const night: Palette = {
  paper: '#040807',
  paper2: '#0B1411',
  paper3: '#14201B',
  surface: '#111815',
  ink: '#ECF4EF',
  ink2: '#CBD3CE',
  muted: '#94A39B',
  rule: '#2A3631',
  accent: '#4CBD88',
  accentDeep: '#36A275',
  accentSoft: '#16412D',
  accentInk: '#04140C',
  focus: '#4CBD88',
  trayMint: '#173426',
  trayBlue: '#16303A',
  trayStraw: '#302C17',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export const palettes = { light, night };

/** Families. Loaded in src/app/_layout.tsx. Three roles: display, body, outlier (times and labels). */
export const fonts = {
  display: 'SchibstedGrotesk_700Bold',
  body: 'InstrumentSans_400Regular',
  bodyMedium: 'InstrumentSans_500Medium',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

/** App-scope type scale, ratio 1.2, base 16. */
export const text = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 19,
  xl: 23,
  display: 28,
} as const;

export const space = {
  '3xs': 2,
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 40,
  '2xl': 64,
} as const;

export const radius = {
  input: 10,
  card: 14,
  pill: 999,
} as const;

export const duration = {
  micro: 120,
  short: 220,
} as const;

/** Controls: 48px on a phone (coarse pointer), 44px minimum hit target. */
export const control = {
  height: 48,
  hit: 44,
} as const;

/** The display tracking, -0.03em at a given size. */
export const tracking = (size: number) => -0.03 * size;

export function lift(p: Palette) {
  return Platform.select({
    ios: {
      shadowColor: p.ink,
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
    },
    default: { elevation: 3 },
  });
}
