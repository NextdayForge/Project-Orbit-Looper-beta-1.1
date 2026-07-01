import { parseDateKey, toDateKey } from '../../utils/time';

export function minutesToPickerDate(minutes: number): Date {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

export function pickerDateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function dateKeyToPickerDate(dateKey: string): Date {
  return parseDateKey(dateKey);
}

export function pickerDateToDateKey(date: Date): string {
  return toDateKey(date);
}

export function durationToPickerDate(minutes: number): Date {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(1970, 0, 1, hours, mins, 0, 0);
}

export function pickerDateToDuration(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function clampDurationMinutes(
  minutes: number,
  minMinutes: number,
  maxMinutes: number,
  minuteInterval: number
): number {
  const clamped = Math.max(minMinutes, Math.min(maxMinutes, minutes));
  return Math.round(clamped / minuteInterval) * minuteInterval;
}

export function formatPickerDateLabel(dateKey: string, compact = false): string {
  const date = parseDateKey(dateKey);
  if (compact) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}
