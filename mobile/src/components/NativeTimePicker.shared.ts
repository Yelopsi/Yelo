import type { StyleProp, ViewStyle } from 'react-native';

export interface NativeTimePickerProps {
  /** Horário selecionado no formato 24h `HH:mm` (ex: `"14:00"`). */
  time: string;
  /** Callback disparado com `HH:mm` normalizado ao alterar o horário. */
  onChangeTime: (hhmm: string) => void;
  /** Selo complementar dentro do campo (ex: `"50 min"` ou `"1h livre"`). */
  durationBadgeLabel?: string;
  /** Rótulo descritivo à esquerda no iOS (padrão: `"Início"`). */
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function timeStringToDate(hhmm: string): Date {
  const parts = String(hhmm || '14:00').split(':');
  const h = Math.max(0, Math.min(23, parseInt(parts[0] || '14', 10) || 0));
  const m = Math.max(0, Math.min(59, parseInt(parts[1] || '0', 10) || 0));
  return new Date(2026, 0, 1, h, m, 0, 0);
}

export function dateToTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
