export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function getMonthGrid(date: Date, weekStartsOn: 0 | 1): Date[] {
  const first = startOfMonth(date);
  const startOffset = (first.getDay() - weekStartsOn + 7) % 7;
  const gridStart = addDays(first, -startOffset);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${pad(h)}:${pad(m)}`;
}

export function timeToMinutes(time: string): number {
  if (!time || typeof time !== 'string') return NaN;
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return NaN;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return NaN;
  return h * 60 + m;
}

export function isValidMinutes(minutes: number): boolean {
  return Number.isFinite(minutes) && minutes >= 0 && minutes <= 1440;
}

export function formatTime(minutes: number, use24Hour: boolean): string {
  if (!isValidMinutes(minutes)) return '--:--';
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  if (use24Hour) return `${pad(h)}:${pad(m)}`;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${pad(m)} ${period}`;
}

export function formatDateHeader(date: Date): string {
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
}

export function snapToMinutes(minutes: number, step = 5): number {
  return Math.round(minutes / step) * step;
}

export function clampMinutes(value: number): number {
  return Math.max(0, Math.min(1439, value));
}

export function durationLabel(start: number, end: number): string {
  const mins = end - start;
  if (mins < 60) return `${mins}分`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

export interface LayoutEvent {
  event: import('../types/schedule').ScheduleEvent;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
}

export function layoutDayEvents(
  events: import('../types/schedule').ScheduleEvent[],
  pxPerMinute: number,
  minEventHeightPx: number
): LayoutEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  const groups: import('../types/schedule').ScheduleEvent[][] = [];
  let currentGroup: import('../types/schedule').ScheduleEvent[] = [];
  let groupEnd = -1;

  for (const ev of sorted) {
    if (currentGroup.length === 0 || ev.startMinutes < groupEnd) {
      currentGroup.push(ev);
      groupEnd = Math.max(groupEnd, ev.endMinutes);
    } else {
      groups.push(currentGroup);
      currentGroup = [ev];
      groupEnd = ev.endMinutes;
    }
  }
  if (currentGroup.length) groups.push(currentGroup);

  const result: LayoutEvent[] = [];

  for (const group of groups) {
    const columns: import('../types/schedule').ScheduleEvent[][] = [];

    for (const ev of group) {
      let placed = false;
      for (const col of columns) {
        const last = col[col.length - 1];
        if (last.endMinutes <= ev.startMinutes) {
          col.push(ev);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([ev]);
    }

    const totalColumns = columns.length;
    columns.forEach((col, colIndex) => {
      for (const ev of col) {
        const rawHeight = (ev.endMinutes - ev.startMinutes) * pxPerMinute;
        result.push({
          event: ev,
          top: ev.startMinutes * pxPerMinute,
          height: Math.max(rawHeight, minEventHeightPx),
          column: colIndex,
          totalColumns,
        });
      }
    });
  }

  return result;
}

export function generateId(): string {
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
