import { createContext, useContext, useMemo } from 'react';
import type { EventColor } from './types/schedule';

export type ThemeMode = 'light' | 'dark';

export interface EventColorTokens {
  bg: string;
  border: string;
  text: string;
}

export interface Theme {
  mode: ThemeMode;
  bg: string;
  elevated: string;
  secondary: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  destructive: string;
  separator: string;
  hairlineSoft: string;
  shadow: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  radius: { sm: number; md: number; lg: number };
  navHeight: number;
  eventColors: Record<EventColor, EventColorTokens>;
}

const radius = { sm: 10, md: 14, lg: 20 };
const navHeight = 76;

/**
 * Light theme — soft neutrals with muted, grayish-pastel accents.
 */
export const lightTheme: Theme = {
  mode: 'light',
  bg: '#F2F3F5',
  elevated: '#FFFFFF',
  secondary: '#E6E8EC',
  text: '#1D1D1F',
  textSecondary: '#6E6E73',
  textTertiary: '#A1A1A6',
  accent: '#5C6F9E',
  accentSoft: 'rgba(92,111,158,0.12)',
  onAccent: '#FFFFFF',
  destructive: '#B0726E',
  separator: 'rgba(60,60,67,0.10)',
  hairlineSoft: 'rgba(60,60,67,0.06)',
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  radius,
  navHeight,
  eventColors: {
    blue: { bg: 'rgba(110,139,181,0.16)', border: '#6E8BB5', text: '#48597A' },
    green: { bg: 'rgba(120,160,135,0.16)', border: '#79A487', text: '#4E7059' },
    orange: { bg: 'rgba(199,160,122,0.18)', border: '#C7A07A', text: '#8C6A48' },
    red: { bg: 'rgba(193,140,140,0.18)', border: '#C18C8C', text: '#8A5A5A' },
    purple: { bg: 'rgba(150,138,180,0.16)', border: '#968AB4', text: '#645A82' },
    teal: { bg: 'rgba(111,168,173,0.16)', border: '#6FA8AD', text: '#456E72' },
  },
};

/**
 * Dark theme — dark gray (not pure black) with brighter pastel accents.
 */
export const darkTheme: Theme = {
  mode: 'dark',
  bg: '#1C1C1E',
  elevated: '#2C2C2E',
  secondary: '#3A3A3C',
  text: '#F5F5F7',
  textSecondary: '#A1A1A6',
  textTertiary: '#6E6E73',
  accent: '#9AA9D4',
  accentSoft: 'rgba(154,169,212,0.18)',
  onAccent: '#1C1C1E',
  destructive: '#D29A96',
  separator: 'rgba(255,255,255,0.12)',
  hairlineSoft: 'rgba(255,255,255,0.07)',
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  radius,
  navHeight,
  eventColors: {
    blue: { bg: 'rgba(143,168,214,0.20)', border: '#8FA8D6', text: '#C2D2EE' },
    green: { bg: 'rgba(132,178,148,0.20)', border: '#84B294', text: '#B7DBC2' },
    orange: { bg: 'rgba(212,176,132,0.20)', border: '#D4B084', text: '#E8D0AC' },
    red: { bg: 'rgba(212,154,150,0.20)', border: '#D49A96', text: '#EEC2BE' },
    purple: { bg: 'rgba(170,158,205,0.20)', border: '#AA9ECD', text: '#D0C6E8' },
    teal: { bg: 'rgba(132,184,189,0.20)', border: '#84B8BD', text: '#BCE0E2' },
  },
};

export function resolveTheme(mode: ThemeMode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}

export const ThemeContext = createContext<Theme>(lightTheme);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Builds memoized styles from the active theme. */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}

/** Static light theme — fallback for non-themed contexts (e.g. error boundary). */
export const theme = lightTheme;
