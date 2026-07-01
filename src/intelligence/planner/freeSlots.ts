import { snapToMinutes, toDateKey } from '../../utils/time';
import {
  DEFAULT_DAY_END_MINUTES,
  DEFAULT_DAY_START_MINUTES,
  PLACEMENT_SNAP_MINUTES,
} from './plannerConstants';

export interface OccupiedTimeRange {
  startMinutes: number;
  endMinutes: number;
}

export interface TimeSlot {
  start: number;
  end: number;
}

export interface FreeSlotOptions {
  now?: Date;
  dayStartMinutes?: number;
  dayEndMinutes?: number;
  bufferMinutes?: number;
}

export function getFreeSlots(
  dateKey: string,
  existing: OccupiedTimeRange[],
  bufferMinutes = 0,
  options?: FreeSlotOptions
): TimeSlot[] {
  const dayStart = options?.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES;
  const dayEnd = options?.dayEndMinutes ?? DEFAULT_DAY_END_MINUTES;
  const ref = options?.now ?? new Date();
  const todayKey = toDateKey(ref);
  let cursor = dayStart;

  if (dateKey === todayKey) {
    cursor = Math.max(
      cursor,
      snapToMinutes(ref.getHours() * 60 + ref.getMinutes() + bufferMinutes, PLACEMENT_SNAP_MINUTES)
    );
  }

  const busy = [...existing]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((entry) => ({ start: entry.startMinutes, end: entry.endMinutes }));

  const merged: TimeSlot[] = [];
  for (const block of busy) {
    const last = merged[merged.length - 1];
    if (!last || block.start > last.end) {
      merged.push({ start: block.start, end: block.end });
    } else {
      last.end = Math.max(last.end, block.end);
    }
  }

  const slots: TimeSlot[] = [];
  for (const block of merged) {
    if (block.start > cursor) {
      slots.push({ start: cursor, end: block.start });
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < dayEnd) {
    slots.push({ start: cursor, end: dayEnd });
  }

  return slots.filter((slot) => slot.end - slot.start >= PLACEMENT_SNAP_MINUTES);
}
