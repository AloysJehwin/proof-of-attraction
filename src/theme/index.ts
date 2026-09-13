export const colors = {
  bg: '#0A0A0B',
  surface: '#141416',
  surfaceAlt: '#1C1C1F',
  border: '#2A2A2E',
  text: '#F5F5F7',
  textMuted: '#9A9AA0',
  textFaint: '#5A5A60',
  accent: '#FF4D6D',
  accentMuted: '#3A1620',
  success: '#39D98A',
  warning: '#F5C451',
  danger: '#FF5C5C',
  agent: '#6C8CFF',
} as const;

export const tierColors = {
  unverified: colors.textFaint,
  selfie: colors.success,
  orb: colors.accent,
} as const;

export const brand = {
  gradientFrom: colors.accent,
  gradientTo: colors.agent,
  sparkCore: '#FFFFFF',
  sparkMid: '#FF9DB0',
  sparkEdge: colors.accent,
  ink: colors.bg,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const font = {
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 40,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;
