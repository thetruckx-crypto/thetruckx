/**
 * NECL Mobile Application — Centralized Design System & Tokens
 * Enterprise Logistics & Transport Suite
 */

export const colors = {
  // Brand
  primaryOrange: '#F05A22',
  primaryOrangeHover: '#E04E17',
  brandNavy: '#172B4D',
  deepNavy: '#0A1931',

  // Gold / Accent -> Replaced with Brand Orange
  accentGold: '#F05A22',
  accentGoldSoft: 'rgba(240, 90, 34, 0.12)',
  accentGoldBorder: 'rgba(240, 90, 34, 0.3)',
  accentGoldLight: '#FFEDD5',

  // Surfaces & Backgrounds
  canvasDark: '#F8FAFC',
  surfaceCard: '#FFFFFF',
  surfaceCardElevated: '#FFFFFF',
  surfaceCardInput: '#FFFFFF',
  surfaceLight: '#FFFFFF',
  canvasLight: '#F8FAFC',

  // Borders
  borderDarkSubtle: '#E2E8F0',
  borderDarkStrong: '#CBD5E1',
  borderLight: '#E2E8F0',

  // Typography
  textPrimary: '#172B4D',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  textDarkPrimary: '#172B4D',
  textDarkSecondary: '#64748B',

  // Semantic States
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.12)',
  successText: '#34D399',

  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  warningText: '#FBBF24',

  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  dangerText: '#F87171',

  info: '#3B82F6',
  infoBg: 'rgba(59, 130, 246, 0.12)',
  infoText: '#60A5FA',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
};

export const typography = {
  sizes: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    display: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
};

export const touchTargets = {
  min: 48,
  comfortable: 54,
  large: 58,
};

export const sunlight = {
  canvas: '#FFFFFF',
  surface: '#F8FAFC',
  card: '#FFFFFF',
  border: '#CBD5E1',
  borderStrong: '#94A3B8',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  accentGreen: '#047857',
  accentOrange: '#C2410C',
  accentNavy: '#0F172A',
  badgeBg: '#E2E8F0',
};

export const theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  touchTargets,
  sunlight,
};

export default theme;
