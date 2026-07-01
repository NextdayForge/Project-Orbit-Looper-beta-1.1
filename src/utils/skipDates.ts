import { addDays, isSameDay, parseDateKey, toDateKey } from './time';

export type SkipDateDisplayEntry =
  | { kind: 'single'; date: string }
  | { kind: 'range'; start: string; end: string };

export function expandDateRange(startKey: string, endKey: string): string[] {
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  const [from, to] = start.getTime() <= end.getTime() ? [start, end] : [end, start];

  const dates: string[] = [];
  let cursor = from;
  while (cursor.getTime() <= to.getTime()) {
    dates.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function mergeSkipDateKeys(existing: string[], additions: string[]): string[] {
  return [...new Set([...existing, ...additions])].sort();
}

export function removeSkipDateRange(existing: string[], startKey: string, endKey: string): string[] {
  const toRemove = new Set(expandDateRange(startKey, endKey));
  return existing.filter((dateKey) => !toRemove.has(dateKey));
}

export function mergeSkipDatesForDisplay(dates: string[]): SkipDateDisplayEntry[] {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length === 0) {
    return [];
  }

  const result: SkipDateDisplayEntry[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  const flushRange = () => {
    if (rangeStart === rangeEnd) {
      result.push({ kind: 'single', date: rangeStart });
    } else {
      result.push({ kind: 'range', start: rangeStart, end: rangeEnd });
    }
  };

  for (let index = 1; index < sorted.length; index += 1) {
    const nextDate = sorted[index];
    const dayAfterCurrent = addDays(parseDateKey(rangeEnd), 1);
    if (isSameDay(dayAfterCurrent, parseDateKey(nextDate))) {
      rangeEnd = nextDate;
      continue;
    }
    flushRange();
    rangeStart = nextDate;
    rangeEnd = nextDate;
  }

  flushRange();
  return result;
}

export function formatSkipDateDisplay(dateKey: string): string {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatSkipEntryLabel(entry: SkipDateDisplayEntry): string {
  if (entry.kind === 'single') {
    return formatSkipDateDisplay(entry.date);
  }
  return `${formatSkipDateDisplay(entry.start)}〜${formatSkipDateDisplay(entry.end)}`;
}

export function countSkipDays(dates: string[]): number {
  return new Set(dates).size;
}
