/**
 * NECL Mobile Application — Centralized Design System & Tokens
 * Enterprise Logistics & Transport Suite
 */

export const colors = {
  // Brand
  primaryOrange: '#F4510B',
  primaryOrangeHover: '#D94308',
  brandTextAccessible: '#C2410C',
  brandNavy: '#111827',
  deepNavy: '#111827',

  // Gold / Accent -> Unified with Brand Orange
  accentGold: '#F4510B',
  accentGoldSoft: 'rgba(244, 81, 11, 0.08)',
  accentGoldBorder: 'rgba(244, 81, 11, 0.22)',
  accentGoldLight: '#FFF3EC',

  // Surfaces & Backgrounds
  canvasDark: '#F7F8FA',
  surfaceCard: '#FFFFFF',
  surfaceCardElevated: '#FFFFFF',
  surfaceCardInput: '#FFFFFF',
  surfaceLight: '#FFFFFF',
  canvasLight: '#F7F8FA',

  // Borders
  borderDarkSubtle: '#E5EAF1',
  borderDarkStrong: '#D9E1EC',
  borderLight: '#E5EAF1',

  // Typography
  textPrimary: '#111827',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textSubtle: '#94A3B8',
  textDarkPrimary: '#111827',
  textDarkSecondary: '#475569',

  // Semantic States (WCAG 2.1 AA Compliant on Light Surfaces)
  success: '#10B981',
  successBg: '#ECFDF5',
  successText: '#065F46',

  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  warningText: '#92400E',

  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  dangerText: '#991B1B',

  info: '#3B82F6',
  infoBg: '#EFF6FF',
  infoText: '#1E40AF',
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
