import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { palettes, type Palette } from './tokens';

export function useTheme(): { p: Palette; dark: boolean } {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return useMemo(() => ({ p: dark ? palettes.night : palettes.light, dark }), [dark]);
}

/** Builds a StyleSheet-ready object from the current palette, memoised per palette. */
export function useStyles<T>(factory: (p: Palette) => T): T {
  const { p } = useTheme();
  return useMemo(() => factory(p), [p, factory]);
}
