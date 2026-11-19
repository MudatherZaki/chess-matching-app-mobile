import { Platform } from 'react-native';

export const colors = {
  // Neon green — primary actions, "live" states
  primary: '#1FF28A',
  primaryDark: '#17C970',
  primaryLight: 'rgba(31, 242, 138, 0.14)',

  // Electric cyan — secondary accent
  secondary: '#22D3EE',
  secondaryLight: 'rgba(34, 211, 238, 0.14)',

  danger: '#FF4D5E',
  dangerLight: 'rgba(255, 77, 94, 0.15)',

  warning: '#FACC15',
  warningLight: 'rgba(250, 204, 21, 0.14)',

  background: '#0A0E13',
  surface: '#141A21',
  surfaceAlt: '#1B232C',
  surfaceRaised: '#222B35',

  textPrimary: '#F2F5F8',
  textSecondary: '#9AA7B5',
  textTertiary: '#5F6B78',
  // Text drawn on top of the bright accent colors
  textInverse: '#03140A',

  border: '#26303B',
  borderLight: '#1D252E',

  overlay: 'rgba(0, 0, 0, 0.6)',

  // Read ticks, drawn on your own (primary green) chat bubbles
  receiptRead: '#0B57D0',
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
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  full: 999,
};

export const fonts = {
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};

export const typography = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.5 },
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyBold: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  small: { fontSize: 11, fontWeight: '400' as const },
  // Uppercase monospace labels ("READY TO PLAY", "5+0 BLITZ")
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 8,
  }),
};
