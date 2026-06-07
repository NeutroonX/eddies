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
