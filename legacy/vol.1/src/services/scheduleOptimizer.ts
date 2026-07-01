import { AiScheduleItem, EventColor, ScheduleEvent } from '../types/schedule';
import { minutesToTime, snapToMinutes, timeToMinutes, toDateKey } from '../utils/time';
import { DEFAULT_PRIORITY } from '../types/schedule';

export interface ParsedTask {
  id?: string;
  title: string;
  minutes: number;
  category: string;
  type: AiScheduleItem['type'];
  priority?: number;
  color?: EventColor;
}

export interface TimeSlot {
  start: number;
  end: number;
}

const DAY_START = 7 * 60;
const DAY_END = 22 * 60;

function preferredWindow(category: string, type: AiScheduleItem['type']): { start: number; end: number } {
  if (type === 'power_nap') return { start: 13 * 60, end: 15 * 60 };
  switch (category) {
    case 'study':
      return { start: 8 * 60, end: 12 * 60 };
    case 'work':
      return { start: 9 * 60, end: 17 * 60 };
    case 'health':
      return { start: 14 * 60, end: 19 * 60 };
    case 'music':
      return { start: 15 * 60, end: 21 * 60 };
    case 'life':
      return { start: 17 * 60, end: 21 * 60 };
    default:
      return { start: 9 * 60, end: 20 * 60 };
  }
}

function taskSortOrder(a: ParsedTask, b: ParsedTask): number {
  const pa = a.priority ?? DEFAULT_PRIORITY;
  const pb = b.priority ?? DEFAULT_PRIORITY;
  if (pa !== pb) return pa - pb;
  if (a.type === 'power_nap' && b.type !== 'power_nap') return -1;
  if (b.type === 'power_nap' && a.type !== 'power_nap') return 1;
  if (a.category === 'study' && b.category !== 'study') return -1;
  if (b.category === 'study' && a.category !== 'study') return 1;
  return 0;
}

export function getFreeSlots(
  dateKey: string,
  existing: ScheduleEvent[],
  bufferMinutes: number,
  now?: Date
): TimeSlot[] {
  const ref = now ?? new Date();
  const todayKey = toDateKey(ref);
  let cursor = DAY_START;

  if (dateKey === todayKey) {
    cursor = Math.max(cursor, snapToMinutes(ref.getHours() * 60 + ref.getMinutes() + bufferMinutes, 5));
  }

  const busy = [...existing]
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((e) => ({ start: e.startMinutes, end: e.endMinutes }));

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
  if (cursor < DAY_END) {
    slots.push({ start: cursor, end: DAY_END });
  }

  return slots.filter((s) => s.end - s.start >= 5);
}

export function formatFreeSlots(slots: TimeSlot[]): string {
  if (slots.length === 0) return '空き時間なし（既存予定で埋まっています）';
  return slots
    .map((s) => {
      const mins = s.end - s.start;
      return `${minutesToTime(s.start)}-${minutesToTime(s.end)}（${mins}分）`;
    })
    .join('\n');
}

function scorePlacement(task: ParsedTask, startMinutes: number): number {
  const priority = task.priority ?? DEFAULT_PRIORITY;
  const pref = preferredWindow(task.category, task.type);
  const mid = startMinutes + task.minutes / 2;
  const prefMid = (pref.start + pref.end) / 2;
  const inIdeal = mid >= pref.start && mid <= pref.end;

  // 低優先度: カテゴリの理想時間帯を避け、できるだけ遅い時間帯へ
  if (priority >= 4) {
    return startMinutes + (inIdeal ? -300 : 0);
  }

  // 高優先度: カテゴリの理想時間帯を最優先
  if (priority <= 2) {
    const fitScore = inIdeal ? 200 : -Math.abs(mid - prefMid);
    const priorityBoost = (3 - priority) * 40;
    return fitScore + priorityBoost - startMinutes / 3000;
  }

  // 普通: 理想時間帯を弱く優先
  const fitScore = inIdeal ? 80 : -Math.abs(mid - prefMid) * 0.5;
  return fitScore + startMinutes / 5000;
}

function appendTaskToSchedule(
  task: ParsedTask,
  start: number,
  bufferMinutes: number,
  schedule: AiScheduleItem[]
): number {
  const needBuffer = task.type !== 'power_nap' && bufferMinutes > 0;
  let cursor = start;

  if (needBuffer) {
    const bufEnd = cursor + bufferMinutes;
    schedule.push({
      title: 'バッファ（切り替え）',
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(bufEnd),
      durationMinutes: bufferMinutes,
      type: 'buffer',
      category: 'buffer',
    });
    cursor = bufEnd;
  }

  const taskEnd = cursor + task.minutes;
  schedule.push({
    title: task.title,
    startTime: minutesToTime(cursor),
    endTime: minutesToTime(taskEnd),
    durationMinutes: task.minutes,
    type: task.type,
    category: task.category,
    priority: task.priority,
    sourceTaskId: task.id,
  });

  return taskEnd;
}

function findLatestSlotStart(slots: TimeSlot[], totalNeed: number): number | null {
  let latest: number | null = null;
  for (const slot of slots) {
    if (slot.end - slot.start < totalNeed) continue;
    const start = snapToMinutes(slot.end - totalNeed, 5);
    if (start >= slot.start && (latest === null || start > latest)) {
      latest = start;
    }
  }
  return latest;
}

