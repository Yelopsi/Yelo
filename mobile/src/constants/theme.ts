/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const YeloColors = {
  verdeEscuro: '#1B4332',
  verdeMedio: '#2D6A4F',
  verdeClaro: '#52B788',
  verdeNeon: '#74C69D',
  verdeSuave: '#D8F3DC',
  verdeSucesso: '#28a745',
  amarelo: '#FFEE8C',
  amareloOuro: '#FFB703',
  creme: '#FDFBF7',
  offwhite: '#FDFAF6',
  coral: '#E63946',
  cinzaFundo: '#F8F9FA',
  cinzaBorda: '#E5E7EB',
  cinzaTexto: '#555555',
  cinzaClaro: '#ADB5BD',
  branco: '#FFFFFF',
} as const;

export const Colors = {
  light: {
    text: '#1B4332',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    primary: YeloColors.verdeEscuro,
    accent: YeloColors.amarelo,
  },
  dark: {
    text: '#ffffff',
    background: '#1B4332',
    backgroundElement: '#2D6A4F',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    primary: YeloColors.verdeNeon,
    accent: YeloColors.amarelo,
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
