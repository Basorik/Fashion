/**
 * Bella's colors, type and spacing. Warm neutrals with one rosewood accent,
 * used for primary actions and the active tab. Every color has a light and dark value.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1917',
    textSecondary: '#6F6862',
    background: '#FBF9F7',
    backgroundElement: '#F1EDE8',
    backgroundSelected: '#E5DFD8',
    border: '#E5DFD8',
    accent: '#9E4636',
    onAccent: '#FFFFFF',
    danger: '#B42318',
  },
  dark: {
    text: '#F5F2EE',
    textSecondary: '#A8A29E',
    background: '#0F0E0D',
    backgroundElement: '#1F1D1B',
    backgroundSelected: '#2E2B28',
    border: '#2E2B28',
    accent: '#E3907B',
    onAccent: '#1C1917',
    danger: '#F97066',
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

export const Radius = {
  small: 8,
  medium: 12,
  large: 16,
  pill: 999,
} as const;

export const MaxContentWidth = 800;
