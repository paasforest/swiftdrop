/**
 * SwiftDrop unified design tokens.
 * Import from screens: import { colors, typography, spacing, radius, shadows } from '../theme/theme';
 */

export const colors = {
  // Primary
  primary: '#1A73E8',
  primaryLight: '#E8F4FF',
  primaryDark: '#1557B0',

  // Accent
  accent: '#FF6B35',
  accentLight: '#FFF0EB',
  accentDark: '#E55A26',

  // Semantic
  success: '#00A86B',
  successLight: '#E6F7F2',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',

  // Neutrals
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E5E7EB',

  // Text
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  textWhite: '#FFFFFF',

  /** Shadows / overlays (RN shadowColor) */
  black: '#000000',

  /** Modal scrims */
  overlayMedium: 'rgba(0,0,0,0.35)',
  overlayDark: 'rgba(0,0,0,0.7)',

  /** Header gradients */
  gradientEnd: '#0D47A1',

  /** Delivery tier selected card */
  tierSelectedBg: '#EBF5FB',
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 22, fontWeight: '700' },
  h3: { fontSize: 18, fontWeight: '600' },
  h4: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  small: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  modal: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
};

/** Resolve AppText color prop: theme key or raw hex */
export function resolveColor(keyOrHex) {
  if (!keyOrHex) return undefined;
  if (typeof keyOrHex === 'string' && keyOrHex.startsWith('#')) return keyOrHex;
  return colors[keyOrHex] ?? keyOrHex;
}