function subtractFromSlots(slots: TimeSlot[], usedStart: number, usedEnd: number): TimeSlot[] {
  const next: TimeSlot[] = [];
  for (const slot of slots) {
    if (usedEnd <= slot.start || usedStart >= slot.end) {
      next.push(slot);
      continue;
    }
    if (usedStart > slot.start) {
      next.push({ start: slot.start, end: usedStart });
    }
    if (usedEnd < slot.end) {
      next.push({ start: usedEnd, end: slot.end });
    }
  }
  return next.filter((s) => s.end - s.start >= 5);
}

function itemToRange(item: AiScheduleItem): { start: number; end: number } {
  return { start: timeToMinutes(item.startTime), end: timeToMinutes(item.endTime) };
}

export function validateSchedule(items: AiScheduleItem[], existing: ScheduleEvent[]): boolean {
  const ranges = items.map(itemToRange).sort((a, b) => a.start - b.start);

  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) return false;
  }

  for (const item of ranges) {
    for (const ex of existing) {
      if (item.start < ex.endMinutes && item.end > ex.startMinutes) return false;
    }
  }

  return items.length > 0;
}

function isStackedAfterExisting(items: AiScheduleItem[], existing: ScheduleEvent[], freeSlots: TimeSlot[]): boolean {
  if (existing.length === 0) return false;

  const lastExistingEnd = Math.max(...existing.map((e) => e.endMinutes));
  const firstNewStart = Math.min(...items.map((i) => timeToMinutes(i.startTime)));
  const hasGapBeforeEnd = freeSlots.some((s) => s.start < lastExistingEnd && s.end - s.start >= 25);
  const allAfterLast = firstNewStart >= lastExistingEnd - 5;

  return hasGapBeforeEnd && allAfterLast;
}

export function buildOptimizedSchedule(
  tasks: ParsedTask[],
  dateKey: string,
  existing: ScheduleEvent[],
  bufferMinutes: number,
  now?: Date
): AiScheduleItem[] {
  const sortedTasks = [...tasks].sort(taskSortOrder);
  let slots = getFreeSlots(dateKey, existing, bufferMinutes, now);
  const schedule: AiScheduleItem[] = [];
  const unplaced: ParsedTask[] = [];

  for (const task of sortedTasks) {
    const needBuffer = task.type !== 'power_nap' && bufferMinutes > 0;
    const totalNeed = task.minutes + (needBuffer ? bufferMinutes : 0);

    let best: { start: number; score: number } | null = null;

    for (const slot of slots) {
      if (slot.end - slot.start < totalNeed) continue;

      for (let start = snapToMinutes(slot.start, 5); start + totalNeed <= slot.end; start += 5) {
        const score = scorePlacement(task, start + (needBuffer ? bufferMinutes : 0));
        if (!best || score > best.score) {
          best = { start, score };
        }
      }
    }

    if (!best) {
      unplaced.push(task);
      continue;
    }

    const taskEnd = appendTaskToSchedule(task, best.start, bufferMinutes, schedule);
    slots = subtractFromSlots(slots, best.start, taskEnd + 5);
  }

  for (const task of unplaced) {
    const needBuffer = task.type !== 'power_nap' && bufferMinutes > 0;
    const totalNeed = task.minutes + (needBuffer ? bufferMinutes : 0);
    const latestStart = findLatestSlotStart(slots, totalNeed);
    if (latestStart === null) continue;

    const taskEnd = appendTaskToSchedule(task, latestStart, bufferMinutes, schedule);
    slots = subtractFromSlots(slots, latestStart, taskEnd + 5);
  }

  const placedCount = schedule.filter((i) => i.type === 'task' || i.type === 'power_nap').length;
  if (schedule.length > 0 && placedCount >= sortedTasks.length) {
    const lastEnd = timeToMinutes(schedule[schedule.length - 1].endTime);
    if (lastEnd + 5 <= DAY_END) {
      schedule.push({
        title: '休憩',
        startTime: minutesToTime(lastEnd),
        endTime: minutesToTime(lastEnd + 5),
        durationMinutes: 5,
        type: 'break',
        category: 'rest',
      });
    }
  }

  return schedule.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function refineAiSchedule(
  items: AiScheduleItem[],
  tasks: ParsedTask[],
  dateKey: string,
  existing: ScheduleEvent[],
  bufferMinutes: number,
  now?: Date
): AiScheduleItem[] {
  const freeSlots = getFreeSlots(dateKey, existing, bufferMinutes, now);
  if (!validateSchedule(items, existing) || isStackedAfterExisting(items, existing, freeSlots)) {
    return buildOptimizedSchedule(tasks, dateKey, existing, bufferMinutes, now);
  }
  return items.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function aiItemsToParsedTasks(items: AiScheduleItem[]): ParsedTask[] {
  return items
    .filter((i) => i.type === 'task' || i.type === 'power_nap')
    .map((i) => ({
      title: i.title,
      minutes: i.durationMinutes || timeToMinutes(i.endTime) - timeToMinutes(i.startTime),
      category: i.category ?? 'general',
      type: i.type,
      priority: DEFAULT_PRIORITY,
    }));
}
