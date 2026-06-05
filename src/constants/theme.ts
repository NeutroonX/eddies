/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

// ─── Eddies Industrial Design System ─────────────────────────────────────────

export const EddiesColors = {
  ink: '#000000',      // primary background
  surface: '#0B0B0C',  // raised panels
  stock: '#F2F0EB',    // card-stock off-white (vault / ID cards)
  bone: '#FFFFFF',     // primary text, inflow figures
  alert: '#E5484D',    // outflow, over-cap, primary action
  steel: '#8A8F98',    // secondary mono text, hairlines
  // caution = repeating alert/#000 stripe — rendered as <CautionStripe> component, not a flat hex
} as const;

export type EddiesColor = keyof typeof EddiesColors;

// Rajdhani (display/numerals) + Space Mono (data/labels). No third face.
export const EddiesFonts = {
  display: 'Rajdhani_500Medium',
  displaySemiBold: 'Rajdhani_600SemiBold',
  displayBold: 'Rajdhani_700Bold',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
} as const;

export type EddiesFont = keyof typeof EddiesFonts;

export const EddiesSpacing = {
  hairline: 1,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 64,
  chipH: 12,   // horizontal padding for pill chips
  chipV: 6,    // vertical padding for pill chips
  card: 16,    // inset for ID card surfaces
} as const;

export type EddiesSpacingKey = keyof typeof EddiesSpacing;

export const EddiesRadius = {
  none: 0,
  chip: 999,   // fully-rounded pills
  card: 4,     // ID-card corners (sharp, industrial)
  panel: 2,    // surface panels
} as const;
